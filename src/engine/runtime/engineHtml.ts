import { PYTHON_RUNNER_SOURCE } from './pythonRunner';

export interface EngineHtmlOptions {
  /** Directory URL containing pyodide.js & friends; must end with "/". */
  indexURL: string;
  /** true when indexURL is a file:// directory (enables the fetch→XHR shim). */
  local: boolean;
}

/** Escape a value for safe inlining inside a <script> block. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Builds the headless engine page. It:
 *  1. installs a fetch() shim so Pyodide can read file:// assets (Android/iOS
 *     WebViews reject fetch on the file scheme, but allow XHR when
 *     allowFileAccessFromFileURLs is enabled),
 *  2. loads pyodide.js, boots the interpreter and the PyPath runner,
 *  3. exposes window.__pypath.receive(json) for the RN host (via injectJavaScript),
 *  4. serialises all requests through a promise queue (one interpreter, one job).
 */
export function buildEngineHtml({ indexURL, local }: EngineHtmlOptions): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PyPath Engine</title>
</head>
<body>
<script>
(function () {
  'use strict';
  var INDEX_URL = ${inlineJson(indexURL)};
  var LOCAL = ${local ? 'true' : 'false'};
  var RUNNER_SRC = ${inlineJson(PYTHON_RUNNER_SOURCE)};

  function post(msg) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) { /* host gone */ }
  }
  function log(level, message) { post({ type: 'log', level: level, message: String(message) }); }

  window.onerror = function (m, src, line) { log('error', m + ' @ ' + src + ':' + line); };
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; log('error', 'Unhandled rejection: ' + ((r && r.message) || r));
  });

  // ── 1. file:// fetch shim ────────────────────────────────────────────────
  var MIME = { wasm: 'application/wasm', js: 'text/javascript', json: 'application/json', zip: 'application/zip', whl: 'application/zip' };
  if (LOCAL) {
    var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (url.indexOf('file://') !== 0) return nativeFetch(input, init);
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function () {
          // file:// XHR reports status 0 on success in most WebViews.
          if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
            var ext = url.split('?')[0].split('.').pop().toLowerCase();
            resolve(new Response(xhr.response, { status: 200, headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' } }));
          } else {
            reject(new TypeError('Failed to load ' + url + ' (HTTP ' + xhr.status + ')'));
          }
        };
        xhr.onerror = function () { reject(new TypeError('Failed to load ' + url)); };
        xhr.send();
      });
    };
  }

  // ── 2. boot ──────────────────────────────────────────────────────────────
  var pyodide = null;
  var runPy = null;
  var queue = Promise.resolve();

  function boot() {
    var t0 = performance.now();
    window.loadPyodide({
      indexURL: INDEX_URL,
      stdout: function (s) { log('info', '[py] ' + s); },
      stderr: function (s) { log('warn', '[py] ' + s); }
    }).then(function (py) {
      pyodide = py;
      py.runPython(RUNNER_SRC);
      runPy = py.globals.get('pypath_run');
      var version = py.runPython('import sys; sys.version.split()[0]');
      post({ type: 'ready', pythonVersion: String(version), pyodideVersion: String(py.version), bootMs: Math.round(performance.now() - t0) });
    }).catch(function (e) {
      post({ type: 'boot_error', message: String((e && e.message) || e) });
    });
  }

  var script = document.createElement('script');
  script.src = INDEX_URL + 'pyodide.js';
  script.onload = boot;
  script.onerror = function () { post({ type: 'boot_error', message: 'Could not load ' + script.src }); };
  document.head.appendChild(script);

  // ── 3. request handling ─────────────────────────────────────────────────
  function failure(type, message) {
    return {
      ok: false, stdout: '', stderr: '', images: [], truncated: false, timedOut: false, tests: [], durationMs: 0,
      error: { type: type, message: message, line: null, column: null, traceback: [], formatted: type + ': ' + message, context: {} }
    };
  }

  async function loadPackages(request) {
    var quiet = { messageCallback: function () {}, errorCallback: function (m) { log('warn', m); } };
    if (request.packages && request.packages.length) await pyodide.loadPackage(request.packages, quiet);
    await pyodide.loadPackagesFromImports(request.code || '', quiet);
  }

  async function handle(msg) {
    if (!runPy) throw new Error('Engine not ready');
    if (msg.type === 'run') {
      try {
        await loadPackages(msg.request);
      } catch (e) {
        post({ type: 'result', id: msg.id, result: failure('PackageUnavailableError', String((e && e.message) || e)) });
        return;
      }
      var emit = function (stream, chunk) { post({ type: 'stream', id: msg.id, stream: stream, chunk: chunk }); };
      try {
        var json = await runPy(JSON.stringify(msg.request), emit);
        post({ type: 'result', id: msg.id, result: JSON.parse(json) });
      } catch (e) {
        post({ type: 'result', id: msg.id, result: failure('EngineError', String((e && e.message) || e)) });
      }
    } else if (msg.type === 'preload') {
      try {
        await pyodide.loadPackage(msg.packages, { messageCallback: function () {} });
        post({ type: 'preload_done', id: msg.id, ok: true });
      } catch (e) {
        post({ type: 'preload_done', id: msg.id, ok: false, error: String((e && e.message) || e) });
      }
    }
  }

  window.__pypath = {
    receive: function (raw) {
      var msg;
      try { msg = JSON.parse(raw); } catch (e) { log('error', 'Bad message'); return; }
      if (!msg || typeof msg.id !== 'string') return;
      queue = queue.then(function () { return handle(msg); }).catch(function (e) { log('error', e && e.message ? e.message : e); });
    }
  };
})();
</script>
</body>
</html>`;
}
