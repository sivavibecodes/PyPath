import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStateStorage } from '@/lib/storage';
import type { ProfessionId } from '@/types/curriculum';

export type ActiveTrack = { kind: 'certification' } | { kind: 'profession'; profession: ProfessionId };

interface SettingsState {
  activeTrack: ActiveTrack;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  editorFontSize: number;
  lineWrapping: boolean;
  dailyGoalXp: number;
  setActiveTrack: (t: ActiveTrack) => void;
  update: (patch: Partial<Omit<SettingsState, 'update' | 'setActiveTrack'>>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeTrack: { kind: 'certification' },
      hapticsEnabled: true,
      soundEnabled: true,
      editorFontSize: 14,
      lineWrapping: true,
      dailyGoalXp: 50,
      setActiveTrack: (activeTrack) => set({ activeTrack }),
      update: (patch) => set(patch),
    }),
    { name: 'settings', version: 1, storage: createJSONStorage(() => mmkvStateStorage) },
  ),
);
