import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { humanizeError } from '@/engine';
import { colors, fonts, radius, spacing } from '@/theme';
import type { TestCase } from '@/types/curriculum';
import type { RunResult } from '@/types/engine';

type Tab = 'output' | 'tests' | 'explain';

interface Props {
  running: boolean;
  liveOutput: string;
  result: RunResult | null;
  /** Test definitions — used to show failure hints and to know which tests are hidden. */
  tests: TestCase[];
  source: string;
  onJumpToLine?: (line: number) => void;
}

/** Console + test results + humanized error explanation, as a tabbed panel. */
export function OutputPanel({ running, liveOutput, result, tests, source, onJumpToLine }: Props) {
  const [tab, setTab] = useState<Tab>('output');
  const [showTechnical, setShowTechnical] = useState(false);

  // First failing test with a real exception is the most useful thing to explain.
  const errorToExplain = result?.error ?? result?.tests.find((t) => t.error)?.error ?? null;
  const human = useMemo(() => (errorToExplain ? humanizeError(errorToExplain, source) : null), [errorToExplain, source]);

  const passed = result?.tests.filter((t) => t.passed).length ?? 0;
  const total = result?.tests.length ?? 0;
  const testDefs = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);

  // Auto-select the most relevant tab when a result arrives.
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  if (result !== lastResult) {
    setLastResult(result);
    if (result) setTab(human ? 'explain' : total > 0 ? 'tests' : 'output');
  }

  return (
    <View style={styles.panel}>
      <View style={styles.tabs} accessibilityRole="tablist">
        <TabButton label="Output" active={tab === 'output'} onPress={() => setTab('output')} />
        <TabButton
          label={total ? `Tests ${passed}/${total}` : 'Tests'}
          active={tab === 'tests'}
          onPress={() => setTab('tests')}
          tone={total ? (passed === total ? 'success' : 'danger') : undefined}
        />
        <TabButton label="Explain" active={tab === 'explain'} onPress={() => setTab('explain')} tone={human ? 'danger' : undefined} />
        {result && <Text style={styles.duration}>{result.durationMs} ms</Text>}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {tab === 'output' && (
          <>
            <Text selectable style={styles.console}>
              {liveOutput || (running ? '' : 'Press ▶ Run to see your program’s output here.')}
              {running && <Text style={styles.cursor}>▍</Text>}
            </Text>
            {result?.truncated && <Text style={styles.note}>Output truncated.</Text>}
            {result?.images.map((b64, i) => (
              <Image key={i} source={{ uri: `data:image/png;base64,${b64}` }} style={styles.figure} resizeMode="contain" accessibilityLabel={`Chart ${i + 1}`} />
            ))}
          </>
        )}

        {tab === 'tests' &&
          (total === 0 ? (
            <Text style={styles.note}>Press ✓ Submit to run the test cases.</Text>
          ) : (
            result!.tests.map((t) => {
              const def = testDefs.get(t.id);
              return (
                <View key={t.id} style={[styles.test, t.passed ? styles.testPass : styles.testFail]}>
                  <Text style={styles.testTitle}>
                    {t.passed ? '✅' : '❌'} {t.hidden ? `Hidden test${t.passed ? '' : ` — ${t.name}`}` : t.name}
                  </Text>
                  {!t.passed && !t.hidden && t.expected != null && (
                    <View style={styles.diff}>
                      <Text style={styles.diffLabel}>Expected</Text>
                      <Text selectable style={styles.diffValue}>{t.expected}</Text>
                      <Text style={styles.diffLabel}>Got</Text>
                      <Text selectable style={styles.diffValue}>{t.actual || '(no output)'}</Text>
                    </View>
                  )}
                  {!t.passed && t.error && <Text style={styles.testError}>{humanizeError(t.error, source).title}</Text>}
                  {!t.passed && def?.failureHint && <Text style={styles.hint}>💡 {def.failureHint}</Text>}
                </View>
              );
            })
          ))}

        {tab === 'explain' &&
          (human ? (
            <View>
              <Text style={styles.explainTitle}>{human.title}</Text>
              {human.line != null && (
                <Pressable onPress={() => onJumpToLine?.(human.line!)} accessibilityRole="button">
                  <Text style={styles.lineLink}>Line {human.line} ›</Text>
                </Pressable>
              )}
              <Text style={styles.explainBody}>{stripTicks(human.explanation)}</Text>
              {human.hint && <Text style={styles.hint}>💡 {stripTicks(human.hint)}</Text>}
              <Pressable onPress={() => setShowTechnical((v) => !v)} accessibilityRole="button">
                <Text style={styles.techToggle}>{showTechnical ? 'Hide' : 'Show'} technical details</Text>
              </Pressable>
              {showTechnical && (
                <Text selectable style={styles.console}>
                  {human.technical}
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.note}>No errors — nice! Explanations for any Python error will appear here.</Text>
          ))}
      </ScrollView>
    </View>
  );
}

/** Inline code is shown in monospace in the full markdown renderer; here we keep it lightweight. */
const stripTicks = (s: string) => s.replace(/`([^`]+)`/g, '‘$1’').replace(/\*([^*]+)\*/g, '$1');

function TabButton({ label, active, onPress, tone }: { label: string; active: boolean; onPress: () => void; tone?: 'success' | 'danger' }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive, tone === 'success' && { color: colors.success }, tone === 'danger' && { color: colors.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flex: 1 },
  tabs: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: colors.text },
  duration: { marginLeft: 'auto', color: colors.textMuted, fontSize: 11 },
  body: { flex: 1 },
  bodyContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  console: { color: colors.text, fontFamily: fonts.mono, fontSize: 13, lineHeight: 19 },
  cursor: { color: colors.primary },
  note: { color: colors.textMuted, fontSize: 13 },
  figure: { width: '100%', height: 220, marginTop: spacing.md, backgroundColor: '#fff', borderRadius: radius.sm },
  test: { padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1 },
  testPass: { borderColor: 'rgba(63,185,80,0.35)', backgroundColor: 'rgba(63,185,80,0.07)' },
  testFail: { borderColor: 'rgba(248,81,73,0.35)', backgroundColor: 'rgba(248,81,73,0.07)' },
  testTitle: { color: colors.text, fontWeight: '600' },
  testError: { color: colors.danger, marginTop: spacing.xs },
  diff: { marginTop: spacing.sm, gap: 2 },
  diffLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', marginTop: spacing.xs },
  diffValue: { color: colors.text, fontFamily: fonts.mono, fontSize: 12 },
  hint: { color: colors.primary, marginTop: spacing.sm, lineHeight: 20 },
  explainTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  lineLink: { color: colors.secondary, marginTop: spacing.xs, fontWeight: '600' },
  explainBody: { color: colors.text, marginTop: spacing.sm, lineHeight: 22, fontSize: 15 },
  techToggle: { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm, textDecorationLine: 'underline' },
});
