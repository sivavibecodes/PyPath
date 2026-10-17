import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/stores/settingsStore';

/* eslint-disable @typescript-eslint/no-require-imports */
const SOUND_SOURCES = {
  success: require('../../assets/sounds/success.wav'),
  fail: require('../../assets/sounds/fail.wav'),
  levelUp: require('../../assets/sounds/level-up.wav'),
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

type SoundName = keyof typeof SOUND_SOURCES;
const loaded = new Map<SoundName, Audio.Sound>();
let audioReady: Promise<void> | null = null;

function initAudio() {
  audioReady ??= (async () => {
    // Respect the iOS silent switch; never interrupt the user's music.
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: false, shouldDuckAndroid: true, staysActiveInBackground: false });
    await Promise.all(
      (Object.keys(SOUND_SOURCES) as SoundName[]).map(async (name) => {
        const { sound } = await Audio.Sound.createAsync(SOUND_SOURCES[name], { volume: 0.6 });
        loaded.set(name, sound);
      }),
    );
  })().catch((e) => {
    audioReady = null;
    if (__DEV__) console.warn('[feedback] audio init failed', e);
  });
  return audioReady;
}

async function play(name: SoundName) {
  if (!useSettingsStore.getState().soundEnabled) return;
  await initAudio();
  try {
    await loaded.get(name)?.replayAsync();
  } catch {
    /* non-critical */
  }
}

const haptics = () => useSettingsStore.getState().hapticsEnabled;

/** Centralised micro-feedback so every screen feels consistent. */
export const feedback = {
  preload: () => void initAudio(),
  /** Accessory key press. */
  tap: () => {
    if (haptics()) void Haptics.selectionAsync();
  },
  /** All tests pass / correct answer. */
  success: () => {
    if (haptics()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void play('success');
  },
  /** Some tests failed (logic problem, not a crash). */
  partial: () => {
    if (haptics()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    void play('fail');
  },
  /** Exception / syntax error. */
  error: () => {
    if (haptics()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    void play('fail');
  },
  levelUp: () => {
    if (haptics()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    void play('levelUp');
  },
};
