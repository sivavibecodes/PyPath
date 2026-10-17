import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MOCK_EXAMS } from '@/content/mockExams';
import { MockExamScreen } from '@/features/cert/MockExamScreen';
import { colors } from '@/theme';

export default function ExamRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exam = id ? MOCK_EXAMS[id] : undefined;

  if (!exam) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.errorText}>Mock Exam '{id}' not found.</Text>
      </View>
    );
  }

  return <MockExamScreen exam={exam} />;
}

const styles = StyleSheet.create({
  notFound: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
});
