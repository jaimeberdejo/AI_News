-- Phase 5: Add category column to support multiple news categories (finance, tech)
ALTER TABLE editions
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'finance'
    CHECK (category IN ('finance', 'tech'));

CREATE INDEX IF NOT EXISTS idx_editions_category ON editions(category);
