# Night Match — League of Memory

One championship night in your pocket. Matched pairs stay face-up on the table. Chain combos, earn powers every 2 matches.

Practice 4×4 is the front door (one Easy bot, 11s timer, first-run coach). Finish a Practice game on this device to unlock **Arena Night** 6×6 versus 1–2 bots. The 3/5-bot Gauntlet is not on the lobby.

Live: https://lom-lyart.vercel.app/

## Play

1. Open the live URL or serve this folder over HTTP.
2. Practice starts selected. Callsign is optional (saved on this device).
3. Match pairs. A hit scores 10 × combo and keeps your turn (timer refills). A miss or timeout rotates play. You start with one random power and earn another every 2 matches.

Powers:
- **Block** — tap a rival to freeze them (timer pauses while you target)
- **Scanner** — flash two hidden pairs for 3 seconds (timer pauses)
- **Shuffle** — remix unmatched cards and wipe bot memory

World ID is **optional** and never blocks the lobby. Play in any browser. If World App injects MiniKit, an optional verify control can show a small HUD badge. There is no CDN MiniKit script and no `install()` without an app id.

## Stack

Vanilla HTML / CSS / JS, static on Vercel. PWA manifest + same-origin offline cache (`lom-v7`). System fonts. No backend, no secrets, no Google Fonts / jsDelivr runtime.

## Deploy

The GitHub repo `obengfrancisjr/LOM` is linked to the Vercel project `lom` (production branch `main`). Push to `main` and Vercel rebuilds https://lom-lyart.vercel.app/.

## World App

Listing as a World Mini App still needs a Developer Portal app + action `play-lom`. Until MiniKit is injected by World App, verify stays hidden. No app id is hardcoded.

## Local

Serve the folder over HTTP (not only `file://`) if you want the service worker:

```bash
python3 -m http.server 8080
```
