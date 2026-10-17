import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CodeEditor, type CodeEditorHandle } from '@/components/editor/CodeEditor';
import { usePythonEngine, usePythonRun } from '@/engine';
import { feedback } from '@/lib/feedback';
import { useDraftStore } from '@/stores/draftStore';
import { levelForXp, useProgressStore } from '@/stores/progressStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, spacing } from '@/theme';
import type { CodeChallenge, Lesson } from '@/types/curriculum';
import { OutputPanel } from './OutputPanel';

interface Props {
  lesson: Lesson;
  challenge: CodeChallenge;
}

const SOLUTION_UNLOCK_ATTEMPTS = 3;

/**
 * Split-screen challenge UI:
 *   top    – goal, requirements checklist, hints (collapsible while coding)
 *   middle – CodeMirror editor + accessory bar
 *   bottom – Run / Submit toolbar and the Output/Tests/Explain panel
 */
export function CodeLabScreen({ lesson, challenge }: Props) {
  const engine = usePythonEngine();
  const { running, liveOutput, result, run } = usePythonRun();
  const editorRef = useRef<CodeEditorHandle>(null);

  const draft = useDraftStore((s) => s.drafts[challenge.id]?.code);
  const saveDraft = useDraftStore((s) => s.saveDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const hintsRevealed = useDraftStore((s) => s.hintsRevealed[challenge.id] ?? 0);
  const revealHint = useDraftStore((s) => s.revealHint);
  const attempts = useProgressStore((s) => s.attemptsByChallenge[challenge.id] ?? 0);
  const recordAttempt = useProgressStore((s) => s.recordChallengeAttempt);
  const { editorFontSize, lineWrapping } = useSettingsStore();

  const [code, setCode] = useState(draft ?? challenge.starterCode);
  const [briefCollapsed, setBriefCollapsed] = useState(false);
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [solutionShown, setSolutionShown] = useState(false);

  // Warm heavy packages (pandas, bs4…) while the learner reads the brief.
  useEffect(() => {
    if (challenge.packages?.length) void engine.preload(challenge.packages);
    feedback.preload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id]);

  // Debounced draft persistence (MMKV is sync, but avoid a write per keystroke).
  useEffect(() => {
    const t = setTimeout(() => saveDraft(challenge.id, code), 400);
    return () => clearTimeout(t);
  }, [code, challenge.id, saveDraft]);

  const hintCost = useMemo(
    () => challenge.hints.slice(0, hintsRevealed).reduce((sum, h) => sum + h.xpCost, 0),
    [challenge.hints, hintsRevealed],
  );

  const baseRequest = useCallback(
    () => ({
      code: editorRef.current?.getValue() ?? code,
      files: challenge.files,
      packages: challenge.packages,
      timeoutMs: challenge.limits?.timeoutMs,
      maxOutputChars: challenge.limits?.maxOutputChars,
    }),
    [code, challenge],
  );

  const onRun = useCallback(async () => {
    if (running) return;
    setPanelOpen(true);
    setBriefCollapsed(true);
    const res = await run({ ...baseRequest(), mode: 'run', stdin: challenge.sampleStdin });
    setErrorLine(res.error?.line ?? null);
    if (res.error) feedback.error();
  }, [running, run, baseRequest, challenge.sampleStdin]);

  const onSubmit = useCallback(async () => {
    if (running) return;
    setPanelOpen(true);
    setBriefCollapsed(true);
    const levelBefore = levelForXp(useProgressStore.getState().xp).level;
    const res = await run({ ...baseRequest(), mode: 'test', stdin: challenge.sampleStdin, tests: challenge.tests });

    const passedCount = res.tests.filter((t) => t.passed).length;
    const scorePct = res.tests.length ? Math.round((passedCount / res.tests.length) * 100) : 0;
    const firstError = res.error ?? res.tests.find((t) => t.error)?.error ?? null;
    setErrorLine(firstError?.line ?? null);

    const { xpAwarded, firstCompletion } = recordAttempt({
      challengeId: challenge.id,
      lessonId: lesson.id,
      passed: res.ok,
      scorePct,
      concepts: challenge.concepts,
      errorType: firstError?.type ?? (res.ok ? null : 'TestFailure'),
      hintsUsed: hintsRevealed,
      xpReward: Math.max(0, challenge.xpReward - hintCost),
    });

    if (res.ok) {
      feedback.success();
      if (levelForXp(useProgressStore.getState().xp).level > levelBefore) feedback.levelUp();
      clearDraft(challenge.id);
      Alert.alert(
        'All tests passed! 🎉',
        firstCompletion ? `+${xpAwarded} XP${attempts === 0 ? ' (first-try bonus!)' : ''}` : 'Already completed — great practice.',
        [{ text: 'Continue', onPress: () => router.back() }],
      );
    } else if (firstError) {
      feedback.error();
    } else {
      feedback.partial();
    }
  }, [running, run, baseRequest, challenge, lesson.id, recordAttempt, hintsRevealed, hintCost, attempts, clearDraft]);

  const onReset = useCallback(() => {
    Alert.alert('Reset code?', 'Your changes to this challenge will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setCode(challenge.starterCode);
          setErrorLine(null);
          clearDraft(challenge.id);
        },
      },
    ]);
  }, [challenge, clearDraft]);

  const onHint = useCallback(() => {
    const next = challenge.hints[hintsRevealed];
    if (!next) return;
    Alert.alert('Reveal a hint?', `This costs ${next.xpCost} XP from the challenge reward.`, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Reveal', onPress: () => { revealHint(challenge.id); setBriefCollapsed(false); } },
    ]);
  }, [challenge, hintsRevealed, revealHint]);

  const onShowSolution = useCallback(() => {
    Alert.alert('Load the reference solution?', 'You won’t earn XP for this challenge, but you can study and run it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Show solution', onPress: () => { setSolutionShown(true); setCode(challenge.solution); } },
    ]);
  }, [challenge.solution]);

  const engineBusy = engine.status !== 'ready';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {/* ── Brief ─────────────────────────────────────────────────────── */}
        <Pressable onPress={() => setBriefCollapsed((v) => !v)} style={styles.briefHeader} accessibilityRole="button">
          <Text style={styles.title} numberOfLines={1}>{challenge.title}</Text>
          <Text style={styles.meta}>{'●'.repeat(challenge.difficulty)}{'○'.repeat(5 - challenge.difficulty)}  ·  {challenge.xpReward - hintCost} XP  {briefCollapsed ? '▾' : '▴'}</Text>
        </Pressable>
        {!briefCollapsed && (
          <ScrollView style={styles.brief} contentContainerStyle={styles.briefContent}>
            <Markdown style={markdownStyles}>{challenge.prompt}</Markdown>
            {challenge.requirements.map((r, i) => {
              const ok = result?.ok === true;
              return (
                <Text key={i} style={styles.requirement}>
                  {ok ? '✅' : '◻️'}  {r.replace(/`/g, '')}
                </Text>
              );
            })}
            {challenge.hints.slice(0, hintsRevealed).map((h, i) => (
              <View key={i} style={styles.hintBox}>
                <Text style={styles.hintLabel}>Hint {i + 1}</Text>
                <Markdown style={markdownStyles}>{h.text}</Markdown>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── Editor ────────────────────────────────────────────────────── */}
        <CodeEditor
          ref={editorRef}
          value={code}
          onChange={setCode}
          errorLine={errorLine}
          fontSize={editorFontSize}
          lineWrapping={lineWrapping}
          accessoryKeys={challenge.accessoryKeys}
          onRunShortcut={onRun}
          onFocusChange={(focused) => focused && setBriefCollapsed(true)}
          style={styles.editor}
        />

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <View style={styles.toolbar}>
          <ToolButton label="↺" a11y="Reset code" onPress={onReset} />
          <ToolButton label="💡" a11y="Reveal hint" onPress={onHint} disabled={hintsRevealed >= challenge.hints.length} />
          {attempts >= SOLUTION_UNLOCK_ATTEMPTS && <ToolButton label="🔑" a11y="Show solution" onPress={onShowSolution} />}
          <ToolButton label={panelOpen ? '▾' : '▴'} a11y="Toggle output panel" onPress={() => setPanelOpen((v) => !v)} />
          <View style={styles.spacer} />
          {engineBusy && <Text style={styles.engineStatus}>{engine.status === 'error' ? 'Engine error' : 'Starting Python…'}</Text>}
          {engine.status === 'error' && <ToolButton label="⟳" a11y="Restart engine" onPress={engine.restart} />}
          <Pressable onPress={onRun} disabled={running} style={({ pressed }) => [styles.runBtn, pressed && styles.pressed, running && styles.disabled]} accessibilityRole="button" accessibilityLabel="Run code">
            <Text style={styles.runText}>{running ? '…' : '▶ Run'}</Text>
          </Pressable>
          <Pressable onPress={onSubmit} disabled={running} style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed, running && styles.disabled]} accessibilityRole="button" accessibilityLabel="Submit and run tests">
            <Text style={styles.submitText}>✓ Submit</Text>
          </Pressable>
        </View>

        {panelOpen && (
          <View style={styles.panel}>
            <OutputPanel
              running={running}
              liveOutput={liveOutput}
              result={result}
              tests={challenge.tests}
              source={code}
              onJumpToLine={(line) => {
                setErrorLine(line);
                editorRef.current?.focus();
              }}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ToolButton({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={6} style={({ pressed }) => [styles.tool, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  code_inline: { backgroundColor: colors.key, color: colors.primary, borderRadius: 4, paddingHorizontal: 4 },
  fence: { backgroundColor: colors.editorBg, color: colors.text, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm },
  strong: { color: colors.text, fontWeight: '700' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  briefHeader: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  brief: { maxHeight: '42%', backgroundColor: colors.surface },
  briefContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  requirement: { color: colors.text, marginTop: spacing.xs, lineHeight: 20 },
  hintBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(255,212,59,0.08)', borderWidth: 1, borderColor: 'rgba(255,212,59,0.3)' },
  hintLabel: { color: colors.primary, fontWeight: '700', marginBottom: spacing.xs },
  editor: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surfaceAlt },
  tool: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.key, alignItems: 'center', justifyContent: 'center' },
  toolText: { color: colors.text, fontSize: 16 },
  spacer: { flex: 1 },
  engineStatus: { color: colors.textMuted, fontSize: 11 },
  runBtn: { paddingHorizontal: spacing.lg, height: 38, borderRadius: radius.sm, backgroundColor: colors.secondary, justifyContent: 'center' },
  runText: { color: '#fff', fontWeight: '700' },
  submitBtn: { paddingHorizontal: spacing.lg, height: 38, borderRadius: radius.sm, backgroundColor: colors.primary, justifyContent: 'center' },
  submitText: { color: '#1A1A1A', fontWeight: '800' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.4 },
  panel: { height: '38%' },
});
