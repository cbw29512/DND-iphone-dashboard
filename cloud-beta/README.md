# Iron Lantern — Cloud beta foundation

This folder contains a **static, runnable UI prototype** that is deliberately separate from the existing FastAPI/SQLite laptop application. The local application remains untouched.

## What works now
- Empty encounter slots; click to assign or replace a card.
- Player cards with name, AC, initiative modifier.
- Source-verified 2014 SRD Goblin card; the card's source stats are immutable.
- Multiple instances of the same monster, sharing a source card and a group initiative roll.
- Named battle selection, a Save button (preview-session only), initiative, Next Turn.
- Normal / advantage / disadvantage monster attack roll vs chosen player AC; automatic damage on hit and double dice on natural 20.
- Read-only turn card layout preview.

## Deliberate restrictions
**This is not the secure hosted application.** No real authentication, private cloud storage, remote synchronization, full combat rules, or iPhone pairing is included. Everything is in JavaScript memory and disappears on page reload. Do not upload character data or publicly deploy as a claimed private DM tool. The UI is for design and mechanics testing only.

## Deploying the preview
For Netlify, set **Base directory** to `cloud-beta`, publish directory to `.`, and leave build command empty. This exposes only the preview interface and sample SRD Goblin card. Do not treat the preview URL as secret or private. Connect a domain from IONOS only after hosting and security are configured.

## Production architecture (next milestones)
1. Implement an authenticated backend (server-side role check, authorization per battle) with persistent records for card templates, card versions, player library, battles, slots, and combat sessions.
2. Move all dice rolls and battle state changes into an authoritative server engine; keep raw source-card stats immutable and battle-instance HP/conditions separate.
3. Configure protected realtime channels and an iPhone **display-only** role. Pair with short-lived one-time codes, hashed at rest, bound to a DM session and revocable.
4. Use HTTPS, MFA for DM, strict per-user row access, audit logs, recovery and backups. Prevent leaked data in unauthorized API and realtime responses.
5. Build source-card import adapter against D20-Ironpit schema only after comparing full source rights and validated mechanics; never infer missing spells/abilities.
6. Verify laptop and iPhone physical-device synchronization, stale-event recovery and revocation before the private beta goes live.

## Card data conventions
- `sourceId` / `ruleset` / `source`: a rules reference; do not use monster names for dispatch.
- `RAW_MONSTERS`: read-only templates, only include verified implemented cards.
- `makeInstance`: independent encounter entity; may modify battle HP without changing the source.
- `rollInitiative` / `rollAttack`: preview math only, must be replaced by audited server authoritative primitives before production.

## Security note
Netlify static assets alone **cannot** enforce DM login or private battles. A custom domain is a DNS/routing name; it does not provide authentication or realtime service.

## Reused art and RAW admission gate (October 2026)
- Silhouette SVGs in `silhouettes.js` are adapted from `cbw29512/D20-ironpit/frontend/figure-portraits.js` (Goblin and humanoid).
- Visual silhouette data **does not certify game mechanics**. Rules data comes from the named 2014 source definition, never from art IDs or monster names.
- Starter Goblin 2014 SRD stats: AC 15, HP 7, DEX +2, Scimitar +4 (1d6+2 slashing), Shortbow +4 (1d6+2 piercing). Only these two attack actions are currently bound.
- Future monsters need source edition, verified immutable card values, ability coverage against Iron Pit, implementation/test evidence, and public/private field audit before admission.
- Goblin Shaman remains an example placeholder in the **older local beta** and is intentionally absent from the cloud-preview RAW catalog.
