import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSettingsStore, type ActiveTrack } from '@/stores/settingsStore';
import { colors, radius, spacing } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface TrackOption {
  track: ActiveTrack;
  title: string;
  badge: string;
  subtitle: string;
  icon: string;
}

const TRACK_OPTIONS: TrackOption[] = [
  {
    track: { kind: 'certification' },
    title: 'Standard Certification Track',
    badge: 'PCEP / PCAP',
    subtitle: 'From variables to OOP, async, and systems. Prepares for official Python Institute exams.',
    icon: '🎓',
  },
  {
    track: { kind: 'profession', profession: 'marketing' },
    title: 'Marketing & Growth',
    badge: 'Applied Python',
    subtitle: 'Bulk UTM tagging, ad-copy scrapers, Google Analytics CSV automated reporting.',
    icon: '🚀',
  },
  {
    track: { kind: 'profession', profession: 'finance' },
    title: 'Finance & Accounting',
    badge: 'Applied Python',
    subtitle: 'Instant Excel ledger reconciliation with Pandas, invoice generation, FX conversion.',
    icon: '💼',
  },
  {
    track: { kind: 'profession', profession: 'product_ops' },
    title: 'Product & Operations',
    badge: 'Applied Python',
    subtitle: 'Jira/Slack webhook alerts, cohort retention analysis, sprint velocity forecasting.',
    icon: '⚙️',
  },
  {
    track: { kind: 'profession', profession: 'data' },
    title: 'Data Analysts & Scientists',
    badge: 'Applied Python',
    subtitle: 'Pandas & NumPy data cleaning, statistical significance tests, linear regression.',
    icon: '📊',
  },
];

export function TrackSwitcherModal({ visible, onClose }: Props) {
  const activeTrack = useSettingsStore((s) => s.activeTrack);
  const setActiveTrack = useSettingsStore((s) => s.setActiveTrack);

  const isSelected = (opt: TrackOption) => {
    if (opt.track.kind === 'certification' && activeTrack.kind === 'certification') return true;
    if (opt.track.kind === 'profession' && activeTrack.kind === 'profession') {
      return opt.track.profession === activeTrack.profession;
    }
    return false;
  };

  const handleSelect = (track: ActiveTrack) => {
    setActiveTrack(track);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Choose Learning Track</Text>
          <Text style={styles.sheetSubtitle}>Switch freely anytime. Your XP and streaks are unified.</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {TRACK_OPTIONS.map((opt, i) => {
              const selected = isSelected(opt);
              return (
                <Pressable
                  key={i}
                  onPress={() => handleSelect(opt.track)}
                  style={({ pressed }) => [
                    styles.card,
                    selected && styles.cardSelected,
                    pressed && styles.cardPressed,
                  ]}
                  accessibilityRole="button"
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.icon}>{opt.icon}</Text>
                    <View style={styles.titleContainer}>
                      <View style={styles.badgeRow}>
                        <Text style={styles.title}>{opt.title}</Text>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{opt.badge}</Text>
                        </View>
                      </View>
                      <Text style={styles.subtitle}>{opt.subtitle}</Text>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected && <View style={styles.radioInner} />}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  sheetSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  list: { flexGrow: 0 },
  listContent: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 212, 59, 0.08)',
  },
  cardPressed: { opacity: 0.8 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: { fontSize: 28 },
  titleContainer: { flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  title: { color: colors.text, fontWeight: '700', fontSize: 15 },
  badge: {
    backgroundColor: colors.keyAccent,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: { color: colors.secondary, fontSize: 10, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioSelected: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
