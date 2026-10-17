# PyPath — Mobile Architecture Blueprint & Technical Specification

> **A Production-Ready, Offline-First Mobile Python Learning Platform for iOS & Android**  
> *Aligned with PCEP/PCAP Standards & Applied Profession Automation Tracks*

---

## 1. High-Level System Architecture

PyPath delivers a micro-learning experience powered by an on-device WebAssembly Python runtime (Pyodide) running inside a headless WebView bridge. This architecture ensures **instant, zero-latency execution**, **100% offline capability**, and **zero external server compute costs for basic code execution**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Native + Expo SDK 52                      │
│                                                                        │
│  ┌─────────────────────────┐             ┌──────────────────────────┐  │
│  │       UI Layer          │             │    State & Persistence   │  │
│  │  - Path View (Duolingo) │             │  - Zustand Stores        │  │
│  │  - 4-Card Lesson Loop   │             │  - MMKV Fast Cache       │  │
│  │  - Split Code Lab       │             │  - TanStack Query        │  │
│  │  - Cert Readiness Hub   │             │  - Sync Outbox Queue     │  │
│  │  - Cheat Sheet Ref      │             └────────────┬─────────────┘  │
│  └───────────┬─────────────┘                          │                │
│              │                                        │                │
│  ┌───────────▼─────────────┐                          │                │
│  │   CodeMirror 6 Editor   │                          │                │
│  │  - Touch Accessory Bar  │                          │                │
│  │  - Syntax Highlighting  │                          │                │
│  │  - Error Line Highlight │                          │                │
│  └───────────┬─────────────┘                          │                │
│              │                                        │                │
│  ┌───────────▼────────────────────────────────────────▼─────────────┐  │
│  │                   Python Execution Engine Bridge                 │  │
│  │  - Soft Timeout (sys.settrace bytecode watchdog)                 │  │
│  │  - Hard Timeout (Process watchdog + auto WebView remount)        │  │
│  │  - Humanized Error Interceptor & AST Introspector                │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │ postMessage / injectJavaScript
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│            Headless WebView Sandbox (Offline WebAssembly)              │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         Pyodide Runtime                          │  │
│  │  - CPython 3.12+ compiled to WebAssembly (Wasm)                  │  │
│  │  - In-Memory Virtual File System (/home/pyodide)                 │  │
│  │  - Streaming stdout / stderr TextIO Buffering                    │  │
│  │  - Pre-warmed C-extensions (NumPy, Pandas, BeautifulSoup4)       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ Cloud Sync (Outbox pattern)
┌─────────────────────────────────────┴──────────────────────────────────┐
│                   Supabase Cloud Backend (Postgres)                    │
│  - Auth & User Profiles   - Global Leaderboards    - Mistake Analytics  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory & File Structure

