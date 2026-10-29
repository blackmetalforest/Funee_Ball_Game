# Funee Ball Game

**Version 0.1.0** · Play: <https://blackmetalforest.github.io/Funee_Ball_Game/>

A pixel-art "drop and merge" ball game for the browser. Drop balls from the cloud; two
balls of the same kind merge into the next size up. Two beach balls (the largest) cancel each
other out. The game ends when the pile sticks out over the rim of the box for about 2 seconds.

Plain HTML, CSS and JavaScript with no build step. Physics uses [planck.js](https://github.com/piqnt/planck.js)
(a Box2D port), vendored in `vendor/`.

## Run locally

```bash
python3 -m http.server 8048
```

Then open <http://localhost:8048>. Opening `index.html` directly also works.

## Controls

- **Touch or mouse:** move the cloud by dragging (or hovering, with a mouse). Release or click to drop.
- **Keyboard:** ← / → (or A / D) to move, Space / ↓ / Enter to drop.

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
- The next ball loads as soon as the dropped ball touches something.
- Gravity is 1434 pt/s² with linear damping of 1.06/s and restitution of about 0.25.
- A merged ball appears at the midpoint of the pair. The two old balls hollow out into rings over 0.1 s.
- High scores (top 10) are stored in the browser's `localStorage`.

Balls are drawn as plain circles in each ball's main colour, at exactly their physics radius.
All layout is in iPhone points (393×852), rendered internally at 3 px/pt and scaled to fit the window.

## Publishing on GitHub Pages

Push the repository to GitHub, then go to **Settings → Pages** and choose **Deploy from a branch**
(`main`, `/ (root)`). The game has no build step, so it is served as is.
