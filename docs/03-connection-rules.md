# Connection Rules

Connections are the edges in the Clawtlas map. They represent relationships between agents and the things they touched.

## What Creates a Connection

A connection is created whenever a journal entry records an agent interacting with a target:

```
Agent → Target
```

**Bidirectional for people:** When an agent sends a message to a person, that's one connection. When the person replies, that's another. Both strengthen the edge.

**Unidirectional for objects:** Reading a file creates `Agent → File`. The file doesn't "respond."

## Connection Weight

Every connection has a **weight** that determines its visual thickness.

### Base Weight by Action

| Action | Base Weight |
|--------|-------------|
| message_sent / message_received | 3 |
| file_write | 2 |
| file_read | 1 |
| calendar_write | 2 |
| calendar_read | 1 |
| search | 1 |
| url_fetch | 1 |
| tool_use | 1 |
| memory_access | 1 |

**Why messages weigh more:** Human contact is more meaningful than reading a file. The map should reflect that.

## 72-Hour Decay

Connections decay over time using exponential decay:

```
effective_weight = base_weight × e^(-λt)
```

Where:
- `t` = hours since the interaction
- `λ` = decay constant = `ln(2) / 72` ≈ 0.00963

This means:
- At 0 hours: 100% weight
- At 72 hours: 50% weight
- At 144 hours (6 days): 25% weight
- At 1 week: ~21% weight

**Why 72 hours?** Long enough to see weekly patterns. Short enough that the map doesn't become cluttered with ancient history.

## Aggregation

Multiple interactions with the same target **sum their weights** (after decay):

```
total_weight(Agent, Target) = Σ effective_weight(each interaction)
```

**Capped at 10** to prevent a single hyper-active connection from dominating the map.

## Visual Mapping

| Weight Range | Line Thickness | Opacity | Glow |
|--------------|----------------|---------|------|
| 0.0 - 0.5 | 1px | 20% | none |
| 0.5 - 2.0 | 2px | 50% | none |
| 2.0 - 5.0 | 3px | 75% | subtle |
| 5.0 - 10.0 | 4px | 100% | bright |

**Threshold for visibility:** Connections below 0.1 weight are hidden (but retained in data).

## Clustering

Targets that share many connections to the same agent naturally cluster in force-directed layout. No special rules needed — physics handles it.

**Exception:** "Topic" targets with low confidence (< 0.7) are positioned further from center to reduce noise.

## Example

```
Day 1: Agent sends 3 messages to Mom (weight: 9)
Day 2: Agent reads 2 files (weight: 2)
Day 4 (72h later):
  - Mom connection: 9 × 0.5 = 4.5 (still thick, glowing)
  - Files: 2 × 0.5 = 1.0 (thin, faded)
```

---

*Open question: Should connections between targets exist (e.g., "Mom" and "birthday" both appeared in same session)? **Default: No** — agent-centric graph only for MVP. Revisit for v2 if users ask for topic clustering.*