```
PyPath/
├── app.json                                 # Expo configuration & deep links
├── package.json                             # Dependencies & build scripts
├── tsconfig.json                            # TypeScript configuration (@/ alias)
├── metro.config.js                          # Asset handling for .bin / .wav
├── babel.config.js                          # Babel preset configuration
├── supabase/
│   └── schema.sql                           # Postgres tables, RLS policies & RPC
├── scripts/
│   ├── build-editor.mjs                     # esbuild bundle CodeMirror 6 to IIFE
│   ├── fetch-pyodide.mjs                    # Vendors Pyodide & wheels for offline
│   └── generate-sounds.mjs                  # Synthesizes PCM WAV audio feedback
├── editor-src/
│   └── index.ts                             # CodeMirror 6 mobile configuration
├── app/                                     # Expo Router (SDK 52)
│   ├── _layout.tsx                          # Root Provider wrapper
│   ├── (tabs)/
│   │   ├── _layout.tsx                      # Bottom tab navigation
│   │   ├── index.tsx                        # Learning Path (Duolingo-style)
│   │   ├── cert.tsx                         # Certification Readiness Hub
│   │   ├── reference.tsx                    # Offline Cheat Sheet dictionary
│   │   └── profile.tsx                      # Mistakes, XP & settings
│   ├── lesson/
│   │   └── [id].tsx                         # 4-Card micro-learning screen
│   ├── lab/
│   │   └── [id].tsx                         # Split-screen Code Lab challenge
│   └── exam/
│       └── [id].tsx                         # Timed mock exam simulation
└── src/
    ├── types/
    │   ├── curriculum.ts                    # Lessons, Challenges, Tests, Tracks
    │   ├── editor.ts                        # Accessory bar & editor commands
    │   └── engine.ts                        # Pyodide protocol & error types
    ├── engine/                              # On-device Python Runtime
    │   ├── index.ts                         # Public exports
    │   ├── PythonEngineProvider.tsx         # Headless WebView host & queue
    │   ├── usePythonRun.ts                  # React execution & streaming hook
    │   ├── errorHumanizer.ts                # AST context & error re-writer
    │   ├── runtime/
    │   │   ├── pythonRunner.ts              # In-sandbox Python test harness
    │   │   └── engineHtml.ts                # Host HTML & XHR file:// fetch shim
    │   └── assets/
    │       ├── pyodideAssets.ts             # Local file system asset installer
    │       └── pyodideManifest.generated.ts # Bundled asset declarations
    ├── components/
    │   ├── common/
    │   │   └── Header.tsx                   # Top bar (XP, streak, track pill)
    │   └── editor/
    │       ├── CodeEditor.tsx               # CodeMirror 6 React Native wrapper
    │       ├── AccessoryBar.tsx             # Quick-touch symbol & keyword row
    │       ├── editorHtml.ts                # Standalone offline editor page
    │       └── generated/
    │           └── editorBundle.ts          # Inlined minified editor bundle
    ├── features/
    │   ├── path/
    │   │   ├── PathView.tsx                 # Winding SVG/Offset S-curve node map
    │   │   └── TrackSwitcherModal.tsx       # Standard vs Profession modal
    │   ├── lesson/
    │   │   └── LessonScreen.tsx             # 4-Card learning loop component
    │   ├── lab/
    │   │   ├── CodeLabScreen.tsx            # Split interface with live terminal
    │   │   └── OutputPanel.tsx              # Output, test cases, and explain tabs
    │   ├── cert/
    │   │   ├── CertificationHubScreen.tsx   # Readiness score & objective gauge
    │   │   └── MockExamScreen.tsx           # Timed exam with countdown & report
    │   ├── reference/
    │   │   └── CheatSheetScreen.tsx         # Searchable offline syntax dictionary
    │   └── profile/
    │       └── ProfileScreen.tsx            # Mistake analytics & streak breakdown
    ├── stores/
    │   ├── progressStore.ts                 # XP, streaks, mistakes, sync outbox
    │   ├── draftStore.ts                    # In-progress learner code drafts
    │   └── settingsStore.ts                 # Tracks, font size, haptics/audio
    ├── services/
    │   ├── supabase.ts                      # Supabase client with MMKV auth
    │   └── sync.ts                          # Background outbox sync service
    ├── lib/
    │   ├── storage.ts                       # MMKV synchronous storage engine
    │   └── feedback.ts                      # Centralized haptics & audio chimes
    ├── theme/
    │   └── index.ts                         # Python brand dark mode tokens
    └── content/
        ├── registry.ts                      # Curriculum registry & path units
        ├── cheatsheet.ts                    # Offline W3Schools-style entries
        ├── mockExams.ts                     # PCEP & PCAP exam objective pools
        ├── lessons/
        │   ├── beginner/
        │   │   └── conditionals.json        # 4-Card Beginner lesson object
        │   └── marketing/
        │       └── utm-autotagger.json      # 4-Card Marketing automation lesson
        └── professions/
            ├── marketing.ts                 # Marketing & Growth use cases
            ├── finance.ts                   # Finance & Accounting use cases
            ├── productOps.ts                # Product & Operations use cases
            └── data.ts                      # Data Analysts use cases
```

---

## 3. The On-Device Python Execution Bridge

Running Python on mobile devices without relying on network latency or compute servers requires solving three core technical hurdles:

