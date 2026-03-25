-- ============================================================
-- Social interaction tables: video_likes and video_bookmarks
-- Also adds denormalized like_count to videos, maintained by trigger.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add like_count column to videos
-- ------------------------------------------------------------
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 2. video_likes table
-- Stores one row per (user, video) like. Public read, auth write.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_likes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid        NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_likes_video ON public.video_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_user  ON public.video_likes(user_id);

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

-- SOCL-02: guests must be able to see like counts — allow anyone to read
CREATE POLICY "anyone can read likes"
  ON public.video_likes FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "users can insert own likes"
  ON public.video_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own likes"
  ON public.video_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. video_bookmarks table
-- Bookmarks are PRIVATE — no anon SELECT policy.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_bookmarks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid        NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_bookmarks_user ON public.video_bookmarks(user_id);

ALTER TABLE public.video_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own bookmarks"
  ON public.video_bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own bookmarks"
  ON public.video_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own bookmarks"
  ON public.video_bookmarks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. Trigger function: keep videos.like_count in sync
-- SECURITY DEFINER + SET search_path = '' prevents search-path injection (same
-- pattern as handle_new_user in 20260323000001_add_profiles_and_auth.sql).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_video_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET like_count = like_count + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

-- ------------------------------------------------------------
-- 5. Trigger: fires after INSERT or DELETE on video_likes
-- DROP IF EXISTS first — CREATE TRIGGER does not support OR REPLACE in PG < 14.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS on_like_change ON public.video_likes;

CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_video_like_count();
