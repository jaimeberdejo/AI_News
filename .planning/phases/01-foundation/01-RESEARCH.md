# Phase 1: Foundation - Research

**Researched:** 2026-02-24
**Domain:** Supabase infrastructure (Postgres schema, Storage, RLS, Python client, Next.js API route)
**Confidence:** HIGH

## Summary

Phase 1 establishes the Supabase infrastructure that every subsequent phase depends on. The work divides into three areas: (1) Postgres schema with RLS policies, (2) Storage bucket with public read access, and (3) connectivity verification — the Python service-key client for the pipeline and the Next.js anon-key client for the frontend API route.

The standard approach for "public read, service-key write" is well-documented and straightforward in Supabase. The service key bypasses RLS entirely — no policy needed for writes. The anon key requires an explicit `SELECT` policy scoped to the `anon` role. Both clients initialize with `create_client(url, key)` or `createClient(url, key)` using environment variables only. Public Storage buckets serve files via a stable CDN-backed URL pattern and support range requests (HTTP 206), enabling direct HTML5 video streaming from Supabase CDN URLs without a proxy.

The one area of medium confidence is Storage range-request behavior under CDN caching. Historical Supabase GitHub discussions confirmed range requests work for public buckets, but a December 2025 report noted intermittent HTML video element failures with public MP4 URLs (direct browser requests worked fine). The verification step for this phase must explicitly test an MP4 `<video>` element pointing at a Supabase public CDN URL.

**Primary recommendation:** Use `supabase-py` 2.28.0 with service key (auth session disabled) for pipeline writes; use `@supabase/supabase-js` with anon key in a plain `createClient()` call for the Next.js route handler `/api/today`. No `@supabase/ssr` package needed — this project has no user auth.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Repo Structure:**
- Monorepo: single AutoNews_AI repository containing both pipeline and frontend
- Directory layout: `/pipeline/` for Python, `/frontend/` for Next.js
- Python pipeline structure: Claude's discretion (package structure recommended for a multi-step pipeline)
- Shared `.env` at repo root — loaded by both pipeline (python-dotenv) and Next.js (auto-loaded)
- `.env.example` at repo root with all required keys documented

**DB Schema:**
- **editions table**: One edition per calendar day. Claude decides whether to support multiple runs per day (e.g. morning/evening) or keep it simple with date as unique key.
- **videos table**: Each video record stores: `position` (1-5), `headline` (story title), `script_text` (full LLM script), `source_url` (original article), `video_url` (Supabase Storage CDN URL), `edition_id` (FK)
- **pipeline_runs table**: Both edition-level status AND per-video status tracking
  - Edition-level: `pending / publishing / published / partial / failed`
  - Per-video: `pending / generating / uploading / ready / failed`
- Cleanup strategy for 7-day retention: Claude's discretion (simple hard delete is fine for MVP)

**Environment Strategy:**
- **Single Supabase project** — dev and prod share the same project for MVP speed
- All API keys (Supabase, Groq, OpenAI, Pexels) stored as environment variables only — never hardcoded
- Keys read via `os.environ` in pipeline (works with `.env` locally and GitHub Actions Secrets in CI)
- RLS policy: Public read with service-key write — anyone can read editions/videos (no auth for v1), only the pipeline service key can insert/update/delete. This matches the open-access MVP design.

