import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStateStorage } from '@/lib/storage';
import type { ID } from '@/types/curriculum';

// ── Domain types ────────────────────────────────────────────────────────────
export interface StreakState {
  current: number;
  longest: number;
  /** Local calendar day, YYYY-MM-DD. */
  lastActiveDay: string | null;
  freezesAvailable: number;
}

export interface CompletionRecord {
  completedAt: string;
  attempts: number;
  bestScorePct: number;
  hintsUsed: number;
}

export interface MistakeStat {
  count: number;
  lastSeen: string;
  /** Most recent lessons where it happened (max 5). */
  lessons: ID[];
}

export interface ConceptStat {
  attempts: number;
  failures: number;
  lastPracticed: string;
}

/** Outbox event mirrored to Supabase by services/sync.ts (server re-validates XP). */
export interface SyncEvent {
  id: string;
  type: 'xp_awarded' | 'lesson_completed' | 'challenge_attempt' | 'quiz_answered';
  payload: Record<string, unknown>;
  occurredAt: string;
}

interface ProgressState {
  xp: number;
  xpByDay: Record<string, number>;
  streak: StreakState;
  completedLessons: Record<ID, CompletionRecord>;
  completedChallenges: Record<ID, CompletionRecord>;
  attemptsByChallenge: Record<ID, number>;
  /** Keyed by Python error type, e.g. "IndexError" — powers "mistake analysis". */
  mistakes: Record<string, MistakeStat>;
  concepts: Record<string, ConceptStat>;
  outbox: SyncEvent[];

  awardXp: (amount: number, reason: string) => void;
  recordChallengeAttempt: (input: {
    challengeId: ID;
    lessonId: ID;
    passed: boolean;
    scorePct: number;
    concepts: string[];
    errorType?: string | null;
    hintsUsed: number;
    xpReward: number;
  }) => { xpAwarded: number; firstCompletion: boolean };
  recordQuizAnswer: (input: { questionId: ID; lessonId: ID; concept: string; correct: boolean }) => void;
  completeLesson: (lessonId: ID, xpReward: number, scorePct: number) => void;
  drainOutbox: (ids: string[]) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function nextStreak(s: StreakState, today: string): StreakState {
  if (s.lastActiveDay === today) return s;
  const gap = s.lastActiveDay ? daysBetween(s.lastActiveDay, today) : Infinity;
  let current: number;
  let freezes = s.freezesAvailable;
  if (gap === 1) current = s.current + 1;
  else if (gap === 2 && freezes > 0) {
    freezes -= 1; // a streak freeze covers exactly one missed day
    current = s.current + 1;
  } else current = 1;
  return { current, longest: Math.max(s.longest, current), lastActiveDay: today, freezesAvailable: freezes };
}

/** Level curve: level n requires 50·n·(n+1)/2 XP (50, 150, 300, 500…). */
export function levelForXp(xp: number) {
  let level = 1;
  while (xp >= (50 * level * (level + 1)) / 2) level++;
  const floor = (50 * (level - 1) * level) / 2;
  const ceil = (50 * level * (level + 1)) / 2;
  return { level, progress: (xp - floor) / (ceil - floor), toNext: ceil - xp };
}

// ── Store ───────────────────────────────────────────────────────────────────
export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      xp: 0,
      xpByDay: {},
      streak: { current: 0, longest: 0, lastActiveDay: null, freezesAvailable: 1 },
      completedLessons: {},
      completedChallenges: {},
      attemptsByChallenge: {},
      mistakes: {},
      concepts: {},
      outbox: [],

      awardXp: (amount, reason) => {
        if (amount <= 0) return;
        const today = dayKey();
        set((s) => ({
          xp: s.xp + amount,
          xpByDay: { ...s.xpByDay, [today]: (s.xpByDay[today] ?? 0) + amount },
          streak: nextStreak(s.streak, today),
          outbox: [...s.outbox, { id: uid(), type: 'xp_awarded', payload: { amount, reason }, occurredAt: new Date().toISOString() }],
        }));
      },

