-- FinFeed initial schema
-- Apply with: supabase db push --linked

-- editions: one per calendar day
CREATE TABLE IF NOT EXISTS editions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_date  date UNIQUE NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'publishing', 'published', 'partial', 'failed')),
  published_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editions_date   ON editions(edition_date DESC);
CREATE INDEX IF NOT EXISTS idx_editions_status ON editions(status);

-- videos: up to 5 per edition, ordered by position
CREATE TABLE IF NOT EXISTS videos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id   uuid NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  position     smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  headline     text NOT NULL,
  script_text  text,
  source_url   text,
  video_url    text,
  duration     numeric(5,2),   -- seconds, e.g. 34.50
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'generating', 'uploading', 'ready', 'failed')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (edition_id, position)
);

CREATE INDEX IF NOT EXISTS idx_videos_edition ON videos(edition_id);

-- pipeline_runs: audit log — one row per pipeline execution
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id   uuid REFERENCES editions(id) ON DELETE SET NULL,
  started_at   timestamptz DEFAULT now(),
  finished_at  timestamptz,
  status       text NOT NULL DEFAULT 'running'
                 CHECK (status IN ('running', 'complete', 'partial', 'failed')),
  steps_log    jsonb DEFAULT '[]'::jsonb,
  error_log    jsonb DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_edition ON pipeline_runs(edition_id);

-- RLS: enable on all tables
ALTER TABLE editions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs  ENABLE ROW LEVEL SECURITY;

-- Public read: anon key can read published editions and their videos
-- (service_role bypasses RLS automatically — no write policies needed)
CREATE POLICY "anon can read published editions"
  ON editions FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "anon can read videos"
  ON videos FOR SELECT TO anon
  USING (true);

-- pipeline_runs has no anon SELECT policy — internal audit data only
