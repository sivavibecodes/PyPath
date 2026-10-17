import { supabase } from './supabase';
import { useProgressStore, type SyncEvent } from '@/stores/progressStore';

class SyncService {
  private isSyncing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  startAutoSync(intervalMs = 30000) {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => void this.syncOutbox(), intervalMs);
    void this.syncOutbox();
  }

  stopAutoSync() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async syncOutbox(): Promise<number> {
    if (this.isSyncing) return 0;
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return 0; // Offline or unauthenticated; queue remains safely in local MMKV

    const store = useProgressStore.getState();
    const pendingEvents: SyncEvent[] = [...store.outbox];
    if (pendingEvents.length === 0) return 0;

    this.isSyncing = true;
    const syncedIds: string[] = [];

    try {
      for (const event of pendingEvents) {
        let error: Error | null = null;
        switch (event.type) {
          case 'xp_awarded':
            const { error: xpErr } = await supabase.rpc('increment_profile_xp', {
              p_user_id: user.id,
              p_xp: event.payload.amount as number,
            });
            error = xpErr ? new Error(xpErr.message) : null;
            break;

          case 'challenge_attempt':
            const { error: attErr } = await supabase.from('challenge_attempts').insert({
              user_id: user.id,
              challenge_id: event.payload.challengeId,
              lesson_id: event.payload.lessonId,
              passed: event.payload.passed,
              score_pct: event.payload.scorePct,
              error_type: event.payload.errorType ?? null,
              created_at: event.occurredAt,
            });
            error = attErr ? new Error(attErr.message) : null;
            break;

          case 'lesson_completed':
            const { error: lesErr } = await supabase.from('user_lessons').upsert({
              user_id: user.id,
              lesson_id: event.payload.lessonId,
              best_score_pct: event.payload.scorePct,
              completed_at: event.occurredAt,
            });
            error = lesErr ? new Error(lesErr.message) : null;
            break;

          case 'quiz_answered':
            const { error: qErr } = await supabase.from('quiz_answers').insert({
              user_id: user.id,
              question_id: event.payload.questionId,
              lesson_id: event.payload.lessonId,
              concept: event.payload.concept,
              correct: event.payload.correct,
              answered_at: event.occurredAt,
            });
            error = qErr ? new Error(qErr.message) : null;
            break;
        }

        if (!error) {
          syncedIds.push(event.id);
        } else {
          console.warn('[SyncService] Failed event sync:', event.type, error.message);
          break; // Stop loop and retry later to maintain causal ordering
        }
      }

      if (syncedIds.length > 0) {
        store.drainOutbox(syncedIds);
      }
    } catch (err) {
      console.warn('[SyncService] Network error during sync:', err);
    } finally {
      this.isSyncing = false;
    }

    return syncedIds.length;
  }

  async fetchLeaderboard(limit = 50) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, xp, streak_count')
      .order('xp', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[SyncService] Leaderboard fetch error:', error.message);
      return [];
    }
    return data ?? [];
  }
}

export const syncService = new SyncService();
