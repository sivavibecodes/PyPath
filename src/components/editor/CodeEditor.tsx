import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { feedback } from '@/lib/feedback';
import { colors } from '@/theme';
import type { AccessoryKeyId, EditorCommand, EditorEvent } from '@/types/editor';
import { AccessoryBar } from './AccessoryBar';
import { buildEditorHtml } from './editorHtml';

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** 1-based line to highlight (e.g. from a traceback). Cleared automatically on edit. */
  errorLine?: number | null;
  fontSize?: number;
  lineWrapping?: boolean;
  accessoryKeys?: AccessoryKeyId[];
  /** Cmd/Ctrl+Enter on hardware keyboards. */
  onRunShortcut?: () => void;
  onFocusChange?: (focused: boolean) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface CodeEditorHandle {
  focus(): void;
  blur(): void;
  exec(command: EditorCommand): void;
  /** Latest text, even if the debounced onChange hasn't fired yet. */
  getValue(): string;
}

/**
 * Touch-optimised Python editor: CodeMirror 6 inside a WebView, plus a native
 * accessory row shown while the editor has focus and the keyboard is up.
 *
 * Value flow is "uncontrolled with sync": the editor owns the document; RN gets
 * debounced `change` events and only pushes `setValue` when the prop diverges
 * from the last value the editor reported (e.g. "Reset code").
 */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    value,
    onChange,
    readOnly = false,
    errorLine = null,
    fontSize = 14,
    lineWrapping = true,
    accessoryKeys,
    onRunShortcut,
    onFocusChange,
    style,
    testID,
  },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const lastKnown = useRef(value);
  const [ready, setReady] = useState(false);
  const [focused, setFocused] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  // HTML is built once with the initial state; later changes go through commands.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildEditorHtml({ value, readOnly, fontSize, lineWrapping }), []);

  const exec = useCallback((command: EditorCommand) => {
    const literal = JSON.stringify(JSON.stringify(command)).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    webRef.current?.injectJavaScript(`window.__editor && window.__editor.exec(JSON.parse(${literal})); true;`);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => exec({ type: 'focus' }),
      blur: () => exec({ type: 'blur' }),
      exec,
      getValue: () => lastKnown.current,
    }),
    [exec],
  );

  // ── prop → editor sync ─────────────────────────────────────────────────────
  useEffect(() => {
    if (ready && value !== lastKnown.current) {
      lastKnown.current = value;
      exec({ type: 'setValue', value });
    }
  }, [value, ready, exec]);
  useEffect(() => {
    if (ready) exec({ type: 'setErrorLine', line: errorLine });
  }, [errorLine, ready, exec]);
  useEffect(() => {
    if (ready) exec({ type: 'setReadOnly', readOnly });
  }, [readOnly, ready, exec]);
  useEffect(() => {
    if (ready) exec({ type: 'setFontSize', size: fontSize });
  }, [fontSize, ready, exec]);
  useEffect(() => {
    if (ready) exec({ type: 'setLineWrapping', enabled: lineWrapping });
  }, [lineWrapping, ready, exec]);

  // ── keyboard visibility (Android back button hides keyboard without blur) ──
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // ── editor → RN ────────────────────────────────────────────────────────────
  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let msg: EditorEvent;
      try {
        msg = JSON.parse(e.nativeEvent.data) as EditorEvent;
      } catch {
        return;
      }
      switch (msg.type) {
        case 'ready':
          setReady(true);
          setBootError(null);
          break;
        case 'change':
          lastKnown.current = msg.value;
          onChange?.(msg.value);
          break;
        case 'focus':
          setFocused(true);
          onFocusChange?.(true);
          break;
        case 'blur':
          setFocused(false);
          onFocusChange?.(false);
          break;
        case 'runShortcut':
          onRunShortcut?.();
          break;
        case 'error':
          if (__DEV__) console.warn('[CodeEditor]', msg.message);
          if (!ready) setBootError(msg.message);
          break;
      }
    },
    [onChange, onFocusChange, onRunShortcut, ready],
  );

  const showBar = !readOnly && focused && keyboardUp;

  return (
    <View style={[styles.container, style]} testID={testID}>
      <WebView
        ref={webRef}
        source={{ html }}
        originWhitelist={['*']}
        onMessage={onMessage}
        style={styles.web}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        hideKeyboardAccessoryView // iOS: replace WKWebView's prev/next/done bar with ours
        keyboardDisplayRequiresUserAction={false}
        textZoom={100} // Android: ignore system font scaling; font size is a PyPath setting
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
        onContentProcessDidTerminate={() => webRef.current?.reload()}
        onRenderProcessGone={() => webRef.current?.reload()}
        accessibilityLabel="Python code editor"
      />
      {bootError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{bootError}</Text>
        </View>
      )}
      {showBar && <AccessoryBar keys={accessoryKeys} onCommand={exec} onKeyFeedback={feedback.tap} />}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.editorBg, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: colors.editorBg },
  errorOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.danger, textAlign: 'center' },
});
