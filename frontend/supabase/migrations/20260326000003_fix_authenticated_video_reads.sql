-- Allow authenticated users to read videos.
-- The original schema only granted SELECT TO anon.
-- Server-side routes (profile liked/saved) use the authenticated role,
-- so the embedded join on video_likes → videos was silently returning null.
CREATE POLICY "authenticated can read videos"
  ON public.videos FOR SELECT TO authenticated
  USING (true);
