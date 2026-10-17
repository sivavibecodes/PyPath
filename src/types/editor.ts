/** Keys available in the editor's touch accessory row. */
export type AccessoryKeyId =
  | 'tab'
  | 'dedent'
  | 'parens'
  | 'brackets'
  | 'braces'
  | 'dquote'
  | 'squote'
  | 'colon'
  | 'underscore'
  | 'equals'
  | 'comma'
  | 'dot'
  | 'hash'
  | 'print'
  | 'var'
  | 'def'
  | 'for'
  | 'if'
  | 'left'
  | 'right'
  | 'undo'
  | 'redo';

/** Commands RN sends into the CodeMirror WebView. */
export type EditorCommand =
  | { type: 'setValue'; value: string }
  | { type: 'insert'; text: string }
  | { type: 'wrap'; open: string; close: string }
  /** `${placeholder}` marks the text selected after insertion; multi-line snippets inherit indentation. */
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

/** Messages the CodeMirror WebView posts back to RN. */
export type EditorEvent =
  | { type: 'ready' }
  | { type: 'change'; value: string }
  | { type: 'focus' }
  | { type: 'blur' }
  | { type: 'runShortcut' }
  | { type: 'error'; message: string };
