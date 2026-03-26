-- Phase 10: Comments — video_comments table, RLS, denormalized comment_count, trigger
-- Migration: 20260326000001_add_comments.sql

-- 1. Add comment_count to videos (consistent with like_count from Phase 9)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

-- 2. video_comments: one row per comment
--    user_id references public.profiles (not auth.users) to enable Supabase embedded join syntax
CREATE TABLE IF NOT EXISTS public.video_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) <= 500 AND char_length(body) > 0),
  created_at timestamptz DEFAULT now()
);

-- 3. Indexes
-- For fetching comments by video ordered by time (primary read pattern)
CREATE INDEX IF NOT EXISTS idx_video_comments_video   ON public.video_comments(video_id, created_at);
-- For rate-limit query: user's most recent comment across all videos
CREATE INDEX IF NOT EXISTS idx_video_comments_user_ts ON public.video_comments(user_id, created_at DESC);

-- 4. Enable RLS
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies
-- Guests and signed-in users can read all comments (COMM-01: guests read freely)
CREATE POLICY "anyone can read comments"
  ON public.video_comments FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only signed-in users can insert their own comments
CREATE POLICY "users can insert own comments"
  ON public.video_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own comments (COMM-02)
CREATE POLICY "users can delete own comments"
  ON public.video_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Trigger function to maintain comment_count on videos
--    SECURITY DEFINER + SET search_path = '' follows established project security pattern
CREATE OR REPLACE FUNCTION public.update_video_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET comment_count = comment_count + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 7. Trigger — drop first to allow re-running the migration safely
DROP TRIGGER IF EXISTS on_comment_change ON public.video_comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_video_comment_count();
