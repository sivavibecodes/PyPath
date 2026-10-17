import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { usePythonRun } from '@/engine';
import { feedback } from '@/lib/feedback';
import { useProgressStore } from '@/stores/progressStore';
import { colors, fonts, radius, spacing } from '@/theme';
import type { DemonstrateCard, ExplainCard, Lesson, QuizQuestion, ReinforceCard } from '@/types/curriculum';

interface Props {
  lesson: Lesson;
}

export function LessonScreen({ lesson }: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [whyMattersOpen, setWhyMattersOpen] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, { answered: boolean; correct: boolean; value: string }>>({});

  const { running, liveOutput, result, run } = usePythonRun();
  const recordQuizAnswer = useProgressStore((s) => s.recordQuizAnswer);
  const completeLesson = useProgressStore((s) => s.completeLesson);

  const explainCard = lesson.cards.find((c): c is ExplainCard => c.type === 'explain');
  const demoCard = lesson.cards.find((c): c is DemonstrateCard => c.type === 'demonstrate');
  const reinforceCard = lesson.cards.find((c): c is ReinforceCard => c.type === 'reinforce');

  const handleRunDemo = async () => {
    if (!demoCard || running) return;
    await run({ code: demoCard.code, mode: 'run' });
  };

  const handleQuizAnswer = (q: QuizQuestion, answerVal: string) => {
    let isCorrect = false;
    if (q.kind === 'predict_output') {
      isCorrect = answerVal.trim() === q.answer.trim();
    } else if (q.kind === 'multiple_choice') {
      isCorrect = q.correctOptionIds.includes(answerVal);
    } else if (q.kind === 'fill_blank') {
      const target = q.blanks[0]?.[0]?.trim().toLowerCase();
      isCorrect = answerVal.trim().toLowerCase() === target;
    }

    setQuizAnswers((prev) => ({
      ...prev,
      [q.id]: { answered: true, correct: isCorrect, value: answerVal },
    }));

    recordQuizAnswer({
      questionId: q.id,
      lessonId: lesson.id,
      concept: q.concept,
      correct: isCorrect,
    });

    if (isCorrect) {
      feedback.success();
    } else {
      feedback.error();
    }
  };

  const handleFinishLesson = () => {
    completeLesson(lesson.id, lesson.xpReward, 100);
    feedback.success();
    Alert.alert('Lesson Completed! 🎓', `You earned +${lesson.xpReward} XP!`, [
      { text: 'Back to Path', onPress: () => router.back() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── CARD 1: EXPLAIN ─────────────────────────────────────────────── */}
      {explainCard && (
        <View style={styles.card}>
          <View style={styles.cardBadge}>
            <Text style={styles.badgeLabel}>1. CONCEPT EXPLANATION</Text>
          </View>
          <Text style={styles.cardTitle}>{explainCard.title}</Text>
          <Markdown style={markdownStyles}>{explainCard.body}</Markdown>

          {explainCard.keyPoints.length > 0 && (
            <View style={styles.keyPointsBox}>
              <Text style={styles.keyPointsTitle}>Key Takeaways:</Text>
              {explainCard.keyPoints.map((pt, i) => (
                <Text key={i} style={styles.keyPointItem}>• {pt}</Text>
              ))}
            </View>
          )}

          {explainCard.realWorld && (
            <View style={styles.realWorldContainer}>
              <Pressable
                onPress={() => setWhyMattersOpen((prev) => !prev)}
                style={styles.realWorldToggle}
                accessibilityRole="button"
              >
                <Text style={styles.realWorldToggleText}>
                  💼 {explainCard.realWorld.title} {whyMattersOpen ? '▲' : '▼'}
                </Text>
              </Pressable>
              {whyMattersOpen && (
                <View style={styles.realWorldBody}>
                  <Markdown style={markdownStyles}>{explainCard.realWorld.body}</Markdown>
                  {explainCard.realWorld.roi && (
                    <View style={styles.roiBox}>
                      <Text style={styles.roiTitle}>⚡ Real-World ROI Calculation:</Text>
                      <Text style={styles.roiMetric}>
                        Manual: {explainCard.realWorld.roi.manualMinutes} min ➔ Automated: {explainCard.realWorld.roi.automatedSeconds} sec
                      </Text>
                      {explainCard.realWorld.roi.annualHoursSaved && (
                        <Text style={styles.roiHighlight}>
                          Saves ~{explainCard.realWorld.roi.annualHoursSaved} hours / year
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── CARD 2: DEMONSTRATE ─────────────────────────────────────────── */}
      {demoCard && (
        <View style={styles.card}>
          <View style={[styles.cardBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.badgeLabel, { color: '#fff' }]}>2. CODE WALKTHROUGH</Text>
          </View>
          <Text style={styles.cardTitle}>{demoCard.title}</Text>

          <View style={styles.snippetContainer}>
            <Text selectable style={styles.codeText}>{demoCard.code}</Text>
          </View>

          <View style={styles.walkthroughNav}>
            <Text style={styles.stepIndicator}>
              Step {currentStepIndex + 1} of {demoCard.steps.length}
            </Text>
            <View style={styles.stepButtons}>
              <Pressable
                disabled={currentStepIndex === 0}
                onPress={() => setCurrentStepIndex((i) => i - 1)}
                style={[styles.stepBtn, currentStepIndex === 0 && styles.disabled]}
              >
                <Text style={styles.stepBtnText}>Prev</Text>
              </Pressable>
              <Pressable
                disabled={currentStepIndex === demoCard.steps.length - 1}
                onPress={() => setCurrentStepIndex((i) => i + 1)}
                style={[styles.stepBtn, currentStepIndex === demoCard.steps.length - 1 && styles.disabled]}
              >
                <Text style={styles.stepBtnText}>Next</Text>
              </Pressable>
            </View>
          </View>

          {demoCard.steps[currentStepIndex] && (
            <View style={styles.stepExplanationBox}>
              <Text style={styles.stepLines}>
                Lines {demoCard.steps[currentStepIndex]!.lines[0]} - {demoCard.steps[currentStepIndex]!.lines[1]}
              </Text>
              <Markdown style={markdownStyles}>{demoCard.steps[currentStepIndex]!.explanation}</Markdown>
            </View>
          )}

          <Pressable
            onPress={handleRunDemo}
            disabled={running}
            style={({ pressed }) => [styles.runDemoBtn, pressed && styles.pressed, running && styles.disabled]}
          >
            <Text style={styles.runDemoText}>{running ? 'Running Pyodide…' : '▶ Run Snippet'}</Text>
          </Pressable>

          {(liveOutput || result) && (
            <View style={styles.demoOutputBox}>
              <Text style={styles.outputLabel}>Console Output:</Text>
              <Text selectable style={styles.consoleText}>
                {liveOutput || result?.stdout || '(No output)'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── CARD 3: PRACTICE CTA ────────────────────────────────────────── */}
      <View style={[styles.card, styles.practiceCard]}>
        <View style={[styles.cardBadge, { backgroundColor: colors.xp }]}>
          <Text style={[styles.badgeLabel, { color: '#fff' }]}>3. HANDS-ON PRACTICE</Text>
        </View>
        <Text style={styles.cardTitle}>Live Coding Challenge</Text>
        <Text style={styles.practiceSubtitle}>
          Put theory into muscle memory. Solve the test cases in our mobile code lab with live on-device Python emulation.
        </Text>
        <Pressable
          onPress={() => router.push(`/lab/${lesson.id}`)}
          style={({ pressed }) => [styles.launchLabBtn, pressed && styles.pressed]}
        >
          <Text style={styles.launchLabText}>Open Code Lab ➔</Text>
        </Pressable>
      </View>

      {/* ── CARD 4: REINFORCE ───────────────────────────────────────────── */}
      {reinforceCard && (
        <View style={styles.card}>
          <View style={[styles.cardBadge, { backgroundColor: colors.streak }]}>
            <Text style={[styles.badgeLabel, { color: '#fff' }]}>4. KNOWLEDGE CHECK</Text>
          </View>
          <Text style={styles.cardTitle}>{reinforceCard.title}</Text>

          {reinforceCard.questions.map((q, idx) => {
            const ans = quizAnswers[q.id];
            return (
              <View key={q.id} style={styles.quizItem}>
                <Text style={styles.questionPrompt}>
                  Q{idx + 1}. {q.prompt}
                </Text>

                {q.code && (
                  <View style={styles.quizCodeBox}>
                    <Text selectable style={styles.quizCodeText}>{q.code}</Text>
                  </View>
                )}

                {/* Multiple choice options */}
                {q.kind === 'multiple_choice' && (
                  <View style={styles.optionsContainer}>
                    {q.options.map((opt) => {
                      const selected = ans?.value === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          disabled={ans?.answered}
                          onPress={() => handleQuizAnswer(q, opt.id)}
                          style={[
                            styles.optionButton,
                            selected && (ans?.correct ? styles.optionCorrect : styles.optionWrong),
                          ]}
                        >
                          <Text style={styles.optionText}>{opt.text}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Predict Output / Fill Blank text input */}
                {(q.kind === 'predict_output' || q.kind === 'fill_blank') && !ans?.answered && (
                  <QuizInputSubmit onSubmit={(val) => handleQuizAnswer(q, val)} />
                )}

                {ans?.answered && (
                  <View style={[styles.feedbackBox, ans.correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
                    <Text style={styles.feedbackTitle}>
                      {ans.correct ? '✅ Correct!' : '❌ Not quite right'}
                    </Text>
                    <Markdown style={markdownStyles}>{q.explanation}</Markdown>
                  </View>
                )}
              </View>
            );
          })}

          <Pressable
            onPress={handleFinishLesson}
            style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed]}
          >
            <Text style={styles.finishBtnText}>Complete Lesson (+{lesson.xpReward} XP)</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function QuizInputSubmit({ onSubmit }: { onSubmit: (v: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <View style={styles.inputRow}>
      <TextInput
        value={val}
        onChangeText={setVal}
        placeholder="Type expected output…"
        placeholderTextColor={colors.textMuted}
        style={styles.textInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable onPress={() => onSubmit(val)} style={styles.submitAnsBtn}>
        <Text style={styles.submitAnsText}>Check</Text>
      </Pressable>
    </View>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  code_inline: { backgroundColor: colors.key, color: colors.primary, borderRadius: 4, paddingHorizontal: 4 },
  fence: { backgroundColor: colors.editorBg, color: colors.text, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm },
  strong: { color: colors.text, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  practiceCard: {
    borderColor: colors.xp,
    backgroundColor: 'rgba(163, 113, 247, 0.05)',
  },
  cardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  badgeLabel: { color: '#000', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginBottom: spacing.md },
  keyPointsBox: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  keyPointsTitle: { color: colors.primary, fontWeight: '700', fontSize: 13, marginBottom: spacing.xs },
  keyPointItem: { color: colors.text, fontSize: 13, lineHeight: 19, marginVertical: 2 },
  realWorldContainer: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  realWorldToggle: { paddingVertical: spacing.xs },
  realWorldToggleText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  realWorldBody: { marginTop: spacing.sm },
  roiBox: {
    backgroundColor: 'rgba(63, 185, 80, 0.1)',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  roiTitle: { color: colors.success, fontWeight: '800', fontSize: 13 },
  roiMetric: { color: colors.text, fontSize: 13, marginTop: 4 },
  roiHighlight: { color: colors.success, fontWeight: '800', fontSize: 14, marginTop: 4 },
  snippetContainer: {
    backgroundColor: colors.editorBg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeText: { color: colors.text, fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
  walkthroughNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  stepIndicator: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  stepButtons: { flexDirection: 'row', gap: spacing.sm },
  stepBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtnText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  stepExplanationBox: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  stepLines: { color: colors.secondary, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  runDemoBtn: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  runDemoText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  demoOutputBox: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outputLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', marginBottom: 4 },
  consoleText: { color: colors.text, fontFamily: fonts.mono, fontSize: 13 },
  practiceSubtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  launchLabBtn: {
    backgroundColor: colors.xp,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  launchLabText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  quizItem: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  questionPrompt: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  quizCodeBox: {
    backgroundColor: colors.editorBg,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  quizCodeText: { color: colors.text, fontFamily: fonts.mono, fontSize: 12 },
  optionsContainer: { gap: spacing.sm },
  optionButton: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionText: { color: colors.text, fontSize: 14 },
  optionCorrect: { borderColor: colors.success, backgroundColor: 'rgba(63, 185, 80, 0.15)' },
  optionWrong: { borderColor: colors.danger, backgroundColor: 'rgba(248, 81, 73, 0.15)' },
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  textInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: fonts.mono,
  },
  submitAnsBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  submitAnsText: { color: '#000', fontWeight: '800' },
  feedbackBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  feedbackCorrect: { backgroundColor: 'rgba(63, 185, 80, 0.15)', borderWidth: 1, borderColor: colors.success },
  feedbackWrong: { backgroundColor: 'rgba(248, 81, 73, 0.15)', borderWidth: 1, borderColor: colors.danger },
  feedbackTitle: { fontWeight: '800', marginBottom: spacing.xs },
  finishBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  finishBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
});
