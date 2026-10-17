import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useProgressStore, levelForXp } from '@/stores/progressStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, fonts, radius, spacing } from '@/theme';

interface Props {
  onOpenTrackSwitcher: () => void;
}

export function Header({ onOpenTrackSwitcher }: Props) {
  const xp = useProgressStore((s) => s.xp);
  const streak = useProgressStore((s) => s.streak.current);
  const activeTrack = useSettingsStore((s) => s.activeTrack);
  const { level } = levelForXp(xp);

  const trackLabel =
    activeTrack.kind === 'certification'
      ? 'Cert Track'
      : activeTrack.profession === 'marketing'
        ? 'Marketing'
        : activeTrack.profession === 'finance'
          ? 'Finance'
          : activeTrack.profession === 'product_ops'
            ? 'Product & Ops'
            : 'Data Analyst';

  return (
    <View style={styles.container}>
      <Pressable onPress={onOpenTrackSwitcher} style={styles.trackPill} accessibilityRole="button" accessibilityLabel="Switch learning track">
        <Text style={styles.trackIcon}>🐍</Text>
        <Text style={styles.trackText}>{trackLabel}</Text>
        <Text style={styles.trackArrow}>▾</Text>
      </Pressable>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>🔥</Text>
          <Text style={[styles.statValue, { color: colors.streak }]}>{streak}</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statIcon}>⚡</Text>
          <Text style={[styles.statValue, { color: colors.xp }]}>{xp}</Text>
        </View>

        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Lv {level}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  trackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  trackIcon: { fontSize: 16 },
  trackText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  trackArrow: { color: colors.textMuted, fontSize: 12 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: { fontSize: 14 },
  statValue: { fontWeight: '800', fontSize: 14 },
  levelBadge: {
    backgroundColor: colors.keyAccent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  levelText: { color: colors.secondary, fontWeight: '800', fontSize: 12 },
});
