# League of Memory (LOM)

A futuristic, mobile-first 6-player turn-based memory game.

## Features
- **6 Player Support**: Play with up to 6 players (AI fills empty slots).
- **Power Cards**: Strategy elements including Block, Scanner, and Shuffle.
- **Anti-Gravity Design**: Minimalist, dark, neon aesthetic.
- **Responsive**: Optimized for mobile devices.

## Setup
1. Clone the repository.
2. Open `index.html` in a web browser.
3. Enjoy!

## World App Integration (Mini App)
To deploy as a World App Mini App:
1. Ensure the app is hosted on a secure (HTTPS) URL.
2. Register the app in the World App Developer Portal.
3. Integrate the World ID SDK in `script.js` (see `initWorldApp` placeholder).
4. Verify the manifest.json requirements.

## Game Rules
- **Turn**: You have 7 seconds to make a move.
- **Match**: Flipping a matching pair grants 10 points and an extra turn.
- **Powers**:
    - **Block**: Skip the next player's turn.
    - **Scanner**: Reveal 2 random pairs for 3 seconds.
    - **Shuffle**: Shuffle all hidden cards.

## Tech Stack
- HTML5, CSS3, Vanilla JS.