**API Contract:**
- **Next.js API route** at `/api/today` (server-side, keeps service key off the client)
- Returns: the most recent published edition with its 5 video records — always return latest even if it's yesterday's (Claude's call: better UX than empty state during pipeline window)
- Video URLs: Direct Supabase Storage public CDN URLs (no signed URLs — public bucket, no expiry complexity)
- No API versioning — just `/api/today` for MVP

### Claude's Discretion
- Python pipeline internal package structure
- Whether editions support one-per-day or multiple-per-day (recommend: one per day for MVP simplicity)
- Hard delete vs soft delete for 7-day cleanup (recommend: hard delete for MVP)
- RLS exact policy syntax
- Supabase Storage bucket name and folder structure
- Exact JSON response shape for `/api/today` (beyond: edition metadata + array of 5 video objects)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Supabase Postgres schema exists with tables for editions, videos, and pipeline_runs | SQL DDL patterns verified via Context7 + official docs; exact schema with constraints, indexes, FK documented in Code Examples section |
| INFRA-02 | Supabase Storage bucket configured with public read access and CORS headers allowing the frontend domain | Public bucket creation API verified; CORS behavior for public buckets confirmed (origin: * by default); range request support for MP4 verified (historical issues resolved); verification test approach documented |
| INFRA-03 | API endpoint returns today's edition with video metadata (URL, title, duration, order) as JSON | Next.js 15 App Router route handler pattern documented; service key client initialization for server-side documented; anon key + RLS for public read documented |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `supabase` (Python) | 2.28.0 | Pipeline: DB insert/update/delete, Storage upload, public URL generation | Official Supabase Python client; service key bypasses RLS; all operations verified |
| `python-dotenv` | 1.2.1 | Load `.env` from repo root into pipeline `os.environ` | find_dotenv() traverses up directory tree; standard 12-factor pattern |
| `@supabase/supabase-js` | v2.58.0 | Next.js route handler: anon key Supabase query | Official JS client; no SSR package needed without user auth |
| `supabase` CLI | latest | Apply SQL migrations to cloud project | `supabase db push` deploys schema; tracks applied migrations |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/ssr` | latest | Cookie-based Supabase auth in Next.js | NOT needed for this project — no user auth in v1 |
| `psycopg2` / direct Postgres | — | Direct DB connection | NOT needed — supabase-py covers all DB operations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/supabase-js` plain | `@supabase/ssr` createServerClient | SSR package required only for user session cookies; adds unnecessary complexity for a public-read API route |
| Supabase CLI migrations | Dashboard SQL editor | CLI is reproducible and version-controlled; dashboard edits are one-off and not tracked |
| `find_dotenv()` | Hardcoded `../.env` path | `find_dotenv()` traverses parent dirs automatically and works regardless of working directory |

**Installation:**
```bash
# Python pipeline
pip install supabase==2.28.0 python-dotenv==1.2.1

# Next.js frontend
npm install @supabase/supabase-js
```

---

## Architecture Patterns

### Recommended Project Structure

```
AutoNews_AI/
├── .env                    # Single source of truth for all credentials
├── .env.example            # Documented template (committed to git)
├── pipeline/               # Python package
│   ├── __init__.py
│   ├── run.py              # Orchestrator (Phase 2+)
│   ├── db.py               # Supabase client factory (service key)
│   └── ...
├── frontend/               # Next.js project
│   ├── app/
│   │   └── api/
│   │       └── today/
│   │           └── route.ts    # /api/today endpoint
│   ├── lib/
│   │   └── supabase.ts     # anon key client
│   └── ...
└── supabase/
    └── migrations/
        └── 20260224000000_initial_schema.sql
```

### Pattern 1: Service Key Client (Python Pipeline)

**What:** Initialize supabase-py with service key; disable auth session settings for server context.
**When to use:** Any pipeline code that writes to the DB or uploads to Storage.

```python
# Source: https://context7.com/supabase/supabase-py/llms.txt
import os
from supabase import create_client, Client
from dotenv import find_dotenv, load_dotenv

# Load .env from repo root (traverses parent dirs automatically)
load_dotenv(find_dotenv(raise_error_if_not_found=True))

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

def get_supabase_client() -> Client:
    """Service key client — bypasses RLS. Never expose this key."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
```

**Key fact (HIGH confidence):** The service key bypasses RLS entirely — Supabase docs state "Service role bypasses RLS policies entirely and will never execute policy checks." No write policy needed.

### Pattern 2: DB Insert / Update / Upsert (Python)

```python
# Source: https://context7.com/supabase/supabase-py/llms.txt
supabase = get_supabase_client()

# Insert a new edition
response = supabase.table("editions").insert({
    "edition_date": "2026-02-24",
    "status": "pending"
}).execute()
edition_id = response.data[0]["id"]

# Update edition status
supabase.table("editions").update({
    "status": "published",
    "published_at": "2026-02-24T08:00:00Z"
}).eq("id", edition_id).execute()

# Upsert (insert or update) — useful for idempotent pipeline runs
supabase.table("editions").upsert({
    "edition_date": "2026-02-24",
    "status": "pending"
}, on_conflict="edition_date").execute()
```

### Pattern 3: Storage Upload + Get Public URL (Python)

```python
# Source: https://context7.com/supabase/supabase-py/llms.txt
bucket = "videos"
storage_path = f"editions/2026-02-24/story-1.mp4"

with open("/tmp/story-1.mp4", "rb") as f:
    supabase.storage.from_(bucket).upload(
        storage_path,
        f,
        {"content-type": "video/mp4", "upsert": "true"}
    )

# Returns: "https://[project].supabase.co/storage/v1/object/public/videos/editions/2026-02-24/story-1.mp4"
public_url = supabase.storage.from_(bucket).get_public_url(storage_path)
```

### Pattern 4: Storage Bulk Delete (7-day cleanup)

```python
# Source: https://context7.com/supabase/supabase-py/llms.txt
# Remove multiple files in one call
paths_to_delete = [
    "editions/2026-02-17/story-1.mp4",
    "editions/2026-02-17/story-2.mp4",
]
supabase.storage.from_("videos").remove(paths_to_delete)
```

### Pattern 5: Anon Key Client (Next.js Route Handler — No Auth)

**What:** Plain `createClient()` with anon key for server-side public data queries. No `@supabase/ssr` needed — that package is for user session cookies, which this project doesn't use.
**When to use:** `/api/today` route handler and any Next.js server component reading public edition data.

```typescript
// Source: https://github.com/supabase/supabase-js README + official docs
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

```typescript
// app/api/today/route.ts
// Source: https://github.com/vercel/next.js canary docs (Route Handlers)
import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data: edition, error } = await supabase
    .from('editions')
    .select(`
      id,
      edition_date,
      status,
      published_at,
      videos (
        id,
        position,
        headline,
        source_url,
        video_url,
        duration
      )
    `)
    .eq('status', 'published')
    .order('edition_date', { ascending: false })
    .limit(1)
    .single()

  if (error || !edition) {
    return NextResponse.json({ error: 'No edition found' }, { status: 404 })
  }

  return NextResponse.json(edition)
}
```

**Important:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose in Next.js — the anon key is a publishable key; RLS restricts what it can access. Only `SUPABASE_SERVICE_KEY` must never be `NEXT_PUBLIC_*` prefixed.

### Pattern 6: Service Key in Next.js Route Handler (if needed)

For any admin Next.js route that needs to bypass RLS:

```typescript
// Source: https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,  // NO NEXT_PUBLIC_ prefix
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)
```

### Pattern 7: RLS Policies — Public Read, Service Key Write

```sql
-- Source: https://supabase.com/docs/guides/auth/row-level-security

