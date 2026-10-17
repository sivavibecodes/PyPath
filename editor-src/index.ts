/**
 * CodeMirror 6 editor bundled (scripts/build-editor.mjs → IIFE) and inlined into
 * the editor WebView. Talks to React Native via:
 *   RN → editor : window.__editor.exec(command)      (injectJavaScript)
 *   editor → RN : window.ReactNativeWebView.postMessage(JSON)
 *
 * Mobile-specific tuning: autocorrect/autocapitalize/spellcheck disabled (iOS
 * would otherwise type "Print" and smart quotes), 4-space indents, line
 * wrapping for narrow screens, larger touch-friendly gutters.
 */
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore, redo, undo, cursorCharLeft, cursorCharRight, cursorLineDown, cursorLineUp } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorSelection, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

type Command =
  | { type: 'setValue'; value: string }
  | { type: 'insert'; text: string }
  | { type: 'wrap'; open: string; close: string }
  | { type: 'snippet'; template: string }
  | { type: 'indent' }
  | { type: 'dedent' }
  | { type: 'cursor'; dir: 'left' | 'right' | 'up' | 'down' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'setErrorLine'; line: number | null }
  | { type: 'setReadOnly'; readOnly: boolean }
  | { type: 'setFontSize'; size: number }
  | { type: 'setLineWrapping'; enabled: boolean }
  | { type: 'focus' }
  | { type: 'blur' };

interface InitConfig {
  value: string;
  readOnly: boolean;
  fontSize: number;
  lineWrapping: boolean;
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(msg: string): void };
    __editorInit?: InitConfig;
    __editor?: { exec(cmd: Command): void };
  }
}

const post = (msg: Record<string, unknown>) => window.ReactNativeWebView?.postMessage(JSON.stringify(msg));

// ── Theme (matches src/theme/colors.ts) ─────────────────────────────────────
const palette = {
  bg: '#0F1420',
  gutter: '#0B0F18',
  text: '#E6EDF3',
  muted: '#5C6B82',
  activeLine: '#18202F',
  selection: '#2A4365',
  cursor: '#FFD43B',
  error: 'rgba(248, 81, 73, 0.18)',
};

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword], color: '#FF7AB2' },
  { tag: [t.string, t.special(t.string)], color: '#A5D6A7' },
  { tag: [t.number, t.bool, t.null], color: '#F8C555' },
  { tag: [t.comment, t.lineComment], color: '#6A7A91', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#79C0FF' },
  { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: '#D2A8FF' },
  { tag: [t.className, t.definition(t.className)], color: '#FFA657' },
  { tag: [t.self, t.standard(t.variableName)], color: '#56D4DD' },
  { tag: [t.operator, t.punctuation, t.bracket], color: '#C9D1D9' },
  { tag: t.propertyName, color: '#9CDCFE' },
]);

const fontSizeCompartment = new Compartment();
const wrapCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

const fontTheme = (size: number) =>
  EditorView.theme({
    '&': { fontSize: `${size}px` },
    '.cm-content, .cm-gutters': { fontSize: `${size}px` },
  });

const baseTheme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: palette.bg, color: palette.text },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, "Roboto Mono", monospace',
      lineHeight: '1.6',
      overscrollBehavior: 'contain',
    },
    '.cm-content': { caretColor: palette.cursor, padding: '8px 0 48px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: palette.cursor, borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: palette.selection },
    '.cm-gutters': { backgroundColor: palette.gutter, color: palette.muted, border: 'none', minWidth: '36px' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 6px' },
    '.cm-activeLine': { backgroundColor: palette.activeLine },
    '.cm-activeLineGutter': { backgroundColor: palette.activeLine, color: palette.text },
    '.cm-errorLine': { backgroundColor: palette.error, boxShadow: 'inset 3px 0 0 #F85149' },
    '.cm-matchingBracket': { backgroundColor: 'rgba(255, 212, 59, 0.18)', outline: 'none' },
    '.cm-tooltip': { backgroundColor: '#1B2333', border: '1px solid #2B3648', borderRadius: '8px' },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: palette.selection },
  },
  { dark: true },
);

// ── Error-line highlighting ─────────────────────────────────────────────────
const setErrorLine = StateEffect.define<number | null>();
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        if (e.value == null || e.value < 1 || e.value > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(e.value);
        return Decoration.set([Decoration.line({ class: 'cm-errorLine' }).range(line.from)]);
      }
    }
    // Clear the marker as soon as the learner edits.
    return tr.docChanged ? Decoration.none : deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ── Change reporting (debounced) ────────────────────────────────────────────
let changeTimer: ReturnType<typeof setTimeout> | null = null;
let view: EditorView;

function reportChange(immediate = false) {
  if (changeTimer) clearTimeout(changeTimer);
  const send = () => {
    changeTimer = null;
    post({ type: 'change', value: view.state.doc.toString() });
  };
  if (immediate) send();
  else changeTimer = setTimeout(send, 120);
}

const bridgeListener = EditorView.updateListener.of((u) => {
  if (u.docChanged) reportChange();
  if (u.focusChanged) {
    if (u.view.hasFocus) post({ type: 'focus' });
    else {
      reportChange(true);
      post({ type: 'blur' });
    }
  }
});

// ── Commands ────────────────────────────────────────────────────────────────
function currentIndent(): string {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  return /^\s*/.exec(line.text)?.[0] ?? '';
}

