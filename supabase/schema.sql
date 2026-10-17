-- ==============================================================================
-- PyPath Production Supabase Schema
-- Aligned with offline-first sync, XP leaderboards, and mistake analytics
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  xp INTEGER DEFAULT 0 NOT NULL,
  streak_count INTEGER DEFAULT 0 NOT NULL,
  longest_streak INTEGER DEFAULT 0 NOT NULL,
  selected_track TEXT DEFAULT 'certification' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. User Completed Lessons
CREATE TABLE IF NOT EXISTS public.user_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_id TEXT NOT NULL,
  best_score_pct INTEGER DEFAULT 0 NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, lesson_id)
);

-- 3. Challenge Attempts & Mistake Tracking
CREATE TABLE IF NOT EXISTS public.challenge_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  challenge_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  score_pct INTEGER NOT NULL,
  error_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Quiz Answers
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  concept TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Mock Exam Submissions
CREATE TABLE IF NOT EXISTS public.mock_exam_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id TEXT NOT NULL,
  certification TEXT NOT NULL,
  score_pct INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  duration_seconds INTEGER NOT NULL,
  section_scores JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their own lesson completions" 
  ON public.user_lessons FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own lesson completions" 
  ON public.user_lessons FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own challenge attempts" 
  ON public.challenge_attempts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own challenge attempts" 
  ON public.challenge_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own quiz answers" 
  ON public.quiz_answers FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz answers" 
  ON public.quiz_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own mock exam results" 
  ON public.mock_exam_results FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mock exam results" 
  ON public.mock_exam_results FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- Atomic Stored Procedures (RPC)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.increment_profile_xp(p_user_id UUID, p_xp INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET xp = xp + p_xp,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
