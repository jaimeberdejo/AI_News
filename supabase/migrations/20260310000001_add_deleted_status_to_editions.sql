-- Fix: add 'deleted' to editions status CHECK constraint (used by storage.cleanup_old_editions)
ALTER TABLE editions DROP CONSTRAINT IF EXISTS editions_status_check;

ALTER TABLE editions
  ADD CONSTRAINT editions_status_check
    CHECK (status IN ('pending', 'publishing', 'published', 'partial', 'failed', 'deleted'));
