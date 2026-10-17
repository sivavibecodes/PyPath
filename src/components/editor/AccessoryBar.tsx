import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/theme';
import type { AccessoryKeyId, EditorCommand } from '@/types/editor';

interface KeyDef {
  label: string;
  a11y: string;
  command: EditorCommand;
  /** Repeat while held (cursor keys). */
  repeat?: boolean;
  variant?: 'symbol' | 'word' | 'nav';
}

export const ACCESSORY_KEYS: Record<AccessoryKeyId, KeyDef> = {
  tab: { label: '⇥', a11y: 'Indent', command: { type: 'indent' }, variant: 'nav' },
  dedent: { label: '⇤', a11y: 'Outdent', command: { type: 'dedent' }, variant: 'nav' },
  left: { label: '←', a11y: 'Cursor left', command: { type: 'cursor', dir: 'left' }, repeat: true, variant: 'nav' },
  right: { label: '→', a11y: 'Cursor right', command: { type: 'cursor', dir: 'right' }, repeat: true, variant: 'nav' },
  parens: { label: '( )', a11y: 'Parentheses', command: { type: 'wrap', open: '(', close: ')' } },
  brackets: { label: '[ ]', a11y: 'Square brackets', command: { type: 'wrap', open: '[', close: ']' } },
  braces: { label: '{ }', a11y: 'Curly braces', command: { type: 'wrap', open: '{', close: '}' } },
  dquote: { label: '" "', a11y: 'Double quotes', command: { type: 'wrap', open: '"', close: '"' } },
  squote: { label: "' '", a11y: 'Single quotes', command: { type: 'wrap', open: "'", close: "'" } },
  colon: { label: ':', a11y: 'Colon', command: { type: 'insert', text: ':' } },
  underscore: { label: '_', a11y: 'Underscore', command: { type: 'insert', text: '_' } },
  equals: { label: '=', a11y: 'Equals', command: { type: 'insert', text: ' = ' } },
  comma: { label: ',', a11y: 'Comma', command: { type: 'insert', text: ', ' } },
  dot: { label: '.', a11y: 'Dot', command: { type: 'insert', text: '.' } },
  hash: { label: '#', a11y: 'Comment', command: { type: 'insert', text: '# ' } },
  print: { label: 'print', a11y: 'Insert print call', command: { type: 'snippet', template: 'print(${})' }, variant: 'word' },
  var: { label: 'var', a11y: 'Insert variable assignment', command: { type: 'snippet', template: '${name} = ' }, variant: 'word' },
  def: { label: 'def', a11y: 'Insert function', command: { type: 'snippet', template: 'def ${name}():\n    ' }, variant: 'word' },
  for: { label: 'for', a11y: 'Insert for loop', command: { type: 'snippet', template: 'for ${item} in :\n    ' }, variant: 'word' },
  if: { label: 'if', a11y: 'Insert if statement', command: { type: 'snippet', template: 'if ${condition}:\n    ' }, variant: 'word' },
  undo: { label: '↶', a11y: 'Undo', command: { type: 'undo' }, variant: 'nav' },
  redo: { label: '↷', a11y: 'Redo', command: { type: 'redo' }, variant: 'nav' },
};

export const DEFAULT_ACCESSORY_KEYS: AccessoryKeyId[] = [
  'tab', 'dedent', 'left', 'right', 'parens', 'brackets', 'dquote', 'colon', 'underscore',
  'equals', 'print', 'var', 'if', 'for', 'def', 'braces', 'squote', 'comma', 'dot', 'hash', 'undo', 'redo',
];

interface Props {
  keys?: AccessoryKeyId[];
  onCommand: (command: EditorCommand) => void;
  onKeyFeedback?: () => void;
}

const REPEAT_DELAY = 350;
const REPEAT_INTERVAL = 60;

const AccessoryKey = memo(function AccessoryKey({
  def,
  onCommand,
  onKeyFeedback,
}: {
  def: KeyDef;
  onCommand: Props['onCommand'];
  onKeyFeedback?: () => void;
}) {
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (delay.current) clearTimeout(delay.current);
    if (interval.current) clearInterval(interval.current);
    delay.current = interval.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const onPressIn = useCallback(() => {
    onKeyFeedback?.();
    onCommand(def.command);
    if (def.repeat) {
      delay.current = setTimeout(() => {
        interval.current = setInterval(() => onCommand(def.command), REPEAT_INTERVAL);
      }, REPEAT_DELAY);
    }
  }, [def, onCommand, onKeyFeedback]);

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={def.a11y}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [styles.key, def.variant === 'word' && styles.wordKey, pressed && styles.pressed]}
    >
      <Text style={[styles.label, def.variant === 'word' && styles.wordLabel, def.variant === 'nav' && styles.navLabel]}>
        {def.label}
      </Text>
    </Pressable>
  );
});

/** Horizontally scrollable row of coding keys pinned above the soft keyboard. */
export function AccessoryBar({ keys = DEFAULT_ACCESSORY_KEYS, onCommand, onKeyFeedback }: Props) {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.content}
    >
      {keys.map((id) => (
        <AccessoryKey key={id} def={ACCESSORY_KEYS[id]} onCommand={onCommand} onKeyFeedback={onKeyFeedback} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { flexGrow: 0, backgroundColor: colors.surfaceAlt, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  content: { paddingHorizontal: 6, paddingVertical: 6, gap: 6, alignItems: 'center' },
  key: {
    minWidth: 40,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.key,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordKey: { backgroundColor: colors.keyAccent },
  pressed: { backgroundColor: colors.keyPressed, transform: [{ scale: 0.95 }] },
  label: { color: colors.text, fontFamily: fonts.mono, fontSize: 16 },
  wordLabel: { fontSize: 14, color: colors.primary },
  navLabel: { fontSize: 18 },
});