-- Enable RLS on both tables
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- Public SELECT for anon key on editions and videos
CREATE POLICY "public can read published editions"
  ON editions FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "public can read videos"
  ON videos FOR SELECT TO anon
  USING (true);

-- NO write policies needed for service_role:
-- "Service role bypasses RLS policies entirely" — Supabase docs
-- The pipeline uses the service key → all writes bypass RLS automatically
```

**Note on pipeline_runs:** No SELECT policy on pipeline_runs — this table is internal audit data. The anon key cannot read it; the service key can read/write freely.

### Pattern 8: SQL Schema (editions, videos, pipeline_runs)

```sql
-- Source: Supabase docs patterns + project requirements

-- editions: one per calendar day
CREATE TABLE editions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_date  date UNIQUE NOT NULL,           -- one per day, natural key
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'publishing', 'published', 'partial', 'failed')),
  published_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_editions_date   ON editions(edition_date DESC);
CREATE INDEX idx_editions_status ON editions(status);

-- videos: 5 per edition
CREATE TABLE videos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id   uuid NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  position     smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  headline     text NOT NULL,
  script_text  text,
  source_url   text,
  video_url    text,
  duration     numeric(5,2),                   -- seconds, e.g. 34.5
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'generating', 'uploading', 'ready', 'failed')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (edition_id, position)
);

CREATE INDEX idx_videos_edition ON videos(edition_id);

-- pipeline_runs: audit log per run
CREATE TABLE pipeline_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id   uuid REFERENCES editions(id) ON DELETE SET NULL,
  started_at   timestamptz DEFAULT now(),
  finished_at  timestamptz,
  status       text NOT NULL DEFAULT 'running'
                 CHECK (status IN ('running', 'complete', 'partial', 'failed')),
  steps_log    jsonb DEFAULT '[]'::jsonb,
  error_log    jsonb DEFAULT '[]'::jsonb
);

CREATE INDEX idx_pipeline_runs_edition ON pipeline_runs(edition_id);
```

### Pattern 9: .env File — Root Monorepo

```bash
# .env (repo root — single source of truth)
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...     # Safe to prefix NEXT_PUBLIC_ (publishable)
SUPABASE_SERVICE_KEY=eyJ...              # NEVER prefix NEXT_PUBLIC_

