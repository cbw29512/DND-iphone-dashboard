# Donovan the Fallen — laptop controller / iPhone display

The **iPhone is a read-only display**. It shows Donovan's portrait and latest attack, cantrip, spell, healing, or Channel Divinity result. Only the laptop has the combat controls and rolls the dice.

**Wi-Fi quick start (Windows):**
1. Download this repository with **Code → Download ZIP**, then **Extract All**.
2. Double-click **`Start_Donovan_WiFi_Windows.bat`** in the extracted top-level folder (requires Python 3).
3. Laptop controls open at **http://localhost:8765/**. Leave the terminal running.
4. Connect the iPhone to the same Wi-Fi. Scan the QR on the laptop page with iPhone Camera.
5. Tap a combat button on the laptop; the iPhone shows that result until the next one.

If Windows Firewall asks, allow Python on **Private networks only**. This local server is for trusted Wi-Fi only; do not expose port 8765 to the public internet. For details see [Wi-Fi documentation](wifi/README.md).

The [public GitHub Pages card](https://cbw29512.github.io/DND-iphone-dashboard/) remains available for single-device use, but GitHub Pages by itself **cannot relay laptop actions to another phone**.

---

# Iron Lantern — D&D iPhone Dashboard

**Windows DM dashboard → wireless iPhone player display.** Separate Flex Cards for artwork, maps, initiative, narration and dice. The DM chooses a card and presses **Share to Screen**; the phone follows changes automatically.

## Definition of Done (local-network MVP)

- [x] Separate Windows DM and phone display interfaces with player-safe rendering.
- [x] Multiple image uploads, gallery selection and previous/next.
- [x] Individually share artwork, map, initiative, scene or dice cards.
- [x] Real cross-device synchronization via server-sent events and resync polling.
- [x] Saved SQLite session and optimized local media files.
- [x] One-time six-digit iPhone pairing; revocable player access and private DM login.
- [x] Basic initiative tracker, turn advancement, private combatant fields and d20/dice rolls.
- [ ] **Verified on physical Windows and iPhone 16 Pro** (cannot claim remotely).
- [ ] Production cloud deployment, HTTPS and durable managed media hosting.

## Getting started on Windows

1. Install Python 3.11+; clone the repository.
2. In PowerShell: `py -m venv .venv` then `.venv\\Scripts\\Activate.ps1`.
3. Install requirements: `pip install -r requirements.txt`.
4. Run `python run.py`. The **local DM passphrase** is printed in the terminal on startup and stored in `data/admin.json` (ignored by Git).
5. On laptop, browse to `http://localhost:8000`, sign in and upload artwork.
6. Find the laptop's Wi-Fi IPv4 address with `ipconfig`. On iPhone connected to **the same Wi-Fi**, visit `http://YOUR-LAPTOP-IP:8000/display` in Safari.
7. On Windows, click **Pair iPhone → Generate new code**. Enter it on iPhone. Click a card's **Share to Screen**.
8. Keep Python server running. Allow inbound TCP 8000 through Windows Firewall on a trusted **private** network if necessary.

**Never port-forward this development server to the public internet.** The local HTTP connection is not encrypted; public production requires HTTPS, an externally reachable backend, managed persistent storage and a deployment/security review. GitHub is source control, **not** a backend host; Netlify is intended for the future production frontend.

## Shared data schema and state

- `settings`: active card, selected asset, round/turn, scene/dice text, monotonic revision.
- `media`: opaque asset ID, category, filename, MIME, order; bytes stored under `data/media/`.
- `combatants`: initiative, order, HP and notes, visibility; **private fields never enter display response**.
- `access`: hashed auth cookie token and expiration; `pairing`: hashed single-use code and expiration.

DM action → validate role/input → transaction persists changes → increment revision → broadcast update → phone fetches filtered `/api/display/state`. After reconnect, the phone refetches; on disconnect, it falls back to polling. Every new card must supply a **DM editor** and a **strictly player-safe projection**, never generic serialization of raw card state.

## Code map

- `server/`: FastAPI, SQLite persistence, access control, image validation and SSE.
- `web/`: semantic HTML, CSS design system, modular vanilla JS and card renderers.
- `tests/`: API, authentication, privacy, upload and turn-order regression tests.

## Security and operational notes

- A pairing code works once, expires after 10 minutes, and can be revoked with all player tokens.
- Admin sessions expire after 7 days; display sessions after 30 days.
- Mutating calls require an application-specific header; no cross-origin requests are enabled.
- DM notes and HP stay off the player endpoint. Player images are limited to the currently shared asset.
- Images are inspected with Pillow, capped at 12 MB and 30 MP; static assets convert to WebP (up to 1920px); verified GIF retains animation.
- Protect `data/`; it contains images, credentials and sessions. **Do not commit it to Git.**

## Development

Run `pytest -q` after `pip install -r requirements-dev.txt`. Run `node --check web/dashboard.js` (and other JS modules) for syntax validation. Use branches and PRs; do not auto-deploy to Netlify without real-device verification.