      recordChallengeAttempt: ({ challengeId, lessonId, passed, scorePct, concepts, errorType, hintsUsed, xpReward }) => {
        const now = new Date().toISOString();
        const s = get();
        const attempts = (s.attemptsByChallenge[challengeId] ?? 0) + 1;
        const prior = s.completedChallenges[challengeId];
        const firstCompletion = passed && !prior;

        const conceptsNext = { ...s.concepts };
        for (const c of concepts) {
          const cur = conceptsNext[c] ?? { attempts: 0, failures: 0, lastPracticed: now };
          conceptsNext[c] = { attempts: cur.attempts + 1, failures: cur.failures + (passed ? 0 : 1), lastPracticed: now };
        }

        const mistakesNext = { ...s.mistakes };
        if (!passed && errorType) {
          const cur = mistakesNext[errorType] ?? { count: 0, lastSeen: now, lessons: [] };
          mistakesNext[errorType] = {
            count: cur.count + 1,
            lastSeen: now,
            lessons: [lessonId, ...cur.lessons.filter((l) => l !== lessonId)].slice(0, 5),
          };
        }

        const completedNext = passed
          ? {
              ...s.completedChallenges,
              [challengeId]: {
                completedAt: prior?.completedAt ?? now,
                attempts,
                bestScorePct: Math.max(prior?.bestScorePct ?? 0, scorePct),
                hintsUsed: Math.min(prior?.hintsUsed ?? Infinity, hintsUsed),
              },
            }
          : s.completedChallenges;

        set({
          attemptsByChallenge: { ...s.attemptsByChallenge, [challengeId]: attempts },
          concepts: conceptsNext,
          mistakes: mistakesNext,
          completedChallenges: completedNext,
          outbox: [
            ...s.outbox,
            { id: uid(), type: 'challenge_attempt', payload: { challengeId, lessonId, passed, scorePct, errorType }, occurredAt: now },
          ],
        });

        // XP only for the first full pass; first-try bonus, hint costs already deducted from xpReward.
        let xpAwarded = 0;
        if (firstCompletion && xpReward > 0) {
          xpAwarded = Math.max(5, xpReward + (attempts === 1 ? Math.round(xpReward * 0.25) : 0));
          get().awardXp(xpAwarded, `challenge:${challengeId}`);
        }
        return { xpAwarded, firstCompletion };
      },

      recordQuizAnswer: ({ questionId, lessonId, concept, correct }) => {
        const now = new Date().toISOString();
        set((s) => {
          const cur = s.concepts[concept] ?? { attempts: 0, failures: 0, lastPracticed: now };
          return {
            concepts: { ...s.concepts, [concept]: { attempts: cur.attempts + 1, failures: cur.failures + (correct ? 0 : 1), lastPracticed: now } },
            outbox: [...s.outbox, { id: uid(), type: 'quiz_answered', payload: { questionId, lessonId, concept, correct }, occurredAt: now }],
          };
        });
      },

      completeLesson: (lessonId, xpReward, scorePct) => {
        const s = get();
        const now = new Date().toISOString();
        const prior = s.completedLessons[lessonId];
        set({
          completedLessons: {
            ...s.completedLessons,
            [lessonId]: {
              completedAt: prior?.completedAt ?? now,
              attempts: (prior?.attempts ?? 0) + 1,
              bestScorePct: Math.max(prior?.bestScorePct ?? 0, scorePct),
              hintsUsed: prior?.hintsUsed ?? 0,
            },
          },
          outbox: [...s.outbox, { id: uid(), type: 'lesson_completed', payload: { lessonId, scorePct }, occurredAt: now }],
        });
        if (!prior) get().awardXp(xpReward, `lesson:${lessonId}`);
      },

      drainOutbox: (ids) => {
        const drop = new Set(ids);
        set((s) => ({ outbox: s.outbox.filter((e) => !drop.has(e.id)) }));
      },
    }),
    { name: 'progress', version: 1, storage: createJSONStorage(() => mmkvStateStorage) },
  ),
);

/** Concepts with the highest failure ratio (min. 2 attempts) — feeds "Review your weak spots". */
export function selectWeakConcepts(state: Pick<ProgressState, 'concepts'>, limit = 3): string[] {
  return Object.entries(state.concepts)
    .filter(([, c]) => c.attempts >= 2)
    .sort(([, a], [, b]) => b.failures / b.attempts - a.failures / a.attempts)
    .slice(0, limit)
    .map(([k]) => k);
}
