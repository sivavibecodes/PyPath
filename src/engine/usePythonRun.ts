import { useCallback, useEffect, useRef, useState } from 'react';

import type { RunRequest, RunResult } from '@/types/engine';
import { usePythonEngine } from './PythonEngineProvider';

export interface PythonRunState {
  running: boolean;
  /** Live, streamed console text for the current/last run. */
  liveOutput: string;
  result: RunResult | null;
  run: (request: RunRequest) => Promise<RunResult>;
  clear: () => void;
}

const FLUSH_MS = 60;

/**
 * Screen-level helper around the engine: tracks running state, coalesces streamed
 * chunks into ≤ ~16 React updates/sec, and ignores results from superseded runs.
 */
export function usePythonRun(): PythonRunState {
  const engine = usePythonEngine();
  const [running, setRunning] = useState(false);
  const [liveOutput, setLiveOutput] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);

  const runToken = useRef(0);
  const buffer = useRef('');
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      if (flushTimer.current) clearTimeout(flushTimer.current);
    },
    [],
  );

  const flush = useCallback(() => {
    flushTimer.current = null;
    if (!mounted.current || !buffer.current) return;
    const chunk = buffer.current;
    buffer.current = '';
    setLiveOutput((prev) => prev + chunk);
  }, []);

  const run = useCallback(
    async (request: RunRequest) => {
      const token = ++runToken.current;
      buffer.current = '';
      setLiveOutput('');
      setResult(null);
      setRunning(true);

      const res = await engine.run(request, {
        onStream: (chunk) => {
          if (token !== runToken.current) return;
          buffer.current += chunk;
          flushTimer.current ??= setTimeout(flush, FLUSH_MS);
        },
      });

      if (token === runToken.current && mounted.current) {
        if (flushTimer.current) clearTimeout(flushTimer.current);
        flushTimer.current = null;
        buffer.current = '';
        // The authoritative stdout/stderr comes from the final result.
        setLiveOutput(res.stdout + (res.stderr ? `\n${res.stderr}` : ''));
        setResult(res);
        setRunning(false);
      }
      return res;
    },
    [engine, flush],
  );

  const clear = useCallback(() => {
    runToken.current++;
    setLiveOutput('');
    setResult(null);
    setRunning(false);
  }, []);

  return { running, liveOutput, result, run, clear };
}