### A. The Native-to-Wasm Sandbox Barrier
The engine runs inside a single, app-wide headless `react-native-webview`. 
- **Fetch Shim**: Mobile WebViews reject `fetch()` calls on local `file://` URLs. Our engine injects an `XMLHttpRequest` shim inside `src/engine/runtime/engineHtml.ts` configured for `arraybuffer` reads, enabling Pyodide to load local wheels and wasm binaries without network access.
- **Top-Level Await & Asyncio**: Mobile code snippets frequently use `asyncio.run()`. In a browser event loop, calling `asyncio.run()` raises an error because the event loop is already running. Our in-sandbox Python runner (`pythonRunner.ts`) rewrites calls via Python's AST parser to `await coro`, enabling seamless modern asynchronous execution.

### B. Defense-in-Depth Execution Watchdogs
To guarantee the mobile app never freezes due to learner infinite loops (`while True: pass`) or huge memory allocations:
1. **Soft Timeout (Interpreter Bytecode Watchdog)**: `src/engine/runtime/pythonRunner.ts` installs a custom `sys.settrace` hook with a monotonic deadline check every 1024 bytecode steps. When triggered, it raises `PyPathTimeout(BaseException)`, which learner `except Exception:` blocks cannot catch.
2. **Hard Timeout (Process Watchdog)**: If unmanaged C code or Wasm blocks execution, the host (`src/engine/PythonEngineProvider.tsx`) fires a hard timeout timer (soft timeout + 4,000ms grace period), terminates the WebView, remounts a fresh instance, and reports the error gracefully.
3. **Renderer Crash Recovery**: Listens to `onContentProcessDidTerminate` (iOS WKWebView) and `onRenderProcessGone` (Android) to auto-reboot the engine seamlessly.

### C. Assert Rewriting for Rich Test Diagnostics
Standard `assert a == b` statements only raise an empty `AssertionError`. Our Python compiler parses test case ASTs via `_AssertRewriter` and transforms them to:
```python
__pypath_assert_eq(actual, expected, "<expression>", message)
```
This produces structured diffs reporting both the expected and actual values (e.g., `Expected $0.00, but got $7.99`) without cluttering the learner's editor.

---

## 4. State Management & Offline-First Persistence

PyPath uses a 3-tier state hierarchy designed for instant startup and zero data loss:

1. **Synchronous Local Layer (MMKV + Zustand)**:
   - All state mutations (`progressStore.ts`, `draftStore.ts`, `settingsStore.ts`) persist to MMKV synchronously via `react-native-mmkv`.
   - App cold starts require 0ms hydration delay. Code drafts persist on every keystroke (debounced 400ms).
2. **Causal Outbox Event Queue**:
   - Any state change that affects cloud data (XP awarded, challenge attempt, lesson completed, quiz answer) appends a cryptographically-tagged event to `progressStore.outbox`.
3. **Background Sync Service (`src/services/sync.ts`)**:
   - Runs periodically or on network reconnect.
   - Drains events sequentially to Supabase Postgres via RPC and RLS policies.
   - If the device is offline, events accumulate safely in MMKV and drain once reconnected.

---

## 5. Humanized Error Messages Architecture

Raw Python tracebacks frustrate beginners. PyPath intercepts all exceptions before they reach the UI and routes them through `src/engine/errorHumanizer.ts`.

- **AST-Level Introspection**: When an `IndexError` occurs, the Python runner inspects the failing stack frame:
  - Determines the list variable name (`scores`)
  - Evaluates the requested index (`5`)
  - Evaluates the sequence length (`4`)
- **Humanized Translation**:
  - *Raw*: `IndexError: list index out of range`
  - *PyPath*: `That list isn't that long`
  - *Explanation*: `You tried to access the 6th item of scores (index 5), but the list only has 4 items!`
  - *Actionable Hint*: `Python counts from 0, so valid indexes are 0 to 3. Use scores[-1] for the last item.`
  - *Quick Reference Link*: Deep links directly to the `lists` section in the Cheat Sheet.
