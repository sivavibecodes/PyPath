import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useProgressStore } from '@/stores/progressStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { certificationUnits, professionUnits } from '@/content/registry';
import { colors, radius, spacing } from '@/theme';
import type { PathNode, Unit } from '@/types/curriculum';

export function PathView() {
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const activeTrack = useSettingsStore((s) => s.activeTrack);

  const units: Unit[] =
    activeTrack.kind === 'certification'
      ? certificationUnits
      : professionUnits[activeTrack.profession] ?? [];

  const isCompleted = (node: PathNode) => !!completedLessons[node.refId];

  const isUnlocked = (node: PathNode) => {
    if (node.unlockAfter.length === 0) return true;
    return node.unlockAfter.every((depId) => {
      // Find the node corresponding to depId
      for (const u of units) {
        const found = u.nodes.find((n) => n.id === depId);
        if (found && completedLessons[found.refId]) return true;
      }
      return false;
    });
  };

  const handlePressNode = (node: PathNode) => {
    if (!isUnlocked(node)) return;
    if (node.type === 'milestone_quiz') {
      router.push(`/exam/${node.refId}`);
    } else {
      router.push(`/lesson/${node.refId}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {units.map((unit) => (
        <View key={unit.id} style={styles.unitContainer}>
          <View style={styles.unitHeader}>
            <Text style={styles.unitTitle}>{unit.title}</Text>
            <Text style={styles.unitDesc}>{unit.description}</Text>
          </View>

          <View style={styles.nodesContainer}>
            {unit.nodes.map((node, index) => {
              const completed = isCompleted(node);
              const unlocked = isUnlocked(node);
              // Winding S-curve pattern: offset by 0px, 35px, 50px, 35px, 0px, -35px, -50px, -35px
              const cycle = [0, 40, 60, 40, 0, -40, -60, -40];
              const offsetX = cycle[index % cycle.length] ?? 0;

              return (
                <View key={node.id} style={[styles.nodeRow, { transform: [{ translateX: offsetX }] }]}>
                  <Pressable
                    onPress={() => handlePressNode(node)}
                    disabled={!unlocked}
                    style={({ pressed }) => [
                      styles.nodeButton,
                      node.type === 'milestone_quiz' && styles.nodeQuiz,
                      node.type === 'checkpoint' && styles.nodeCheckpoint,
                      completed && styles.nodeCompleted,
                      unlocked && !completed && styles.nodeActive,
                      !unlocked && styles.nodeLocked,
                      pressed && styles.nodePressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${node.title}, ${completed ? 'Completed' : unlocked ? 'Available' : 'Locked'}`}
                  >
                    <Text style={styles.nodeIcon}>
                      {completed ? '✓' : !unlocked ? '🔒' : node.icon ?? '⭐'}
                    </Text>
                  </Pressable>

                  <Text
                    style={[
                      styles.nodeLabel,
                      completed && styles.labelCompleted,
                      unlocked && !completed && styles.labelActive,
                      !unlocked && styles.labelLocked,
                    ]}
                    numberOfLines={1}
                  >
                    {node.title}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingVertical: spacing.xl, alignItems: 'center' },
  unitContainer: { width: '100%', maxWidth: 440, paddingHorizontal: spacing.lg, marginBottom: spacing.xxl },
  unitHeader: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
  },
  unitTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  unitDesc: { color: colors.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  nodesContainer: { alignItems: 'center', gap: spacing.xxl },
  nodeRow: { alignItems: 'center', width: 140 },
  nodeButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  nodeCompleted: {
    backgroundColor: colors.primary,
    borderColor: '#C6A100',
  },
  nodeActive: {
    backgroundColor: colors.secondary,
    borderColor: '#79C0FF',
    transform: [{ scale: 1.05 }],
  },
  nodeLocked: {
    backgroundColor: colors.nodeLocked,
    borderColor: colors.border,
    opacity: 0.7,
  },
  nodeCheckpoint: {
    borderRadius: 20,
    width: 72,
    height: 72,
  },
  nodeQuiz: {
    borderRadius: 24,
    width: 76,
    height: 76,
    borderWidth: 5,
  },
  nodePressed: { transform: [{ scale: 0.93 }] },
  nodeIcon: { fontSize: 26, color: '#fff' },
  nodeLabel: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelCompleted: { color: colors.primary },
  labelActive: { color: colors.text },
  labelLocked: { color: colors.textMuted },
});
