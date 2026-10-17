import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type {
  EngineInfo,
  EngineStatus,
  EngineToHostMessage,
  HostToEngineMessage,
  RunRequest,
  RunResult,
  StreamName,
} from '@/types/engine';
import { preparePyodide, type EngineSource } from './assets/pyodideAssets';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface RunOptions {
  /** Live stdout/stderr chunks (batched ~50 ms inside the interpreter). */
  onStream?: (chunk: string, stream: StreamName) => void;
}

export interface PythonEngine {
  status: EngineStatus;
  info: EngineInfo | null;
  error: string | null;
  /** Never rejects for learner-code problems — those come back as `RunResult.error`. */
  run(request: RunRequest, options?: RunOptions): Promise<RunResult>;
  /** Warm packages (e.g. pandas) when a lesson opens, before the learner presses Run. */
  preload(packages: string[]): Promise<boolean>;
  /** Kill the interpreter and boot a fresh one (also retries a failed install). */
  restart(): void;
}

const DEFAULT_TIMEOUT_MS = 5_000;
/** Headroom on top of the soft timeouts before the WebView is killed. */
const HARD_TIMEOUT_GRACE_MS = 4_000;
/** Package loading (pandas ≈ 2–4 s on mid-range phones) happens outside the soft timeout. */
const PACKAGE_GRACE_MS = 20_000;
const PRELOAD_TIMEOUT_MS = 120_000;
const BOOT_TIMEOUT_MS = 45_000;

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

type Job =
  | { kind: 'run'; msg: Extract<HostToEngineMessage, { type: 'run' }>; hardTimeoutMs: number; resolve: (r: RunResult) => void; onStream?: RunOptions['onStream'] }
  | { kind: 'preload'; msg: Extract<HostToEngineMessage, { type: 'preload' }>; hardTimeoutMs: number; resolve: (ok: boolean) => void };

let idCounter = 0;
const nextId = () => `${Date.now().toString(36)}-${(++idCounter).toString(36)}`;

export function syntheticFailure(type: string, message: string, timedOut = false): RunResult {
  return {
    ok: false,
    stdout: '',
    stderr: '',
    images: [],
    truncated: false,
    timedOut,
    tests: [],
    durationMs: 0,
    error: { type, message, line: null, column: null, traceback: [], formatted: `${type}: ${message}` },
  };
}

function settle(job: Job, failure: RunResult) {
  if (job.kind === 'run') job.resolve(failure);
  else job.resolve(false);
}

