# MVP Milestones

Four milestones to a working Clawtlas. Each is shippable. Each has clear acceptance criteria.

---

## M1: The Journal (Week 1-2)

**Goal:** Capture events from Clawdbot into a local database.

### Deliverables
- [ ] Journal entry schema implemented (SQLite)
- [ ] Clawdbot hook that emits events on tool use
- [ ] Basic entity extraction (people, files, URLs)
- [ ] CLI to query recent entries (`clawtlas log --since 24h`)

### Acceptance Criteria
- After chatting with Clawdbot for 10 minutes, `clawtlas log` shows ≥5 entries
- Entries have correct timestamps, agent IDs, and human-readable summaries
- No PII in logs by default (phone numbers hashed unless `--reveal` flag)

### Non-Goals
- No visualization yet
- No decay calculation
- No multi-agent support

---

## M2: The Map (Week 3-4)

**Goal:** Render journal entries as an interactive node-link diagram.

### Deliverables
- [ ] Web UI (local server, canvas-based)
- [ ] Force-directed graph layout
- [ ] Nodes for agent + all targets
- [ ] Edges with thickness based on connection weight
- [ ] Click node → show recent entries for that target

### Acceptance Criteria
- Open `localhost:3000`, see a graph with your agent in the center
- Nodes you messaged recently are closer/thicker than old ones
- Clicking a person node shows the last 5 interactions with them

### Non-Goals
- No time controls yet
- No decay animation
- No mobile support

---

## M3: Time Travel (Week 5-6)

**Goal:** Add temporal dimension — see how the map changes over time.

### Deliverables
- [ ] Time slider (scrub through past 30 days)
- [ ] Decay calculation applied in real-time as slider moves
- [ ] "Now" mode with live updates
- [ ] Fade animation for decaying connections

### Acceptance Criteria
- Slide to 7 days ago → old connections reappear, recent ones vanish
- Slide back to today → map animates smoothly to current state
- Connections visibly pulse when new event arrives in "Now" mode

### Non-Goals
- No export/sharing
- No annotations

---

## M4: Polish & Privacy (Week 7-8)

**Goal:** Make it feel good and safe to use daily.

### Deliverables
- [ ] Privacy dashboard (see what's logged, delete entries)
- [ ] Target aliasing (rename "+34612345678" to "Mom")
- [ ] Search/filter by target, action type, date range
- [ ] Keyboard shortcuts (zoom, pan, time scrub)
- [ ] Empty state & onboarding for new users

### Acceptance Criteria
- New user opens Clawtlas → sees friendly "Start chatting to fill your map" message
- User can delete all entries for a specific person in 2 clicks
- User can find "that file I edited last Tuesday" via search in <10 seconds

### Non-Goals (Deferred to v1.1+)
- Multi-agent support
- Cloud sync
- Sharing/collaboration
- Mobile app

---

## Timeline Summary

| Milestone | Duration | Cumulative |
|-----------|----------|------------|
| M1: Journal | 2 weeks | Week 2 |
| M2: Map | 2 weeks | Week 4 |
| M3: Time Travel | 2 weeks | Week 6 |
| M4: Polish | 2 weeks | Week 8 |

**Total MVP:** 8 weeks to a delightful, private, working Clawtlas.

---

*Assumption: One person (you + me) working on this. Adjust timeline if team grows.*
