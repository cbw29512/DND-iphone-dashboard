# D&D iPhone Dashboard

A modular, DM-controlled wireless tabletop display: Windows dashboard + iPhone 16 Pro player screen.

## Definition of Done — MVP

- Open a DM dashboard on Windows and a player-safe display on the iPhone.
- Upload and order at least 10 images (JPEG, PNG, WebP) with useful error feedback.
- Every Flex Card supports **Preview**, **Share to Screen**, and **Stop Sharing**.
- A shared image fills the iPhone display without revealing other cards or DM-only data.
- Previous/Next switches images from Windows without touching the phone.
- A basic initiative tracker supports combatants, rolls, sorting and Next Turn.
- Both devices reflect current shared state after reconnecting.
- Sessions and uploaded media persist across application restarts.
- Real-device tests verify iPhone Safari/Home Screen behavior, responsive layouts and accessibility.

## Data schema (initial contract)

- `Session { id, name, created_at, updated_at, active_share_id?, revision }`
- `MediaAsset { id, session_id, name, mime_type, storage_key, sort_order, created_at }`
- `FlexCard { id, session_id, kind, title, settings, private_state, public_state, updated_at }`
- `DisplayShare { id, session_id, card_id, enabled, revision, updated_at }`
- `Encounter { id, session_id, name, round, active_turn_id? }`
- `Combatant { id, encounter_id, name, initiative, tie_break, sort_order, hp_current?, hp_max?, conditions[], visible_to_players }`

Identifiers are opaque UUIDs. Server-authoritative revisions increment on accepted state changes. `private_state` is **never** serialized to the player display.

## State transitions

1. DM edits a card or uploads media; backend validates and persists changes.
2. DM previews the player-safe presentation locally without broadcasting.
3. DM shares a card; backend atomically updates the session's active share and revision.
4. Paired player display receives the updated public view (or fetches current state after reconnect).
5. DM stops sharing; player screen returns to a neutral splash screen.
6. Initiative and artwork updates propagate only if their card is currently shared.

## Proposed architecture

- Frontend: responsive TypeScript web UI, separate DM and player routes.
- Backend: authenticated session API, persistent media store and real-time subscriptions (provider to be chosen before integration).
- GitHub: source, pull requests and test workflow.
- Netlify: production frontend later. GitHub Pages or local dev for early UI previews.
- No automatic production deployments until real-device sharing is validated.

## Security rules

- DM routes require authentication.
- Player view is paired to a session with revocable scoped access.
- Unknown/untrusted files rejected using MIME and content validation; enforce size limits.
- Images are rendered as media, not executed code.
- Do not expose DM notes, secrets, hidden HP or server credentials in player payloads.

## Planned milestones

1. Foundation: contracts, UI shell, card registry, mock previews and tests.
2. Live share: authenticated pairing, persistence and multi-device sync.
3. Media gallery: drag/drop upload, image list, Previous/Next.
4. Initiative card: turn management, privacy-safe player rendering.
5. Animated artwork, battle maps and extensible cards.

The MVP is **not complete** until real Windows-to-iPhone sharing passes.
