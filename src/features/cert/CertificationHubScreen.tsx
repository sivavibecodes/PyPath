import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PCEP_MOCK_EXAM, PCAP_MOCK_EXAM } from '@/content/mockExams';
import { useProgressStore } from '@/stores/progressStore';
import { colors, radius, spacing } from '@/theme';
import type { CertificationId, MockExam } from '@/types/curriculum';

export function CertificationHubScreen() {
  const [selectedCert, setSelectedCert] = useState<CertificationId>('PCEP');
  const concepts = useProgressStore((s) => s.concepts);

  const activeExam: MockExam = selectedCert === 'PCEP' ? PCEP_MOCK_EXAM : PCAP_MOCK_EXAM;

  // Compute readiness based on concept attempts & failure rates in progressStore
  const totalConcepts = Object.keys(concepts).length;
  const masteredConcepts = Object.values(concepts).filter((c) => c.attempts >= 2 && c.failures === 0).length;
  const overallReadinessPct = totalConcepts > 0 ? Math.min(100, Math.round((masteredConcepts / Math.max(5, totalConcepts)) * 100)) : 45;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Selector */}
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setSelectedCert('PCEP')}
          style={[styles.tabBtn, selectedCert === 'PCEP' && styles.tabActive]}
        >
          <Text style={[styles.tabText, selectedCert === 'PCEP' && styles.tabTextActive]}>
            PCEP (Entry-Level)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedCert('PCAP')}
          style={[styles.tabBtn, selectedCert === 'PCAP' && styles.tabActive]}
        >
          <Text style={[styles.tabText, selectedCert === 'PCAP' && styles.tabTextActive]}>
            PCAP (Associate)
          </Text>
        </Pressable>
      </View>

      {/* Readiness Gauge Card */}
      <View style={styles.readinessCard}>
        <Text style={styles.gaugeTitle}>Official Exam Readiness</Text>
        <View style={styles.gaugeCircle}>
          <Text style={styles.gaugeNumber}>{overallReadinessPct}%</Text>
          <Text style={styles.gaugeLabel}>Readiness Score</Text>
        </View>
        <Text style={styles.gaugeSubtext}>
          {overallReadinessPct >= 70
            ? '🚀 High confidence! You are meeting the official Python Institute pass threshold.'
            : '📚 Practice more challenges to boost your objective readiness score above 70%.'}
        </Text>
      </View>

      {/* Objectives Breakdown */}
      <Text style={styles.sectionTitle}>Exam Objective Breakdown</Text>
      <View style={styles.objectivesList}>
        {activeExam.sections.map((sec, i) => (
          <View key={i} style={styles.objectiveCard}>
            <View style={styles.objHeader}>
              <Text style={styles.objCode}>{sec.objective}</Text>
              <Text style={styles.objWeight}>{sec.weightPct}% of exam</Text>
            </View>
            <Text style={styles.objTitle}>{sec.title}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(100, 35 + i * 20)}%` }]} />
            </View>
          </View>
        ))}
      </View>

      {/* Mock Exam Launch Banner */}
      <View style={styles.examBanner}>
        <View style={styles.bannerHeader}>
          <Text style={styles.bannerIcon}>⏱️</Text>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{activeExam.title}</Text>
            <Text style={styles.bannerMeta}>
              {activeExam.durationMinutes} mins  ·  {activeExam.questionCount} questions  ·  Pass: {activeExam.passingScorePct}%
            </Text>
          </View>
        </View>
        <Text style={styles.bannerDesc}>
          Simulates real exam test conditions: strictly timed countdown, syntax prediction, and algorithmic multiple-choice questions.
        </Text>
        <Pressable
          onPress={() => router.push(`/exam/${activeExam.id}`)}
          style={({ pressed }) => [styles.startExamBtn, pressed && styles.pressed]}
        >
          <Text style={styles.startExamText}>Start Mock Exam ➔</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: colors.primary },
  readinessCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  gaugeTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
  gaugeCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 212, 59, 0.05)',
  },
  gaugeNumber: { color: colors.primary, fontSize: 32, fontWeight: '900' },
  gaugeLabel: { color: colors.textMuted, fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  gaugeSubtext: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.md },
  objectivesList: { gap: spacing.sm, marginBottom: spacing.xl },
  objectiveCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  objHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  objCode: { color: colors.secondary, fontWeight: '700', fontSize: 12 },
  objWeight: { color: colors.textMuted, fontSize: 11 },
  objTitle: { color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: spacing.sm },
  progressBar: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.secondary, borderRadius: 3 },
  examBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  bannerHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  bannerIcon: { fontSize: 32 },
  bannerText: { flex: 1 },
  bannerTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  bannerMeta: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  bannerDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginVertical: spacing.md },
  startExamBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  startExamText: { color: '#000', fontWeight: '800', fontSize: 14 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