# Pipeline APIs
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-...
PEXELS_API_KEY=...
```

Next.js auto-loads `.env` at the repo root (or `.env.local`). Python uses:

```python
from dotenv import find_dotenv, load_dotenv
load_dotenv(find_dotenv())  # traverses up from pipeline/ to find root .env
```

### Pattern 10: Storage Bucket Structure

```
Bucket: "videos"  (public: true, fileSizeLimit: "15MB", allowedMimeTypes: ["video/mp4"])

Path convention:
  editions/{YYYY-MM-DD}/story-{1..5}.mp4

Examples:
  editions/2026-02-24/story-1.mp4
  editions/2026-02-24/story-2.mp4
  ...
  editions/2026-02-24/story-5.mp4

Public URL pattern:
  https://[project].supabase.co/storage/v1/object/public/videos/editions/2026-02-24/story-1.mp4
```

Date-keyed folders make 7-day cleanup trivial (delete all files in `editions/2026-02-17/`).

### Anti-Patterns to Avoid

- **`NEXT_PUBLIC_SUPABASE_SERVICE_KEY`:** Exposes service key to the browser — equivalent to giving anyone full DB admin. Use `SUPABASE_SERVICE_KEY` (no NEXT_PUBLIC_ prefix) and only access it in route handlers / server actions.
- **`@supabase/ssr` without user auth:** Adds complexity for cookie management that isn't needed when there are no user sessions. Use plain `@supabase/supabase-js` `createClient()` in route handlers.
- **Signed URLs for public video:** Signed URLs expire; public CDN URLs are permanent. Public bucket is the correct choice for open-access video content.
- **Service key in client components:** Any file imported by a client component in Next.js is bundled to the browser. Service key must only live in route handlers and server actions.
- **Write policy for service_role:** Unnecessary — service role bypasses RLS unconditionally. Adding one is harmless but misleading.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env var loading with monorepo parent-dir traversal | Custom file path search | `find_dotenv()` from python-dotenv | Handles all working directory edge cases; works in GitHub Actions too |
| DB schema versioning | Manual SQL tracking | Supabase CLI migrations (`supabase/migrations/`) | Tracks applied migrations in `supabase_migrations.schema_migrations`; idempotent apply |
| Public CDN URL generation | String concatenation of URL parts | `supabase.storage.from_(bucket).get_public_url(path)` | Handles URL encoding, project-specific base URL; avoids brittle string building |
| Multi-file Storage delete | Loop of single deletes | `.remove([path1, path2, ...])` | Single API call for batch delete |

**Key insight:** The Supabase SDK handles URL encoding, auth headers, retry on 5xx, and response parsing. Don't bypass it with raw `httpx` calls to the Supabase REST API.

---

## Common Pitfalls

### Pitfall 1: Service Key Leaked via NEXT_PUBLIC_ Prefix

**What goes wrong:** Pipeline service key ends up in browser JavaScript bundle.
**Why it happens:** Developer copies `.env.example` and adds `NEXT_PUBLIC_` prefix to all Supabase keys for convenience.
**How to avoid:** Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` get the `NEXT_PUBLIC_` prefix. Service key is `SUPABASE_SERVICE_KEY` with no prefix.
**Warning signs:** Browser network tab shows service key in Authorization header on client requests.

### Pitfall 2: python-dotenv Not Finding Root .env From pipeline/ Subdirectory

**What goes wrong:** `load_dotenv()` without `find_dotenv()` looks only in the current working directory. If the script runs from `pipeline/`, it won't find `.env` at repo root.
**Why it happens:** `load_dotenv()` default behavior searches current directory, not parent directories.
**How to avoid:** Always use `load_dotenv(find_dotenv())` — `find_dotenv()` traverses up the directory tree.
**Warning signs:** `os.environ.get("SUPABASE_URL")` returns `None` despite `.env` existing at root.

### Pitfall 3: RLS Blocks Anon Reads If Policy Is Missing

**What goes wrong:** `supabase.from("editions").select()` returns empty array from frontend — no error, just empty.
**Why it happens:** RLS is enabled but no SELECT policy for anon role exists. Supabase returns empty instead of 403 by default.
**How to avoid:** Create explicit `CREATE POLICY ... FOR SELECT TO anon USING (true)` after enabling RLS. Verify by testing with anon key, not service key.
**Warning signs:** Query works with service key but returns `[]` with anon key.

### Pitfall 4: Storage Range Requests (Video Seeking/Streaming)

