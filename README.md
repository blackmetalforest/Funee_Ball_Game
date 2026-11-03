# Funee Ball Game

**Version 0.3.1** · Play: <https://blackmetalforest.github.io/Funee_Ball_Game/>

A "drop and merge" ball game for the browser, drawn with clean vector shapes. Drop balls from the cloud; two
balls of the same kind merge into the next size up. Two beach balls (the largest) cancel each
other out. The game ends when the pile sticks out over the rim of the box for about 3.7 seconds.

Plain HTML, CSS and JavaScript with no build step. Physics uses [planck.js](https://github.com/piqnt/planck.js)
(a Box2D port), vendored in `vendor/`.

## Run locally

```bash
python3 -m http.server 8048
```

Then open <http://localhost:8048>. Opening `index.html` directly also works.

## Controls

- **Touch:** drag anywhere to slide the cloud (it moves relative to your finger, not to where you touch). Tap to drop.
- **Mouse:** the cloud follows the cursor. Click to drop.
- **Keyboard:** ← / → (or A / D) to move, Space / ↓ / Enter to drop.

## Debug panel

Tap the faint gear in the bottom-left corner (or press <kbd>`</kbd>) to open the debug panel.
Every value applies live: gravity, drag, bounce, friction, masses, physics rate, game speed,
drop delay, game-over timing, scoring, controls, ball sizes and colours, plus display aids
(a theme picker: Default with plain balls, or Debug with a spin line through each ball; size
numbers, velocity arrows, countdown, stats) and cheats (god mode, pause,
single-step, forced ball type, auto-drop, spawn any ball, edit the score, shake, clear, end the
game). Changed values are highlighted, remembered on the device, and can be reset in one tap.

## Rules and numbers

| # | Ball       | Size (pt) | Points for merging two |
|---|------------|-----------|------------------------|
| 1 | Orange     | 24        | 10                     |
| 2 | Golf       | 32        | 20                     |
| 3 | 8-ball     | 44        | 40                     |
| 4 | Tennis     | 48        | 80                     |
| 5 | Cricket    | 64        | 160                    |
| 6 | Baseball   | 76        | 320                    |
| 7 | Volleyball | 88        | 640                    |
| 8 | Bowling    | 104       | 1,280                  |
| 9 | Soccer     | 116       | 2,560                  |
| 10 | Basketball | 144      | 5,120                  |
| 11 | Beach ball | 172      | 10,240 (both disappear) |

- Only the five smallest balls are dropped, chosen at random.
- The next ball loads once the dropped ball touches something, and no sooner than 0.5 s after the drop.
- Gravity is 1434 pt/s² with no air drag. Balls bounce off each other with restitution 0.5 and off
  the walls and floor with 0.2.
- A merged ball appears at the midpoint of the pair. The two old balls hollow out into rings over 0.1 s.
- Highscores (top 10) are stored in the browser's `localStorage`, each with an icon of the largest
  ball made in that game (for beach balls, "2x", "3x"… when more than one was made).

Balls are drawn as plain circles in each ball's main colour, at exactly their physics radius.
All layout is in iPhone points (393×852), rendered internally at 3 px/pt and scaled to fit the window.

## Publishing on GitHub Pages

Push the repository to GitHub, then go to **Settings → Pages** and choose **Deploy from a branch**
(`main`, `/ (root)`). The game has no build step, so it is served as is.