function isEngineMessage(value: unknown): value is EngineToHostMessage {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

/** JSON → JS string literal that is safe to embed in injectJavaScript. */
function toJsStringLiteral(payload: string): string {
  return JSON.stringify(payload).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

const EngineContext = createContext<PythonEngine | null>(null);

/**
 * Mounts one app-wide headless WebView hosting Pyodide.
 *
 * Safety model (defence in depth):
 *  - Soft timeout: sys.settrace watchdog inside Python raises PyPathTimeout.
 *  - Hard timeout: if the active job doesn't answer in time (C-level loop, runaway
 *    allocation) the WebView is unmounted and re-created; the job resolves with a
 *    PyPathTimeout result, queued jobs continue on the fresh interpreter.
 *  - Renderer death (OOM) on Android/iOS triggers the same recovery path.
 *  - Only schema-tagged JSON messages are accepted from the WebView.
 *
 * Jobs are dispatched strictly one at a time from the host, so the hard-timeout
 * clock only runs for the job that actually owns the interpreter.
 */
export function PythonEngineProvider({ children }: PropsWithChildren) {
  const webRef = useRef<WebView>(null);
  const queue = useRef<Job[]>([]);
  const active = useRef<{ job: Job; timer: ReturnType<typeof setTimeout> } | null>(null);
  const readyRef = useRef(false);
  const statusRef = useRef<EngineStatus>('installing');

  const [source, setSource] = useState<EngineSource | null>(null);
  const [installAttempt, setInstallAttempt] = useState(0);
  const [generation, setGeneration] = useState(0); // bump ⇒ remount WebView
  const [status, setStatusState] = useState<EngineStatus>('installing');
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setStatus = useCallback((s: EngineStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  // ── Install / locate Pyodide ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setStatus('installing');
    preparePyodide()
      .then((s) => {
        if (cancelled) return;
        setSource(s);
        setStatus('booting');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(String(e));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [installAttempt, setStatus]);

  // ── Dispatch ───────────────────────────────────────────────────────────────
  // Refs give the timer/message callbacks a stable handle to the latest logic.
  const pumpRef = useRef<() => void>(() => {});
  const restartRef = useRef<(reason: string) => void>(() => {});

  pumpRef.current = () => {
    if (!readyRef.current || active.current) return;
    const job = queue.current.shift();
    if (!job) return;
    const timer = setTimeout(() => {
      if (active.current?.job !== job) return;
      active.current = null;
      settle(job, syntheticFailure('PyPathTimeout', 'Your program stopped responding and was terminated.', true));
      restartRef.current('hard timeout');
    }, job.hardTimeoutMs);
    active.current = { job, timer };
    const literal = toJsStringLiteral(JSON.stringify(job.msg));
    webRef.current?.injectJavaScript(`window.__pypath && window.__pypath.receive(${literal}); true;`);
  };

  const finishActive = useCallback((id: string): Job | null => {
    const a = active.current;
    if (!a || a.job.msg.id !== id) return null;
    clearTimeout(a.timer);
    active.current = null;
    return a.job;
  }, []);

  const failEverything = useCallback((reason: string) => {
    const failure = syntheticFailure('EngineCrash', reason);
    if (active.current) {
      clearTimeout(active.current.timer);
      settle(active.current.job, failure);
      active.current = null;
    }
    queue.current.splice(0).forEach((j) => settle(j, failure));
  }, []);

  restartRef.current = (reason: string) => {
    if (__DEV__) console.warn(`[PyPath] Restarting Python engine: ${reason}`);
    readyRef.current = false;
    // The active job (if any) is failed; queued jobs survive and run after reboot.
    if (active.current) {
      clearTimeout(active.current.timer);
      settle(active.current.job, syntheticFailure('EngineCrash', `The Python engine restarted (${reason}). Please run again.`));
      active.current = null;
    }
    setInfo(null);
    setError(null);
    if (!source) {
      setInstallAttempt((n) => n + 1);
    } else {
      setStatus('booting');
      setGeneration((g) => g + 1);
    }
  };

  // ── Boot watchdog ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'booting' || !source) return;
    const t = setTimeout(() => {
      setError('The Python engine took too long to start.');
      setStatus('error');
      failEverything('The Python engine failed to start.');
    }, BOOT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [status, source, generation, failEverything, setStatus]);

  // ── Incoming messages ──────────────────────────────────────────────────────
  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let msg: unknown;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (!isEngineMessage(msg)) return;

      switch (msg.type) {
        case 'ready':
          readyRef.current = true;
          setInfo({
            pythonVersion: msg.pythonVersion,
            pyodideVersion: msg.pyodideVersion,
            bootMs: msg.bootMs,
            source: source?.kind === 'bundled' ? 'bundled' : 'cdn',
          });
          setError(null);
          setStatus('ready');
          pumpRef.current();
          break;
        case 'boot_error':
          readyRef.current = false;
          setError(msg.message);
          setStatus('error');
          failEverything(`The Python engine failed to start: ${msg.message}`);
          break;
        case 'stream': {
          const job = active.current?.job;
          if (job?.kind === 'run' && job.msg.id === msg.id) job.onStream?.(msg.chunk, msg.stream);
          break;
        }
        case 'result': {
          const job = finishActive(msg.id);
          if (job?.kind === 'run') job.resolve(msg.result);
          pumpRef.current();
          break;
        }
        case 'preload_done': {
          const job = finishActive(msg.id);
          if (job?.kind === 'preload') job.resolve(msg.ok);
          pumpRef.current();
          break;
        }
        case 'log':
          if (__DEV__) console.log(`[PyPath engine:${msg.level}]`, msg.message);
          break;
      }
    },
    [source, finishActive, failEverything, setStatus],
  );

  // ── API ────────────────────────────────────────────────────────────────────
  const enqueue = useCallback((job: Job) => {
    if (statusRef.current === 'error') {
      settle(job, syntheticFailure('EngineUnavailable', 'The Python engine is not available. Tap "Restart engine" and try again.'));
      return;
    }
    queue.current.push(job);
    pumpRef.current();
  }, []);

  const run = useCallback(
    (request: RunRequest, options?: RunOptions) =>
      new Promise<RunResult>((resolve) => {
        const perExec = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const executions = 1 + (request.mode === 'test' ? request.tests?.length ?? 0 : 0);
        const mayLoadPackages = (request.packages?.length ?? 0) > 0 || /^\s*(import|from)\s/m.test(request.code);
        enqueue({
          kind: 'run',
          msg: { type: 'run', id: nextId(), request: { ...request, timeoutMs: perExec } },
          hardTimeoutMs: perExec * executions + HARD_TIMEOUT_GRACE_MS + (mayLoadPackages ? PACKAGE_GRACE_MS : 0),
          resolve,
          onStream: options?.onStream,
        });
      }),
    [enqueue],
  );

  const preload = useCallback(
    (packages: string[]) =>
      new Promise<boolean>((resolve) => {
        if (packages.length === 0) return resolve(true);
        enqueue({ kind: 'preload', msg: { type: 'preload', id: nextId(), packages }, hardTimeoutMs: PRELOAD_TIMEOUT_MS, resolve });
      }),
    [enqueue],
  );

  const restart = useCallback(() => restartRef.current('manual restart'), []);

  const api = useMemo<PythonEngine>(
    () => ({ status, info, error, run, preload, restart }),
    [status, info, error, run, preload, restart],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const webSource =
    source?.kind === 'bundled'
      ? { uri: source.indexUri }
      : source?.kind === 'cdn'
        ? { html: source.html, baseUrl: source.baseUrl }
        : null;

  return (
    <EngineContext.Provider value={api}>
      {children}
      {webSource && (
        <View style={styles.hidden} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          <WebView
            key={generation}
            ref={webRef}
            source={webSource}
            originWhitelist={['*']}
            javaScriptEnabled
            onMessage={onMessage}
            // file:// access for the vendored runtime (fetch shim uses XHR)
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            allowingReadAccessToURL={source?.kind === 'bundled' ? source.dirUri : undefined}
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={(req) =>
              req.url.startsWith('file://') ||
              req.url.startsWith('about:') ||
              req.url.startsWith('https://localhost') ||
              req.url.startsWith('https://cdn.jsdelivr.net')
            }
            // crash recovery
            onContentProcessDidTerminate={() => restartRef.current('iOS web content process terminated')}
            onRenderProcessGone={() => restartRef.current('Android renderer process gone')}
            onError={(e) => {
              readyRef.current = false;
              setError(e.nativeEvent.description);
              setStatus('error');
              failEverything(`The Python engine failed to load: ${e.nativeEvent.description}`);
            }}
          />
        </View>
      )}
    </EngineContext.Provider>
  );
}

export function usePythonEngine(): PythonEngine {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('usePythonEngine must be used inside <PythonEngineProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  // 1×1 & transparent rather than 0×0: some Android WebViews throttle timers in zero-size views.
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
});
