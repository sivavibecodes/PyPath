/**
 * Python harness executed inside Pyodide (in the headless engine WebView).
 *
 * Responsibilities:
 *  - compile learner code as `main.py` (top-level await allowed, `asyncio.run(...)` rewritten)
 *  - capture stdout/stderr with a hard character budget and ~50ms streaming batches
 *  - feed stdin to `input()`
 *  - enforce a *soft* timeout via a sys.settrace watchdog (catches `while True:` loops)
 *  - run stdout / assert test cases, each in a fresh namespace
 *  - produce structured, sandbox-free tracebacks plus introspected context
 *    (index/length for IndexError, available keys for KeyError, "did you mean")
 *  - export matplotlib figures as base64 PNGs
 *
 * The *hard* timeout (e.g. a C-level infinite loop) is enforced by the RN host,
 * which destroys and re-creates the WebView.
 *
 * NOTE: kept as String.raw so Python escape sequences survive. Never use
 * backticks or the dollar-brace sequence inside this source.
 */
export const PYTHON_RUNNER_SOURCE = String.raw`
import ast, base64, builtins, difflib, importlib, inspect, io, json, linecache, os, re, sys, time, traceback, warnings

os.environ.setdefault("MPLBACKEND", "Agg")
warnings.filterwarnings("ignore", message=".*non-interactive.*")

SANDBOX_HOME = "/home/pyodide"
USER_FILE = "<main.py>"
TEST_FILE = "<test>"
_BLOCKED = {"js", "pyodide_js", "pyodide", "_pyodide", "micropip", "pyodide_http"}
_MAX_ACTUAL = 2000

os.makedirs(SANDBOX_HOME, exist_ok=True)
os.chdir(SANDBOX_HOME)
if SANDBOX_HOME not in sys.path:
    sys.path.insert(0, SANDBOX_HOME)


class PyPathTimeout(BaseException):
    """BaseException so learner 'except Exception' blocks cannot swallow it."""


class PyPathOutputLimit(BaseException):
    pass


class PyPathAssertion(AssertionError):
    def __init__(self, message, expected=None, actual=None):
        super().__init__(message)
        self.expected = expected
        self.actual = actual


# ── Import guard: learner code may not reach the JS bridge ────────────────────
_real_import = builtins.__import__


def _guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level == 0 and globals is not None and globals.get("__pypath_user__") and name.split(".")[0] in _BLOCKED:
        raise ModuleNotFoundError("No module named '%s' (not available in the PyPath sandbox)" % name, name=name)
    return _real_import(name, globals, locals, fromlist, level)


builtins.__import__ = _guarded_import


# ── Output capture ────────────────────────────────────────────────────────────
class _Budget:
    __slots__ = ("remaining", "truncated")

    def __init__(self, limit):
        self.remaining = limit
        self.truncated = False


class _Capture(io.TextIOBase):
    def __init__(self, name, budget, emit):
        self.name = name
        self._budget = budget
        self._emit = emit
        self._parts = []
        self._pending = []
        self._pending_len = 0
        self._last_emit = time.monotonic()

    def writable(self):
        return True

    def isatty(self):
        return False

    def write(self, s):
        if not isinstance(s, str):
            raise TypeError("write() argument must be str, not %s" % type(s).__name__)
        n = len(s)
        if n == 0:
            return 0
        room = self._budget.remaining
        if n > room:
            s = s[:room]
            self._budget.truncated = True
        self._budget.remaining -= len(s)
        if s:
            self._parts.append(s)
            if self._emit is not None:
                self._pending.append(s)
                self._pending_len += len(s)
                now = time.monotonic()
                if self._pending_len >= 2048 or now - self._last_emit >= 0.05:
                    self.flush()
        if self._budget.truncated:
            raise PyPathOutputLimit()
        return n

    def flush(self):
        if self._emit is not None and self._pending:
            chunk = "".join(self._pending)
            self._pending = []
            self._pending_len = 0
            self._last_emit = time.monotonic()
            try:
                self._emit(self.name, chunk)
            except Exception:
                pass

    def getvalue(self):
        return "".join(self._parts)


# ── Soft-timeout watchdog ─────────────────────────────────────────────────────
def _install_watchdog(deadline):
    counter = [0]

    def local_trace(frame, event, arg):
        counter[0] += 1
        if (counter[0] & 0x3FF) == 0 and time.monotonic() > deadline:
            raise PyPathTimeout()
        return local_trace

    def global_trace(frame, event, arg):
        counter[0] += 1
        if (counter[0] & 0xFF) == 0 and time.monotonic() > deadline:
            raise PyPathTimeout()
        # Only line-trace learner code: keeps pandas/numpy at full speed.
        fname = frame.f_code.co_filename
        return local_trace if (fname == USER_FILE or fname == TEST_FILE) else None

    sys.settrace(global_trace)


# ── Compilation ───────────────────────────────────────────────────────────────
def _is_asyncio_run(call):
    f = call.func
    return (
        isinstance(call, ast.Call)
        and isinstance(f, ast.Attribute)
        and f.attr == "run"
        and isinstance(f.value, ast.Name)
        and f.value.id == "asyncio"
        and len(call.args) == 1
    )


def _rewrite_block(body):
    """asyncio.run(x) cannot block in the browser event loop -> rewrite to 'await x'."""
    for stmt in body:
        if isinstance(stmt, (ast.Expr, ast.Assign, ast.AnnAssign)) and stmt.value is not None and _is_asyncio_run(stmt.value):
            stmt.value = ast.copy_location(ast.Await(value=stmt.value.args[0]), stmt.value)
        elif isinstance(stmt, ast.If):
            _rewrite_block(stmt.body)
            _rewrite_block(stmt.orelse)
        elif isinstance(stmt, ast.Try):
            _rewrite_block(stmt.body)


class _AssertRewriter(ast.NodeTransformer):
    """assert a == b, msg  ->  __pypath_assert_eq(a, b, "<source>", msg)"""

    def __init__(self, source):
        self.source = source

    def visit_Assert(self, node):
        t = node.test
        if isinstance(t, ast.Compare) and len(t.ops) == 1 and isinstance(t.ops[0], ast.Eq):
            src = ast.get_source_segment(self.source, node) or "assert"
            call = ast.Call(
                func=ast.Name(id="__pypath_assert_eq", ctx=ast.Load()),
                args=[t.left, t.comparators[0], ast.Constant(src), node.msg or ast.Constant(None)],
                keywords=[],
            )
            return ast.copy_location(ast.Expr(value=call), node)
        return node


def _assert_eq(actual, expected, source, msg=None):
    if actual == expected:
        return
    if isinstance(actual, float) and isinstance(expected, (int, float)) and abs(actual - expected) < 1e-9:
        return
    raise PyPathAssertion(msg or ("%s  ->  expected %r, got %r" % (source, expected, actual)), repr(expected), repr(actual))


def _register_source(filename, source):
    linecache.cache[filename] = (len(source), None, source.splitlines(True), filename)


def _compile(source, filename, rewrite_asserts=False):
    tree = ast.parse(source, filename=filename, mode="exec")
    _rewrite_block(tree.body)
    if rewrite_asserts:
        tree = _AssertRewriter(source).visit(tree)
    ast.fix_missing_locations(tree)
    code = compile(tree, filename, "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT, dont_inherit=True)
    _register_source(filename, source)
    return tree, code


async def _exec(code, ns):
    result = eval(code, ns)
    if inspect.iscoroutine(result):
        await result


# ── Error description & introspection ─────────────────────────────────────────
_SAFE_NODES = (
    ast.Expression, ast.Name, ast.Load, ast.Constant, ast.Attribute, ast.Subscript,
    ast.BinOp, ast.UnaryOp, ast.operator, ast.unaryop, ast.Tuple,
)


def _safe_eval(node, frame):
    for n in ast.walk(node):
        if not isinstance(n, _SAFE_NODES):
            raise ValueError("unsafe")
    expr = ast.Expression(body=node)
    ast.fix_missing_locations(expr)
    return eval(compile(expr, "<pypath-introspect>", "eval"), frame.f_globals, dict(frame.f_locals))


def _last_user_tb(tb):
    found = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == USER_FILE:
            found = tb
        tb = tb.tb_next
    return found


def _subscripts_on_line(tree, lineno):
    out = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Subscript) and node.lineno <= lineno <= (node.end_lineno or node.lineno):
            out.append(node)
    return out


def _index_context(tree, frame, lineno):
    for node in _subscripts_on_line(tree, lineno):
        try:
            seq = _safe_eval(node.value, frame)
            idx = _safe_eval(node.slice, frame)
        except Exception:
            continue
        if isinstance(idx, bool) or not isinstance(idx, int) or isinstance(seq, dict):
            continue
        try:
            n = len(seq)
        except Exception:
            continue
        if not (-n <= idx < n):
            return {"target": ast.unparse(node.value), "index": idx, "length": n, "container": type(seq).__name__}
    return {}


def _key_context(exc, tree, frame, lineno):
    key = exc.args[0] if exc.args else None
    for node in _subscripts_on_line(tree, lineno):
        try:
            mapping = _safe_eval(node.value, frame)
        except Exception:
            continue
        if isinstance(mapping, dict) and key not in mapping:
            keys = list(mapping.keys())
            ctx = {"target": ast.unparse(node.value), "key": repr(key), "availableKeys": [repr(k) for k in keys[:8]]}
            if isinstance(key, str):
                close = difflib.get_close_matches(key, [k for k in keys if isinstance(k, str)], n=1)
                if close:
                    ctx["suggestion"] = repr(close[0])
            return ctx
    return {"key": repr(key)} if exc.args else {}


def _context_for(exc, tree, ns):
    ctx = {}
    tb = _last_user_tb(exc.__traceback__)
    frame = tb.tb_frame if tb else None
    lineno = tb.tb_lineno if tb else None
    if isinstance(exc, IndexError) and frame is not None and tree is not None:
        ctx.update(_index_context(tree, frame, lineno))
    elif isinstance(exc, KeyError) and frame is not None and tree is not None:
        ctx.update(_key_context(exc, tree, frame, lineno))
    elif isinstance(exc, NameError) and not isinstance(exc, UnboundLocalError) and getattr(exc, "name", None):
        pool = set(dir(builtins))
        if ns:
            pool.update(k for k in ns if not k.startswith("__"))
        if frame is not None:
            pool.update(frame.f_locals.keys())
        close = difflib.get_close_matches(exc.name, sorted(pool), n=1, cutoff=0.7)
        if close:
            ctx["suggestion"] = close[0]
    elif isinstance(exc, AttributeError) and getattr(exc, "name", None):
        obj = getattr(exc, "obj", None)
        if obj is not None:
            ctx["targetType"] = type(obj).__name__
            close = difflib.get_close_matches(exc.name, [a for a in dir(obj) if not a.startswith("_")], n=1)
            if close:
                ctx["suggestion"] = close[0]
    elif isinstance(exc, ModuleNotFoundError) and getattr(exc, "name", None):
        ctx["module"] = exc.name
    return ctx


def _describe(exc, tree=None, ns=None):
    etype = type(exc).__name__
    info = {"type": etype, "message": str(exc), "line": None, "column": None, "traceback": [], "formatted": "", "context": {}}

    if isinstance(exc, SyntaxError):
        info["message"] = exc.msg or str(exc)
        if exc.filename in (USER_FILE, TEST_FILE):
            info["line"] = exc.lineno if exc.filename == USER_FILE else None
            info["column"] = exc.offset
        formatted = "".join(traceback.format_exception_only(type(exc), exc))
        info["formatted"] = formatted.replace('File "<main.py>"', 'File "main.py"')
        return info

    frames = []
    for fs in traceback.extract_tb(exc.__traceback__):
        if fs.filename in (USER_FILE, TEST_FILE):
            frames.append({
                "file": "main.py" if fs.filename == USER_FILE else "test",
                "line": fs.lineno,
                "function": None if fs.name == "<module>" else fs.name,
                "code": fs.line or None,
                "_col": getattr(fs, "colno", None),
            })
    user_frames = [f for f in frames if f["file"] == "main.py"]
    if user_frames:
        info["line"] = user_frames[-1]["line"]
        col = user_frames[-1]["_col"]
        info["column"] = (col + 1) if isinstance(col, int) else None

    lines = []
    if frames:
        lines.append("Traceback (most recent call last):")
        for f in frames:
            where = (" in " + f["function"]) if f["function"] else ""
            lines.append('  File "%s", line %d%s' % (f["file"], f["line"], where))
            if f["code"]:
                lines.append("    " + f["code"])
    lines.append("".join(traceback.format_exception_only(type(exc), exc)).rstrip())
    info["formatted"] = "\n".join(lines)
    for f in frames:
        f.pop("_col", None)
    info["traceback"] = frames

    try:
        info["context"] = _context_for(exc, tree, ns)
    except Exception:
        info["context"] = {}
    return info


def _pseudo_error(etype, message):
    return {"type": etype, "message": message, "line": None, "column": None, "traceback": [], "formatted": etype + ": " + message, "context": {}}


# ── Sandbox filesystem ────────────────────────────────────────────────────────
def _write_files(files):
    for f in files or []:
        rel = os.path.normpath(str(f.get("path", ""))).lstrip("/")
        if not rel or rel.startswith("..") or os.path.isabs(rel):
            raise ValueError("Illegal virtual file path: %r" % f.get("path"))
        full = os.path.join(SANDBOX_HOME, rel)
        os.makedirs(os.path.dirname(full) or SANDBOX_HOME, exist_ok=True)
        if f.get("encoding") == "base64":
            with open(full, "wb") as fh:
                fh.write(base64.b64decode(f.get("content", "")))
        else:
            with open(full, "w", encoding="utf-8", newline="") as fh:
                fh.write(f.get("content", ""))


def _forget_user_modules():
    """Drop modules imported from the sandbox dir so edited helper files reload."""
    for name, mod in list(sys.modules.items()):
        path = getattr(mod, "__file__", None) or ""
        if path.startswith(SANDBOX_HOME):
            del sys.modules[name]
    importlib.invalidate_caches()


def _collect_figures():
    plt = sys.modules.get("matplotlib.pyplot")
    if plt is None:
        return []
    images = []
    try:
        for num in plt.get_fignums()[:4]:
            fig = plt.figure(num)
            buf = io.BytesIO()
            fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")
            images.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    finally:
        plt.close("all")
    return images


# ── Execution ─────────────────────────────────────────────────────────────────
async def _run_once(code, tree, stdin_text, timeout_s, max_chars, emit=None, post_code=None):
    ns = {"__name__": "__main__", "__builtins__": builtins, "__file__": "main.py", "__pypath_user__": True,
          "__pypath_assert_eq": _assert_eq}
    budget = _Budget(max_chars)
    out = _Capture("stdout", budget, emit)
    err = _Capture("stderr", budget, emit)
    saved = (sys.stdout, sys.stderr, sys.stdin)
    sys.stdout, sys.stderr, sys.stdin = out, err, io.StringIO(stdin_text or "")
    caught = None
    phase = "user"
    started = time.monotonic()
    _install_watchdog(started + timeout_s)
    try:
        await _exec(code, ns)
        if post_code is not None:
            phase = "test"
            await _exec(post_code, ns)
    except BaseException as e:  # noqa: BLE001 - we classify below
        caught = e
    finally:
        sys.settrace(None)
        try:
            out.flush()
            err.flush()
        except BaseException:
            pass
        sys.stdout, sys.stderr, sys.stdin = saved

    error = None
    timed_out = False
    assertion = None
    if caught is not None:
        if isinstance(caught, PyPathTimeout):
            timed_out = True
            error = _pseudo_error("PyPathTimeout", "Execution exceeded %.1f seconds" % timeout_s)
        elif isinstance(caught, PyPathOutputLimit):
            error = _pseudo_error("PyPathOutputLimit", "Output exceeded %d characters" % max_chars)
        elif isinstance(caught, SystemExit) and caught.code in (None, 0):
            error = None
        elif phase == "test" and isinstance(caught, AssertionError):
            assertion = caught
        else:
            error = _describe(caught, tree, ns)

    return {
        "stdout": out.getvalue(),
        "stderr": err.getvalue(),
        "error": error,
        "assertion": assertion,
        "timedOut": timed_out,
        "truncated": budget.truncated,
        "durationMs": int((time.monotonic() - started) * 1000),
    }


def _norm(s):
    return "\n".join(line.rstrip() for line in s.replace("\r\n", "\n").strip("\n").split("\n"))


def _stdout_matches(mode, actual, expected):
    if mode == "exact":
        return actual == expected
    if mode == "trimmed":
        return _norm(actual) == _norm(expected)
    if mode == "contains":
        return _norm(expected) in _norm(actual)
    if mode == "regex":
        return re.search(expected, actual, re.MULTILINE) is not None
    if mode == "lines_unordered":
        return sorted(_norm(actual).split("\n")) == sorted(_norm(expected).split("\n"))
    raise ValueError("Unknown match mode: %r" % mode)


async def _run_test(test, code, tree, timeout_s, max_chars):
    base = {"id": test["id"], "name": test["name"], "hidden": bool(test.get("hidden")), "kind": test["kind"],
            "passed": False, "error": None, "stdout": "", "durationMs": 0}
    post = None
    if test["kind"] == "assert":
        try:
            _, post = _compile(test["code"], TEST_FILE, rewrite_asserts=True)
        except SyntaxError as e:
            base["error"] = _pseudo_error("TestDefinitionError", "Broken test case: %s" % e)
            return base
    r = await _run_once(code, tree, test.get("stdin", ""), timeout_s, max_chars, emit=None, post_code=post)
    base["stdout"] = r["stdout"][:_MAX_ACTUAL]
    base["durationMs"] = r["durationMs"]
    if r["error"] is not None:
        base["error"] = r["error"]
        return base
    if test["kind"] == "assert":
        a = r["assertion"]
        if a is None:
            base["passed"] = True
        else:
            base["message"] = str(a) or "Assertion failed"
            if isinstance(a, PyPathAssertion):
                base["expected"] = (a.expected or "")[:_MAX_ACTUAL]
                base["actual"] = (a.actual or "")[:_MAX_ACTUAL]
        return base
    # stdout test
    expected = test["expected"]
    base["passed"] = _stdout_matches(test.get("match", "trimmed"), r["stdout"], expected)
    if not base["passed"]:
        base["expected"] = expected[:_MAX_ACTUAL]
        base["actual"] = r["stdout"][:_MAX_ACTUAL]
        base["message"] = "Output did not match"
    return base


async def pypath_run(payload_json, emit=None):
    t0 = time.monotonic()
    req = json.loads(payload_json)
    source = req.get("code", "")
    timeout_s = max(0.5, min(float(req.get("timeoutMs") or 5000), 60000.0) / 1000.0)
    max_chars = int(req.get("maxOutputChars") or 65536)
    tests = (req.get("tests") or []) if req.get("mode") == "test" else []

    result = {"ok": False, "stdout": "", "stderr": "", "error": None, "images": [], "truncated": False,
              "timedOut": False, "tests": [], "durationMs": 0}

    try:
        _forget_user_modules()
        _write_files(req.get("files"))
    except Exception as e:
        result["error"] = _pseudo_error("SandboxSetupError", str(e))
        return json.dumps(result)

    try:
        tree, code = _compile(source, USER_FILE)
    except (SyntaxError, ValueError) as e:
        err = _describe(e) if isinstance(e, SyntaxError) else _pseudo_error("SyntaxError", str(e))
        result["error"] = err
        result["tests"] = [{"id": t["id"], "name": t["name"], "hidden": bool(t.get("hidden")), "kind": t["kind"],
                            "passed": False, "error": err, "stdout": "", "durationMs": 0} for t in tests]
        result["durationMs"] = int((time.monotonic() - t0) * 1000)
        return json.dumps(result)

    main = await _run_once(code, tree, req.get("stdin", ""), timeout_s, max_chars, emit=emit)
    result.update({k: main[k] for k in ("stdout", "stderr", "error", "truncated", "timedOut")})
    try:
        result["images"] = _collect_figures()
    except Exception as e:
        result["stderr"] += "\n[PyPath] Could not render figure: %s" % e

    for t in tests:
        result["tests"].append(await _run_test(t, code, tree, timeout_s, max_chars))

    result["ok"] = result["error"] is None and all(t["passed"] for t in result["tests"])
    result["durationMs"] = int((time.monotonic() - t0) * 1000)
    return json.dumps(result)
`;
