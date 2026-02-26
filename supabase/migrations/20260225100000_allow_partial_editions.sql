-- Allow anon key to read partial editions (pipeline ran but some videos failed)
-- Previously only 'published' editions were visible, causing the edition picker
-- to show only 1 edition when others had status='partial'.
DROP POLICY "anon can read published editions" ON editions;

CREATE POLICY "anon can read published editions"
  ON editions FOR SELECT TO anon
  USING (status IN ('published', 'partial'));
