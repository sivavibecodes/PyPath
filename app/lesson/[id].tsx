import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getLesson } from '@/content/registry';
import { LessonScreen } from '@/features/lesson/LessonScreen';
import { colors } from '@/theme';

export default function LessonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = id ? getLesson(id) : undefined;

  if (!lesson) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.errorText}>Lesson '{id}' not found.</Text>
      </View>
    );
  }

  return <LessonScreen lesson={lesson} />;
}

const styles = StyleSheet.create({
  notFound: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
});
