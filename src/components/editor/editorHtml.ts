import { EDITOR_BUNDLE } from './generated/editorBundle';

export interface EditorInit {
  value: string;
  readOnly: boolean;
  fontSize: number;
  lineWrapping: boolean;
}

const safeJson = (v: unknown) =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Self-contained editor page: no network, no file access. */
export function buildEditorHtml(init: EditorInit): string {
  const bundle = EDITOR_BUNDLE
    ? EDITOR_BUNDLE.replace(/<\/script/gi, '<\\/script')
    : `window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'Editor bundle missing. Run: npm run assets:editor'}));`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #0F1420; overflow: hidden;
    -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: transparent; }
  #editor { height: 100%; }
</style>
</head>
<body>
<div id="editor"></div>
<script>window.__editorInit = ${safeJson(init)};</script>
<script>${bundle}</script>
</body>
</html>`;
}
