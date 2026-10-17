import type { TestCase, VirtualFile } from './curriculum';

// ─────────────────────────────────────────────────────────────────────────────
// Public engine API types
// ─────────────────────────────────────────────────────────────────────────────

export interface RunRequest {
  code: string;
  /** `run` executes once; `test` executes once for display, then once per test case. */
  mode: 'run' | 'test';
  stdin?: string;
  files?: VirtualFile[];
  packages?: string[];
  tests?: TestCase[];
  /** Soft timeout enforced inside the interpreter (per execution). */
  timeoutMs?: number;
  maxOutputChars?: number;
}

export interface TracebackFrame {
  file: 'main.py' | 'test';
  line: number;
  function: string | null;
  code: string | null;
}

/** Extra facts gathered by introspecting the failing frame (for humanized errors). */
export interface ErrorContext {
  /** Source text of the indexed expression, e.g. "scores". */
  target?: string;
  index?: number;
  length?: number;
  container?: string;
  key?: string;
  availableKeys?: string[];
  /** "Did you mean …?" candidate. */
  suggestion?: string;
  /** Type name of the object involved (AttributeError). */
  targetType?: string;
  module?: string;
}

export interface PyErrorInfo {
  /** Python exception class name, or a PyPath pseudo-type (PyPathTimeout, PyPathOutputLimit, EngineCrash…). */
  type: string;
  message: string;
  /** 1-based line in main.py, if the error is attributable to learner code. */
  line: number | null;
  column: number | null;
  traceback: TracebackFrame[];
  /** Cleaned traceback with sandbox frames removed. */
  formatted: string;
  context?: ErrorContext;
}

export interface TestResult {
  id: string;
  name: string;
  hidden: boolean;
  kind: TestCase['kind'];
  passed: boolean;
  /** For failed asserts/stdout comparisons (omitted for hidden tests in the UI). */
  expected?: string;
  actual?: string;
  message?: string;
  error: PyErrorInfo | null;
  stdout: string;
  durationMs: number;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  error: PyErrorInfo | null;
  /** Base64 PNGs of any matplotlib figures created by the program. */
  images: string[];
  truncated: boolean;
  timedOut: boolean;
  tests: TestResult[];
  durationMs: number;
}

export type StreamName = 'stdout' | 'stderr';

// ─────────────────────────────────────────────────────────────────────────────
// WebView wire protocol
// ─────────────────────────────────────────────────────────────────────────────

export type HostToEngineMessage =
  | { type: 'run'; id: string; request: RunRequest }
  | { type: 'preload'; id: string; packages: string[] };

export type EngineToHostMessage =
  | { type: 'ready'; pythonVersion: string; pyodideVersion: string; bootMs: number }
  | { type: 'boot_error'; message: string }
  | { type: 'stream'; id: string; stream: StreamName; chunk: string }
  | { type: 'result'; id: string; result: RunResult }
  | { type: 'preload_done'; id: string; ok: boolean; error?: string }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string };

export type EngineStatus = 'installing' | 'booting' | 'ready' | 'error';

export interface EngineInfo {
  pythonVersion: string;
  pyodideVersion: string;
  bootMs: number;
  source: 'bundled' | 'cdn';
}