function insertText(text: string) {
  view.dispatch(view.state.replaceSelection(text), { scrollIntoView: true, userEvent: 'input.type' });
}

function wrap(open: string, close: string) {
  const tr = view.state.changeByRange((range) => {
    const selected = view.state.sliceDoc(range.from, range.to);
    return {
      changes: { from: range.from, to: range.to, insert: open + selected + close },
      range: range.empty
        ? EditorSelection.cursor(range.from + open.length)
        : EditorSelection.range(range.from + open.length, range.to + open.length),
    };
  });
  view.dispatch(tr, { scrollIntoView: true, userEvent: 'input.type' });
}

/** "${name} = " → inserts "name = " with "name" selected; extra lines inherit indentation. */
function snippet(template: string) {
  const indent = currentIndent();
  const withIndent = template.replace(/\n/g, `\n${indent}`);
  const match = /\$\{([^}]*)\}/.exec(withIndent);
  const text = withIndent.replace(/\$\{([^}]*)\}/g, '$1');
  const from = view.state.selection.main.from;
  const selStart = match ? from + match.index : from + text.length;
  const selEnd = match ? selStart + (match[1]?.length ?? 0) : selStart;
  view.dispatch({
    changes: { from, to: view.state.selection.main.to, insert: text },
    selection: EditorSelection.range(selStart, selEnd),
    scrollIntoView: true,
    userEvent: 'input.type',
  });
}

/** Mobile "Tab": insert spaces to the next 4-column stop, or indent selected lines. */
function indent() {
  const { state } = view;
  if (!state.selection.main.empty) return indentMore(view);
  const head = state.selection.main.head;
  const col = head - state.doc.lineAt(head).from;
  insertText(' '.repeat(4 - (col % 4)));
  return true;
}

function exec(cmd: Command) {
  switch (cmd.type) {
    case 'setValue':
      if (cmd.value !== view.state.doc.toString()) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: cmd.value } });
      }
      return;
    case 'insert':
      insertText(cmd.text);
      break;
    case 'wrap':
      wrap(cmd.open, cmd.close);
      break;
    case 'snippet':
      snippet(cmd.template);
      break;
    case 'indent':
      indent();
      break;
    case 'dedent':
      indentLess(view);
      break;
    case 'cursor':
      ({ left: cursorCharLeft, right: cursorCharRight, up: cursorLineUp, down: cursorLineDown })[cmd.dir](view);
      break;
    case 'undo':
      undo(view);
      break;
    case 'redo':
      redo(view);
      break;
    case 'setErrorLine':
      view.dispatch({ effects: setErrorLine.of(cmd.line) });
      if (cmd.line != null && cmd.line <= view.state.doc.lines) {
        const pos = view.state.doc.line(cmd.line).from;
        view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
      }
      return;
    case 'setReadOnly':
      view.dispatch({ effects: readOnlyCompartment.reconfigure(readOnlyExt(cmd.readOnly)) });
      return;
    case 'setFontSize':
      view.dispatch({ effects: fontSizeCompartment.reconfigure(fontTheme(cmd.size)) });
      return;
    case 'setLineWrapping':
      view.dispatch({ effects: wrapCompartment.reconfigure(cmd.enabled ? EditorView.lineWrapping : []) });
      return;
    case 'focus':
      view.focus();
      return;
    case 'blur':
      view.contentDOM.blur();
      return;
  }
  // Accessory keys must never steal focus from the editor.
  view.focus();
}

const readOnlyExt = (ro: boolean): Extension => [EditorState.readOnly.of(ro), EditorView.editable.of(!ro)];

// ── Boot ─────────────────────────────────────────────────────────────────────
function boot() {
  const init: InitConfig = window.__editorInit ?? { value: '', readOnly: false, fontSize: 14, lineWrapping: true };

  view = new EditorView({
    parent: document.getElementById('editor')!,
    state: EditorState.create({
      doc: init.value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ activateOnTyping: true, maxRenderedOptions: 8, icons: false }),
        python(),
        syntaxHighlighting(highlight),
        baseTheme,
        fontSizeCompartment.of(fontTheme(init.fontSize)),
        wrapCompartment.of(init.lineWrapping ? EditorView.lineWrapping : []),
        readOnlyCompartment.of(readOnlyExt(init.readOnly)),
        errorLineField,
        bridgeListener,
        EditorView.contentAttributes.of({
          autocapitalize: 'off',
          autocorrect: 'off',
          spellcheck: 'false',
          'data-gramm': 'false',
          'aria-label': 'Python code editor',
        }),
        keymap.of([
          // Hardware keyboards (iPad / Chromebook): Cmd/Ctrl+Enter runs code.
          { key: 'Mod-Enter', run: () => (post({ type: 'runShortcut' }), true) },
          { key: 'Tab', run: () => indent() },
          { key: 'Shift-Tab', run: indentLess },
          ...closeBracketsKeymap,
          ...completionKeymap,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
      ],
    }),
  });

  window.__editor = {
    exec(cmd) {
      try {
        exec(cmd);
      } catch (e) {
        post({ type: 'error', message: String(e) });
      }
    },
  };
  post({ type: 'ready' });
}

try {
  boot();
} catch (e) {
  post({ type: 'error', message: `Editor failed to start: ${String(e)}` });
}
