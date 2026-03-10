# Requirements: FinFeed

**Defined:** 2026-03-10
**Core Value:** A finite, curated daily briefing in vertical video format — users always know when they're done.

## v1.1 Requirements

Requirements for the Multi-Category milestone. Each maps to roadmap phases.

### Tech Pipeline

- [ ] **TECH-01**: A new tech news edition is automatically generated and published daily
- [ ] **TECH-02**: Tech pipeline ingests from free tech-focused RSS feeds (TechCrunch, Hacker News, Ars Technica, etc.)
- [ ] **TECH-03**: Tech video scripts use a tech-appropriate narration tone (not the financial influencer style)

### Category UI

- [ ] **CATUI-01**: User sees Finance and Tech tabs at the top of the feed
- [ ] **CATUI-02**: User can switch between Finance and Tech by tapping a tab (no page reload)
- [ ] **CATUI-03**: Each tab maintains its own video position — switching tabs doesn't reset where the user was

## Future Requirements (v1.2+)

### Quality

- **QUAL-01**: Hallucination guard — validate numbers/% in scripts against source articles
- **QUAL-02**: Upgrade LLM for sharper script writing
- **QUAL-03**: Upgrade TTS (tts-1-hd or ElevenLabs) for more expressive narration
- **QUAL-04**: Replace Pexels free tier b-roll with premium stock footage

### Engagement

- **PUSH-01**: Push notifications for new daily edition
- **AUTH-01**: User accounts with watch history
- **AUTH-02**: Notification preferences per user

### Expansion

- **CAT-01**: Sports news category
- **CAT-02**: Politics news category
- **CAT-03**: Science news category

## Out of Scope (v1.1)

| Feature | Reason |
|---------|--------|
| Quality upgrades (QUAL-01–04) | Deferred to v1.2+ — cost not justified until scale |
| Push notifications (PUSH-01) | Deferred to v1.2+ |
| User accounts (AUTH-01–02) | Deferred to v1.2+ |
| Sports / politics / science categories | v1.1 adds tech only — expand in v1.2+ |
| Native mobile app | PWA web-first only |
| Multiple languages | English only |
| Personalized feeds | One curated feed per category for all users |
| Monetization | Validation phase only |
| Social features | Not core to finite feed value proposition |
| Infinite scroll | Defeats the core "finite" product promise |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TECH-01 | Phase 5 | Pending |
| TECH-02 | Phase 5 | Pending |
| TECH-03 | Phase 5 | Pending |
| CATUI-01 | Phase 6 | Pending |
| CATUI-02 | Phase 6 | Pending |
| CATUI-03 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 — traceability populated after roadmap creation*
