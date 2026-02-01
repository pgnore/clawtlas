# Journal Entry Schema

Every event recorded by Clawtlas follows this structure.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (ULID recommended — sortable, collision-free) |
| `timestamp` | ISO 8601 | When the event occurred |
| `agentId` | string | Which agent performed the action |
| `action` | enum | What happened (see Action Types below) |
| `targetType` | enum | Category of thing touched (see Target Types) |
| `targetId` | string | Identifier for the target (normalized, see below) |
| `summary` | string | Human-readable 1-line description (≤280 chars) |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `targetLabel` | string | Display name for the target (e.g., "Mom" instead of `+34612345678`) |
| `sessionId` | string | Links related events within a conversation |
| `channel` | string | Where it happened (telegram, email, filesystem, etc.) |
| `confidence` | float | 0-1, how certain we are about entity extraction |
| `metadata` | object | Action-specific details (freeform, for future use) |

## Action Types

```
message_sent    — Sent a message to a person/channel
message_received — Received a message (creates connection too)
file_read       — Read a file
file_write      — Created or modified a file
search          — Performed a web/local search
url_fetch       — Accessed a URL
calendar_read   — Checked calendar
calendar_write  — Created/modified calendar event
memory_access   — Read or wrote agent memory
tool_use        — Used an external tool/API
```

**Default:** `tool_use` (catch-all for unclassified actions)

## Target Types

```
person    — A human (phone, email, username)
file      — A file path
url       — A web URL
topic     — An extracted topic/concept (labeled with confidence)
channel   — A chat channel or group
event     — A calendar event
agent     — Another AI agent
```

**Default:** `topic` with `confidence: 0.5` for ambiguous entities

## Target ID Normalization

- **People:** Prefer phone (E.164) > email > username. Hash if privacy mode enabled.
- **Files:** Relative path from workspace root
- **URLs:** Normalized (lowercase host, strip tracking params)
- **Topics:** Lowercase, singular, no stopwords

## Example Entry

```json
{
  "id": "01HYX7KQRS3N2V8GFCDE9MPAB1",
  "timestamp": "2025-01-18T14:32:00Z",
  "agentId": "atlas",
  "action": "message_sent",
  "targetType": "person",
  "targetId": "+34612345678",
  "targetLabel": "Mom",
  "summary": "Sent birthday dinner plan to Mom",
  "sessionId": "sess_abc123",
  "channel": "whatsapp",
  "confidence": 1.0
}
```

---

*Open question: Should we add `sentiment` or `importance` fields? **Default: No** — adds complexity, can infer from metadata later. Revisit post-MVP.*
