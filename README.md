# League of Memory (LOM)

A futuristic, mobile-first memory arena: you vs 1–5 AI opponents. Matched pairs stay face-up on the table. Chain combos, earn powers every 2 matches. Arena is 6×6 (9s on Easy, 7s on Normal/Hard); Practice is 4×4 with a first-run coach and an 11s timer. Easy bots forget, flub known pairs, and do not start with powers.

Live: https://lom-lyart.vercel.app/

## Play

1. Open the live URL or `index.html`.
2. Pick Arena 6×6 or Practice 4×4, then a callsign, opponent count, and difficulty.
3. Match pairs. A hit scores 10 × combo and keeps your turn (timer refills). A miss or timeout rotates play. You start with one random power and earn another every 2 matches.

Powers:
- **Block** — tap a rival to freeze them
- **Scanner** — flash two hidden pairs for 3 seconds
- **Shuffle** — remix unmatched cards and wipe bot memory

World ID is **optional**. The game is playable in any browser. If you open it inside World App, MiniKit can offer a device-level verify without blocking the lobby.

## Stack

Vanilla HTML / CSS / JS, static on Vercel. PWA manifest + offline cache. No backend, no secrets.

## Deploy

The GitHub repo `obengfrancisjr/LOM` is linked to the Vercel project `lom` (production branch `main`). Push to `main` and Vercel rebuilds https://lom-lyart.vercel.app/.

## World Mini App

To list this as a World Mini App you still need a Developer Portal app + action `play-lom`. The client already calls MiniKit when it is installed. No World `app_id` is hardcoded.

## Local

Serve the folder over HTTP (not only `file://`) if you want the service worker:

```bash
npx --yes serve .
```