**What goes wrong:** HTML `<video>` element fails to load or seek in MP4 from Supabase public CDN URL.
**Why it happens:** Supabase Storage uses Cloudflare CDN. CDN cache layer occasionally returns HTTP 200 (full file) instead of 206 (partial content) for range requests, causing Safari and some browsers to refuse playback.
**How to avoid:** Test an actual `<video src="[supabase-url]">` in Safari on iOS after bucket creation. This is a known intermittent issue. If it fails, contact Supabase support (historically resolved quickly). The issue is CDN-side, not configuration you control.
**Warning signs:** `<video>` spins indefinitely; network tab shows `cf-cache-status: MISS` on all requests; no `Accept-Ranges` header in response.

### Pitfall 5: Supabase Migration Not Applied to Cloud

**What goes wrong:** Schema exists locally or in Dashboard SQL editor but `pipeline_runs` / `videos` table is missing in cloud after deploy.
**Why it happens:** SQL run in Dashboard is not tracked by CLI migration history.
**How to avoid:** Put all schema DDL in `supabase/migrations/`. Apply with `supabase db push --linked`. Verify with `supabase migration list`.
**Warning signs:** `supabase.table("editions").insert(...)` returns 404 PostgREST error "relation does not exist".

### Pitfall 6: No `updated_at` Auto-Update Trigger

**What goes wrong:** `updated_at` column stays at creation time even after updates.
**Why it happens:** Postgres doesn't auto-update `updated_at` — requires a trigger.
**How to avoid:** Add a trigger function in migration or use Supabase's `moddatetime` extension.
**Warning signs:** `updated_at` always equals `created_at` in rows that have been updated.

---

## Code Examples

Verified patterns from official sources:

### Complete Pipeline DB Client

```python
# pipeline/db.py
# Source: https://context7.com/supabase/supabase-py/llms.txt
import os
from supabase import create_client, Client
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(raise_error_if_not_found=True))

_client: Client | None = None

def get_db() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
    return _client
```

### Complete /api/today Route Handler

```typescript
// frontend/app/api/today/route.ts
// Source: https://github.com/vercel/next.js canary docs + https://supabase.com/docs
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('editions')
    .select(`
      id,
      edition_date,
      status,
      published_at,
      videos (
        id,
        position,
        headline,
        source_url,
        video_url,
        duration
      )
    `)
    .eq('status', 'published')
    .order('edition_date', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ edition: null }, { status: 200 })
    // Return 200 with null — frontend handles "no edition yet" state
  }

  // Sort videos by position before returning
  data.videos?.sort((a, b) => a.position - b.position)

  return NextResponse.json({ edition: data })
}
```

### Full Migration File

```sql
-- supabase/migrations/20260224000000_initial_schema.sql
-- Source: Supabase CLI migration pattern + project requirements

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

CREATE TABLE IF NOT EXISTS videos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id   uuid NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  position     smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  headline     text NOT NULL,
  script_text  text,
  source_url   text,
  video_url    text,
  duration     numeric(5,2),
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'generating', 'uploading', 'ready', 'failed')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (edition_id, position)
);

CREATE INDEX IF NOT EXISTS idx_videos_edition ON videos(edition_id);

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

-- RLS
ALTER TABLE editions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs  ENABLE ROW LEVEL SECURITY;

-- Public read for editions (published only) and videos
CREATE POLICY "anon can read published editions"
  ON editions FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "anon can read videos"
  ON videos FOR SELECT TO anon
  USING (true);

-- pipeline_runs: no anon access (internal audit log)
-- service_role bypasses RLS for all write operations automatically
```

### Bucket Creation (Supabase Dashboard or CLI)

```sql
-- Via Supabase Dashboard Storage UI: Create bucket named "videos", check "Public bucket"
-- OR via SQL (storage schema):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,
  15728640,        -- 15 MB in bytes
  ARRAY['video/mp4']
)
ON CONFLICT (id) DO NOTHING;
```

### Verify Anon Key Read Works (Python test script)

