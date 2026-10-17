import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStateStorage } from '@/lib/storage';
import type { ID } from '@/types/curriculum';

interface DraftState {
  /** challengeId → learner's in-progress code. */
  drafts: Record<ID, { code: string; updatedAt: number }>;
  hintsRevealed: Record<ID, number>;
  saveDraft: (challengeId: ID, code: string) => void;
  clearDraft: (challengeId: ID) => void;
  revealHint: (challengeId: ID) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      hintsRevealed: {},
      saveDraft: (challengeId, code) =>
        set((s) => ({ drafts: { ...s.drafts, [challengeId]: { code, updatedAt: Date.now() } } })),
      clearDraft: (challengeId) =>
        set((s) => {
          const { [challengeId]: _removed, ...rest } = s.drafts;
          return { drafts: rest };
        }),
      revealHint: (challengeId) =>
        set((s) => ({ hintsRevealed: { ...s.hintsRevealed, [challengeId]: (s.hintsRevealed[challengeId] ?? 0) + 1 } })),
    }),
    { name: 'drafts', version: 1, storage: createJSONStorage(() => mmkvStateStorage) },
  ),
);
