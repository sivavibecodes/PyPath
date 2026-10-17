import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { feedback } from '@/lib/feedback';
import { useProgressStore } from '@/stores/progressStore';
import { colors, fonts, radius, spacing } from '@/theme';
import type { MockExam, QuizQuestion } from '@/types/curriculum';

interface Props {
  exam: MockExam;
}

export function MockExamScreen({ exam }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(exam.durationMinutes * 60);
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const awardXp = useProgressStore((s) => s.awardXp);

  // Timer countdown
  useEffect(() => {
    if (isSubmitted) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSubmitted]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectOption = (questionId: string, optionId: string, isMulti: boolean) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => {
      const current = prev[questionId] ?? [];
      let updated: string[];
      if (isMulti) {
        updated = current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId];
      } else {
        updated = [optionId];
      }
      return { ...prev, [questionId]: updated };
    });
  };

  const handleTextInput = (questionId: string, text: string) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: [text] }));
  };

  const calculateScore = () => {
    let correctCount = 0;
    exam.questionPool.forEach((q) => {
      const ans = userAnswers[q.id] ?? [];
      if (q.kind === 'predict_output') {
        if ((ans[0] ?? '').trim() === q.answer.trim()) correctCount++;
      } else if (q.kind === 'multiple_choice') {
        const sortedGiven = [...ans].sort().join(',');
        const sortedExpected = [...q.correctOptionIds].sort().join(',');
        if (sortedGiven === sortedExpected && sortedGiven.length > 0) correctCount++;
      }
    });
    return {
      correctCount,
      totalCount: exam.questionPool.length,
      scorePct: Math.round((correctCount / exam.questionPool.length) * 100),
      passed: Math.round((correctCount / exam.questionPool.length) * 100) >= exam.passingScorePct,
    };
  };

  const handleSubmit = () => {
    if (isSubmitted) return;
    setIsSubmitted(true);
    const score = calculateScore();
    if (score.passed) {
      feedback.success();
      awardXp(100, `exam:${exam.id}`);
    } else {
      feedback.partial();
    }
  };

  const currentQ: QuizQuestion | undefined = exam.questionPool[currentIndex];
  const scoreReport = isSubmitted ? calculateScore() : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Bar: Exam Title & Countdown Timer */}
      <View style={styles.header}>
        <View>
          <Text style={styles.examTag}>{exam.certification} MOCK EXAM</Text>
          <Text style={styles.examTitle}>{exam.title}</Text>
        </View>
        <View style={[styles.timerBadge, secondsRemaining < 300 && styles.timerUrgent]}>
          <Text style={styles.timerText}>⏳ {formatTime(secondsRemaining)}</Text>
        </View>
      </View>

      {!isSubmitted ? (
        <>
          {/* Question Index Pill Navigator */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.navRow}>
            {exam.questionPool.map((q, idx) => {
              const isAnswered = (userAnswers[q.id]?.length ?? 0) > 0;
              const isActive = idx === currentIndex;
              return (
                <Pressable
                  key={q.id}
                  onPress={() => setCurrentIndex(idx)}
                  style={[
                    styles.navPill,
                    isActive && styles.navPillActive,
                    isAnswered && !isActive && styles.navPillAnswered,
                  ]}
                >
                  <Text style={[styles.navPillText, isActive && styles.navPillTextActive]}>
                    Q{idx + 1}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Current Question Body */}
          {currentQ && (
            <View style={styles.card}>
              <View style={styles.qHeader}>
                <Text style={styles.qNumber}>Question {currentIndex + 1} of {exam.questionPool.length}</Text>
                {currentQ.objective && <Text style={styles.qObjective}>{currentQ.objective}</Text>}
              </View>

              <Text style={styles.prompt}>{currentQ.prompt}</Text>

              {currentQ.code && (
                <View style={styles.codeBox}>
                  <Text selectable style={styles.codeText}>{currentQ.code}</Text>
                </View>
              )}

              {/* Multiple Choice Options */}
              {currentQ.kind === 'multiple_choice' && (
                <View style={styles.optionsList}>
                  {currentQ.options.map((opt) => {
                    const selected = (userAnswers[currentQ.id] ?? []).includes(opt.id);
                    const isMulti = currentQ.correctOptionIds.length > 1;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => handleSelectOption(currentQ.id, opt.id, isMulti)}
                        style={[styles.optionCard, selected && styles.optionSelected]}
                      >
                        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                          {selected && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                        <Text style={styles.optionText}>{opt.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Predict Output Text Input */}
              {currentQ.kind === 'predict_output' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Type exact output:</Text>
                  <TextInput
                    value={userAnswers[currentQ.id]?.[0] ?? ''}
                    onChangeText={(t) => handleTextInput(currentQ.id, t)}
                    placeholder="e.g. 42"
                    placeholderTextColor={colors.textMuted}
                    style={styles.textInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}
            </View>
          )}

          {/* Pagination Controls */}
          <View style={styles.actionRow}>
            <Pressable
              disabled={currentIndex === 0}
              onPress={() => setCurrentIndex((i) => i - 1)}
              style={[styles.navBtn, currentIndex === 0 && styles.disabled]}
            >
              <Text style={styles.navBtnText}>Previous</Text>
            </Pressable>

            {currentIndex < exam.questionPool.length - 1 ? (
              <Pressable onPress={() => setCurrentIndex((i) => i + 1)} style={styles.nextBtn}>
                <Text style={styles.nextBtnText}>Next Question</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleSubmit} style={styles.submitExamBtn}>
                <Text style={styles.submitExamText}>Submit Exam</Text>
              </Pressable>
            )}
          </View>
        </>
      ) : (
        /* Score Report Breakdown */
        <View style={styles.card}>
          <Text style={styles.reportTitle}>Mock Exam Results</Text>
          <View style={[styles.scoreBanner, scoreReport?.passed ? styles.bannerPass : styles.bannerFail]}>
            <Text style={styles.scoreNumber}>{scoreReport?.scorePct}%</Text>
            <Text style={styles.scoreVerdict}>
              {scoreReport?.passed ? 'PASSED (Certification Ready)' : 'DID NOT PASS (Review Needed)'}
            </Text>
            <Text style={styles.scoreSub}>
              {scoreReport?.correctCount} of {scoreReport?.totalCount} questions correct (Threshold: {exam.passingScorePct}%)
            </Text>
          </View>

          <Text style={styles.reviewHeading}>Objective & Concept Explanations:</Text>
          {exam.questionPool.map((q, idx) => {
            const given = userAnswers[q.id] ?? [];
            return (
              <View key={q.id} style={styles.reviewItem}>
                <Text style={styles.reviewPrompt}>Q{idx + 1}. {q.prompt}</Text>
                <Text style={styles.reviewAns}>Your answer: {given.join(', ') || '(empty)'}</Text>
                <View style={styles.explanationBox}>
                  <Text style={styles.explanationTitle}>Explanation & Objective Alignment ({q.objective}):</Text>
                  <Markdown style={markdownStyles}>{q.explanation}</Markdown>
                </View>
              </View>
            );
          })}

          <Pressable onPress={() => router.back()} style={styles.exitBtn}>
            <Text style={styles.exitBtnText}>Back to Certification Hub</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: colors.text, fontSize: 13, lineHeight: 18 },
  code_inline: { backgroundColor: colors.key, color: colors.primary, borderRadius: 4, paddingHorizontal: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  examTag: { color: colors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  examTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
  timerBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerUrgent: { borderColor: colors.danger, backgroundColor: 'rgba(248, 81, 73, 0.15)' },
  timerText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  navRow: { flexDirection: 'row', marginBottom: spacing.md },
  navPill: {
    width: 44,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navPillActive: { borderColor: colors.primary, backgroundColor: 'rgba(255, 212, 59, 0.1)' },
  navPillAnswered: { backgroundColor: colors.surfaceAlt, borderColor: colors.secondary },
  navPillText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  navPillTextActive: { color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  qNumber: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  qObjective: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  prompt: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: spacing.md },
  codeBox: {
    backgroundColor: colors.editorBg,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  codeText: { color: colors.text, fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
  optionsList: { gap: spacing.sm },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: 'rgba(255, 212, 59, 0.08)' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkMark: { color: '#000', fontSize: 12, fontWeight: '900' },
  optionText: { color: colors.text, fontSize: 14, flex: 1 },
  inputContainer: { marginTop: spacing.sm },
  inputLabel: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  textInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: fonts.mono,
  },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  navBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navBtnText: { color: colors.text, fontWeight: '700' },
  nextBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
  },
  nextBtnText: { color: '#fff', fontWeight: '800' },
  submitExamBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  submitExamText: { color: '#000', fontWeight: '800' },
  reportTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: spacing.lg },
  scoreBanner: { padding: spacing.xl, borderRadius: radius.md, alignItems: 'center', marginBottom: spacing.xl },
  bannerPass: { backgroundColor: 'rgba(63, 185, 80, 0.15)', borderWidth: 1, borderColor: colors.success },
  bannerFail: { backgroundColor: 'rgba(248, 81, 73, 0.15)', borderWidth: 1, borderColor: colors.danger },
  scoreNumber: { fontSize: 48, fontWeight: '900', color: colors.text },
  scoreVerdict: { fontWeight: '800', fontSize: 16, marginTop: 4, color: colors.text },
  scoreSub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  reviewHeading: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
  reviewItem: { backgroundColor: colors.surfaceAlt, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  reviewPrompt: { color: colors.text, fontWeight: '700', fontSize: 14 },
  reviewAns: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  explanationBox: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs },
  explanationTitle: { color: colors.secondary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  exitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  exitBtnText: { color: '#000', fontWeight: '800' },
  disabled: { opacity: 0.3 },
});
