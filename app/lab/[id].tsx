import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getLesson, getPracticeChallenge } from '@/content/registry';
import { CodeLabScreen } from '@/features/lab/CodeLabScreen';
import { colors } from '@/theme';

export default function LabRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = id ? getLesson(id) : undefined;
  const challenge = lesson ? getPracticeChallenge(lesson) : undefined;

  if (!lesson || !challenge) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.errorText}>Coding Challenge not found for '{id}'.</Text>
      </View>
    );
  }

  return <CodeLabScreen lesson={lesson} challenge={challenge} />;
}

const styles = StyleSheet.create({
  notFound: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
});
