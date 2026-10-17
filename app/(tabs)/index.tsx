import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/common/Header';
import { PathView } from '@/features/path/PathView';
import { TrackSwitcherModal } from '@/features/path/TrackSwitcherModal';
import { colors } from '@/theme';

export default function HomeScreen() {
  const [trackSwitcherVisible, setTrackSwitcherVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Header onOpenTrackSwitcher={() => setTrackSwitcherVisible(true)} />
        <PathView />
        <TrackSwitcherModal
          visible={trackSwitcherVisible}
          onClose={() => setTrackSwitcherVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, backgroundColor: colors.bg },
});
