# Roadmap: FinFeed

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-26) — [Archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Multi-Category** — Phases 5-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-26</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-02-24
- [x] Phase 2: Pipeline (5/5 plans) — completed 2026-02-25
- [x] Phase 3: Frontend (4/4 plans) — completed 2026-02-25
- [x] Phase 4: Ship (3/3 plans) — completed 2026-02-26

See full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v1.1 Multi-Category (In Progress)

**Milestone Goal:** Expand FinFeed from finance-only to a two-category app (Finance + Tech) with automated tech pipeline and tab bar UI.

- [x] **Phase 5: Tech Pipeline** - Automated daily tech news edition generation runs on GitHub Actions (completed 2026-03-10)
  - Plans: 2 plans
  - [ ] 05-01-PLAN.md — DB migration + pipeline parameterization (ingest, script, run)
  - [ ] 05-02-PLAN.md — GitHub Actions second independent job for tech pipeline
- [ ] **Phase 6: Category UI** - Tab bar lets users switch between Finance and Tech feeds without page reload

## Phase Details

### Phase 5: Tech Pipeline
**Goal**: A new tech news edition is automatically generated and published daily alongside the existing finance edition
**Depends on**: Phase 4 (existing pipeline and GitHub Actions infrastructure)
**Requirements**: TECH-01, TECH-02, TECH-03
**Success Criteria** (what must be TRUE):
  1. A tech edition appears in Supabase after each scheduled pipeline run
  2. Tech videos are narrated with a tech-appropriate tone — not the financial influencer style used for finance
  3. Tech RSS feeds (TechCrunch, Hacker News, Ars Technica, etc.) are the source — not Yahoo Finance or CNBC
  4. Tech and finance editions are generated independently — a failure in one does not block the other
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — DB migration + pipeline parameterization (ingest, script, run)
- [ ] 05-02-PLAN.md — GitHub Actions second independent job for tech pipeline

### Phase 6: Category UI
**Goal**: Users can switch between Finance and Tech feeds via a tab bar with no page reload and independent per-tab scroll position
**Depends on**: Phase 5
**Requirements**: CATUI-01, CATUI-02, CATUI-03
**Success Criteria** (what must be TRUE):
  1. Finance and Tech tabs are visible at the top of the feed on first load
  2. Tapping a tab switches to that category's feed without a full page reload
  3. Switching from Tech back to Finance (or vice versa) resumes at the same video position the user left — it does not restart from video 1
  4. Each tab shows only its own category's videos — no cross-category mixing
**Plans**: 1 plan

Plans:
- [ ] 06-01-PLAN.md — Tab bar UI, overlay offset adjustments, per-tab scroll position memory

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-24 |
| 2. Pipeline | v1.0 | 5/5 | Complete | 2026-02-25 |
| 3. Frontend | v1.0 | 4/4 | Complete | 2026-02-25 |
| 4. Ship | v1.0 | 3/3 | Complete | 2026-02-26 |
| 5. Tech Pipeline | 2/2 | Complete   | 2026-03-10 | - |
| 6. Category UI | v1.1 | 0/? | Not started | - |
