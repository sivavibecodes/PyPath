import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CHEAT_SHEET_ENTRIES } from '@/content/cheatsheet';
import { colors, fonts, radius, spacing } from '@/theme';
import type { CheatSheetEntry } from '@/types/curriculum';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'syntax', label: 'Syntax' },
  { id: 'collections', label: 'Collections' },
  { id: 'control_flow', label: 'Control Flow' },
  { id: 'functions', label: 'Functions' },
  { id: 'oop', label: 'OOP' },
  { id: 'stdlib', label: 'Stdlib' },
  { id: 'pandas', label: 'Pandas' },
];

export function CheatSheetScreen() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CHEAT_SHEET_ENTRIES.filter((entry) => {
      const matchesCat = selectedCategory === 'all' || entry.category === selectedCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.syntax.toLowerCase().includes(q) ||
        entry.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [search, selectedCategory]);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search syntax, keywords (e.g. if, dict, slice, pandas)…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Category Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow} contentContainerStyle={styles.catContent}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => setSelectedCategory(cat.id)}
            style={[styles.catPill, selectedCategory === cat.id && styles.catPillActive]}
          >
            <Text style={[styles.catText, selectedCategory === cat.id && styles.catTextActive]}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Reference Entries List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No matching syntax found</Text>
            <Text style={styles.emptySubtitle}>Try searching for broader keywords like 'loop', 'list', or 'format'.</Text>
          </View>
        ) : (
          filtered.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <View key={entry.id} style={styles.card}>
                <Pressable
                  onPress={() => setExpandedId(isExpanded ? null : entry.id)}
                  style={styles.cardHeader}
                >
                  <View style={styles.titleArea}>
                    <Text style={styles.title}>{entry.title}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{entry.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                </Pressable>

                {/* Always show syntax definition */}
                <View style={styles.syntaxBox}>
                  <Text selectable style={styles.syntaxText}>{entry.syntax}</Text>
                </View>

                {isExpanded && (
                  <View style={styles.expandedSection}>
                    <Text style={styles.sectionLabel}>Example:</Text>
                    <View style={styles.exampleBox}>
                      <Text selectable style={styles.exampleText}>{entry.example}</Text>
                    </View>

                    {entry.output && (
                      <View style={styles.outputBox}>
                        <Text style={styles.outputLabel}>Output:</Text>
                        <Text selectable style={styles.outputText}>{entry.output}</Text>
                      </View>
                    )}

                    <Text style={styles.notesText}>{entry.notes}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  catRow: { flexGrow: 0, paddingBottom: spacing.sm },
  catContent: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  catPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  catTextActive: { color: '#000' },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  badge: {
    backgroundColor: colors.keyAccent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: { color: colors.secondary, fontSize: 10, fontWeight: '800' },
  chevron: { color: colors.textMuted, fontSize: 12 },
  syntaxBox: {
    backgroundColor: colors.editorBg,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syntaxText: { color: colors.primary, fontFamily: fonts.mono, fontSize: 12, lineHeight: 18 },
  expandedSection: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  sectionLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', marginBottom: 4 },
  exampleBox: {
    backgroundColor: colors.editorBg,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  exampleText: { color: colors.text, fontFamily: fonts.mono, fontSize: 12, lineHeight: 18 },
  outputBox: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  outputLabel: { color: colors.textMuted, fontSize: 10, textTransform: 'uppercase' },
  outputText: { color: colors.success, fontFamily: fonts.mono, fontSize: 12, marginTop: 2 },
  notesText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl * 2 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptySubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },
});