```python
# Quick verification: anon key can read published editions, cannot read pipeline_runs
from supabase import create_client
import os

anon_client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])

# Should return editions with status='published'
result = anon_client.table("editions").select("*").execute()
print("Editions visible to anon:", result.data)

# Should return empty (RLS blocks it)
result = anon_client.table("pipeline_runs").select("*").execute()
print("pipeline_runs visible to anon:", result.data)  # expect []
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createRouteHandlerClient` (auth-helpers) | `createClient` from `@supabase/supabase-js` | 2023-2024 | Auth-helpers deprecated; plain createClient is correct for no-auth routes |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` (for auth) or plain `supabase-js` (no auth) | 2024 | Auth helpers replaced; SSR package for user sessions; plain JS client for public routes |
| Signed URLs for public assets | Public bucket CDN URLs via `getPublicUrl()` | N/A | No expiry, no generation cost, better CDN cache hit rate |
| Single `.env.local` in Next.js root | Shared `.env` at monorepo root | N/A | Both Python and Next.js read from same file |

**Deprecated/outdated:**
- `createRouteHandlerClient`: Replaced by plain `createClient`. Do not use.
- `supabase.auth.getSession()` for server protection: Replaced by `supabase.auth.getUser()`. Irrelevant to this project (no auth) but good to know.

---

## Open Questions

1. **Storage range request reliability in production**
   - What we know: Public bucket MP4s serve via Cloudflare CDN; range requests are supported at the storage layer; a December 2025 GitHub issue reported HTML `<video>` element failures (direct browser requests worked)
   - What's unclear: Whether this is an intermittent CDN cache issue or a configuration issue fixable at bucket creation time
   - Recommendation: Make explicit range-request verification a required verification step in Phase 1. If `<video>` element fails to load/seek during testing, open a Supabase support ticket — historically resolved quickly. This is not a blocker to creating the bucket or schema.

2. **`updated_at` auto-update trigger**
   - What we know: Postgres requires a trigger to auto-update `updated_at` on row modification
   - What's unclear: Whether to include a trigger in the migration or rely on explicit `updated_at` in all update calls
   - Recommendation: Include a simple trigger in the migration for correctness. Alternatively, always include `updated_at: datetime.utcnow().isoformat()` explicitly in all Python update calls — simpler and avoids trigger complexity for MVP.

3. **Supabase free tier verification**
   - What we know: Documented as 1 GB storage, 2 GB egress (MEDIUM confidence — must verify current limits)
   - What's unclear: Whether limits changed since last check
   - Recommendation: Verify at https://supabase.com/pricing before Phase 1 execution. This doesn't block schema creation but informs how aggressively to enforce the 7-day retention policy.

---

## Sources

### Primary (HIGH confidence)

- `/supabase/supabase-py` (Context7) — Python client init, insert, update, upsert, delete, storage upload, get_public_url, bulk remove
- `/theskumar/python-dotenv` (Context7) — find_dotenv traversal, load_dotenv patterns
- `/supabase/supabase-js` (Context7) — createClient JS init, environment variable names
- `/websites/supabase` (Context7) — RLS policy syntax, service_role bypass behavior, storage bucket creation API, migration patterns
- `/vercel/next.js` (Context7) — Route handler GET pattern, Response.json(), force-static caching
- https://supabase.com/docs/guides/auth/row-level-security — RLS policy for anon SELECT
- https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa — Service key createClient with auth disabled
- https://adrianmurage.com/posts/supabase-service-role-secret-key/ — Next.js Route Handler service key pattern (MEDIUM → HIGH: consistent with official Supabase docs)

### Secondary (MEDIUM confidence)

- https://github.com/orgs/supabase/discussions/4115 — Storage range requests work for public buckets; historical temporary issue resolved (2021 thread, may not reflect Dec 2025 reports)
- https://pypi.org/project/supabase/ — Confirmed supabase-py version 2.28.0, Python >=3.9 requirement
- Web search: Supabase Storage public buckets use origin:* CORS by default — consistent across multiple sources

### Tertiary (LOW confidence — verify)

- December 2025 GitHub issue reporting HTML `<video>` element failures with Supabase public MP4 URLs (single source, not verified with official docs) — flagged as verification requirement
- Supabase free tier limits (1 GB storage, 2 GB egress) — documented in project SUMMARY.md as MEDIUM confidence; verify at supabase.com/pricing before execution

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via PyPI, Context7, official docs; all packages are official/stable
- Architecture: HIGH — RLS patterns, service key bypass, anon key read, python-dotenv traversal all verified via Context7 official docs
- SQL schema: HIGH — standard Postgres DDL; data types, constraints, indexes follow Supabase official patterns
- Storage range requests: MEDIUM — basic functionality confirmed; CDN intermittent behavior is a known variable
- Pitfalls: HIGH — service key exposure, dotenv path, RLS silent empty response all verified; storage range issue flagged with verification step

**Research date:** 2026-02-24
**Valid until:** 2026-04-24 (stable APIs — 60 days; supabase-py releases frequently so verify version before install)
