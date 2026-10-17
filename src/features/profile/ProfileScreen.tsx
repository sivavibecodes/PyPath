import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { levelForXp, useProgressStore } from '@/stores/progressStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { syncService } from '@/services/sync';
import { resetPyodideInstall } from '@/engine';
import { colors, radius, spacing } from '@/theme';

export function ProfileScreen() {
  const [syncing, setSyncing] = useState(false);
  const xp = useProgressStore((s) => s.xp);
  const streak = useProgressStore((s) => s.streak);
  const mistakes = useProgressStore((s) => s.mistakes);
  const completedCount = Object.keys(useProgressStore((s) => s.completedLessons)).length;
  const outboxCount = useProgressStore((s) => s.outbox.length);

  const { hapticsEnabled, soundEnabled, lineWrapping, editorFontSize, update } = useSettingsStore();
  const { level, progress, toNext } = levelForXp(xp);

  const handleManualSync = async () => {
    setSyncing(true);
    const count = await syncService.syncOutbox();
    setSyncing(false);
    Alert.alert('Cloud Sync Complete', `Synced ${count} pending progress records to Supabase.`);
  };

  const handleResetEngine = async () => {
    Alert.alert(
      'Reset Local Python Engine?',
      'This will clear cached Pyodide wheels and re-extract clean assets on the next run.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetPyodideInstall();
            Alert.alert('Engine Reset', 'The offline runtime will re-initialize fresh.');
          },
        },
      ]
    );
  };

  const mistakeEntries = Object.entries(mistakes).sort(([, a], [, b]) => b.count - a.count);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Header & Level */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>🐍</Text>
        </View>
        <Text style={styles.userName}>Python Developer</Text>
        <Text style={styles.userSubtitle}>Level {level} Architect</Text>

        {/* Level XP Bar */}
        <View style={styles.levelProgressContainer}>
          <View style={styles.levelBar}>
            <View style={[styles.levelBarFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.levelText}>{toNext} XP until Level {level + 1}</Text>
        </View>
      </View>

      {/* Gamification Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>🔥 {streak.current}</Text>
          <Text style={styles.statLbl}>Day Streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>⚡ {xp}</Text>
          <Text style={styles.statLbl}>Total XP</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>🎓 {completedCount}</Text>
          <Text style={styles.statLbl}>Lessons Passed</Text>
        </View>
      </View>

      {/* Mistake Analytics Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧠 Mistake Analytics & Insights</Text>
        <Text style={styles.sectionSub}>PyPath tracks recurring error patterns so you can fix them proactively.</Text>

        {mistakeEntries.length === 0 ? (
          <View style={styles.cleanRecordBox}>
            <Text style={styles.cleanRecordText}>✨ Clean record! No recurring mistakes logged yet.</Text>
          </View>
        ) : (
          mistakeEntries.map(([type, stat]) => (
            <View key={type} style={styles.mistakeCard}>
              <View style={styles.mistakeHeader}>
                <Text style={styles.mistakeType}>{type}</Text>
                <Text style={styles.mistakeCount}>{stat.count} occurrence{stat.count === 1 ? '' : 's'}</Text>
              </View>
              <Text style={styles.mistakeAdvice}>
                {type === 'IndexError'
                  ? 'Tip: Remember Python indexes count from 0 to len(list) - 1. Check with len() before slicing.'
                  : type === 'SyntaxError'
                    ? 'Tip: Ensure colons : follow if/for/def lines and brackets () [] match.'
                    : type === 'KeyError'
                      ? 'Tip: Use dict.get(key, default) instead of dict[key] to prevent crashing on missing keys.'
                      : 'Review recent lesson notes to eliminate this exception pattern.'}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Sync & Cloud Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>☁️ Cloud Sync & Offline Outbox</Text>
        <View style={styles.syncRow}>
          <Text style={styles.syncStatusText}>
            {outboxCount > 0 ? `📦 ${outboxCount} changes stored offline in MMKV` : '✅ All local progress synced to cloud'}
          </Text>
          <Pressable onPress={handleManualSync} disabled={syncing} style={styles.syncBtn}>
            <Text style={styles.syncBtnText}>{syncing ? 'Syncing…' : 'Sync Now'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Preferences & Engine Controls</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Haptic Feedback</Text>
          <Switch
            value={hapticsEnabled}
            onValueChange={(val) => update({ hapticsEnabled: val })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Sound Effects</Text>
          <Switch
            value={soundEnabled}
            onValueChange={(val) => update({ soundEnabled: val })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Editor Soft Line Wrapping</Text>
          <Switch
            value={lineWrapping}
            onValueChange={(val) => update({ lineWrapping: val })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Editor Font Size ({editorFontSize}px)</Text>
          <View style={styles.fontBtns}>
            <Pressable
              onPress={() => update({ editorFontSize: Math.max(11, editorFontSize - 1) })}
              style={styles.fontBtn}
            >
              <Text style={styles.fontBtnText}>A-</Text>
            </Pressable>
            <Pressable
              onPress={() => update({ editorFontSize: Math.min(22, editorFontSize + 1) })}
              style={styles.fontBtn}
            >
              <Text style={styles.fontBtnText}>A+</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={handleResetEngine} style={styles.resetEngineBtn}>
          <Text style={styles.resetEngineText}>Reset Offline Pyodide Runtime Cache</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  profileHeader: { alignItems: 'center', marginBottom: spacing.xl },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  avatarEmoji: { fontSize: 40 },
  userName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  userSubtitle: { color: colors.secondary, fontSize: 13, fontWeight: '700', marginTop: 2 },
  levelProgressContainer: { width: '80%', marginTop: spacing.md, alignItems: 'center' },
  levelBar: { width: '100%', height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  levelBarFill: { height: '100%', backgroundColor: colors.xp, borderRadius: 4 },
  levelText: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLbl: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sectionSub: { color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: spacing.md, lineHeight: 16 },
  cleanRecordBox: { padding: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
  cleanRecordText: { color: colors.success, fontSize: 13, fontWeight: '600' },
  mistakeCard: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  mistakeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  mistakeType: { color: colors.danger, fontWeight: '800', fontSize: 14 },
  mistakeCount: { color: colors.textMuted, fontSize: 12 },
  mistakeAdvice: { color: colors.text, fontSize: 12, lineHeight: 17 },
  syncRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncStatusText: { color: colors.textMuted, fontSize: 12, flex: 1 },
  syncBtn: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  syncBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  settingLabel: { color: colors.text, fontSize: 14 },
  fontBtns: { flexDirection: 'row', gap: spacing.xs },
  fontBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fontBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  resetEngineBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
  },
  resetEngineText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
