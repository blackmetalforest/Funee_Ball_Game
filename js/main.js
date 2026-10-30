/* Funee Ball Game
 *
 * All layout values are in "pt" on a 393x852 portrait screen. Pixel art (digits,
 * icons, cloud) is drawn on a 1pt grid, so 1 art pixel = 1pt.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- constants
  const VIEW_W = 393;
  const VIEW_H = 852;

  // Tiers, smallest to largest. `d` is the diameter in pt; the ball is drawn as a plain
  // circle of exactly the physics radius (d / 2), in a colour picked for each ball type.
  const BALLS = [
    { name: 'orange',     d: 24,  color: '#fda800' },
    { name: 'golf',       d: 32,  color: '#fdfefe' },
    { name: 'eight',      d: 44,  color: '#1f1b3e' },
    { name: 'tennis',     d: 48,  color: '#e2fd5d' },
    { name: 'cricket',    d: 64,  color: '#b8003e' },
    { name: 'baseball',   d: 76,  color: '#fde1b8' },
    { name: 'volleyball', d: 88,  color: '#357bd9' },
    { name: 'bowling',    d: 104, color: '#1fca44' },
    { name: 'soccer',     d: 116, color: '#c1cbe2' },
    { name: 'basketball', d: 144, color: '#fc7800' },
    { name: 'beach',      d: 172, color: '#fdda3b' },
  ];
  const MAX_TIER = BALLS.length - 1;
  const SPAWN_TIERS = 5;                 // only the 5 smallest balls are ever dropped
  const points = (tier) => 10 * 2 ** tier; // merging two balls of `tier`

  // Box physics bounds (where ball edges touch the walls / floor)
  const WALL_L = 39.5;
  const WALL_R = 353.5;
  const FLOOR_Y = 731.4;
  const RIM_Y = 223;                      // front top edge of the box = game-over line

  // Box drawing (2pt lines on the 1pt grid)
  const BOX = {
    frontL: 36, frontR: 357, frontT: 222, frontB: 734,   // outer edges of the front frame
    backL: 52, backR: 341, backT: 206, floorT: 719,      // outer edges of the back frame
  };
  const COL = {
    bg: '#000000',
    inside: '#414264',
    floor: '#8798b8',
    line: '#c4cfe9',
    guide: '#f6f7f9',
    danger: '#c02647',
    white: '#ffffff',
    black: '#000000',
    blueText: '#0000fc',
    btnFill: '#f0edf1',
    btnShade: '#a8a5aa',
    btnBorder: '#121012',
    blueBtn: '#0000fe',
    blueBtnBevel: '#3d32bd',
    blueBtnBorder: '#0b0730',
  };

  // Held ball / cloud
  const HELD_Y = 190;       // centre of the ball hanging under the cloud (same for every size)
  const CLOUD_TOP = 155.4;

  // HUD
  const ARROW_POS = { x: 24, y: 77 };
  const SCORE_TOP = 80;
  const NEXT_POS = { x: 362, y: 91 };

  // Physics: g = 1434 pt/s^2, linear damping 1.06 /s, restitution 0.25.
  // The physics world uses 1 unit = 10pt.
  const U = 10;
  const GRAVITY = 1434 / U;
  const LINEAR_DAMPING = 1.06;
  const ANGULAR_DAMPING = 1.0;
  const RESTITUTION = 0.25;
  const FRICTION = 0;
  const STEP = 1 / 240;

  // Timings
  const MERGE_ANIM = 0.1;            // old balls hollow out into rings over 0.1 s
  const DANGER_TIME = 3.66;          // red line blinks this long before game over
  const MIN_DROP_DELAY = 0.75;       // minimum time between two drops
  const BLINK_PERIOD = 0.5;
  const BLINK_ON = 1 / 6;
  // Game-over panel drop-in keyframes, one every 2/60 s (offset of the panel in pt)
  const PANEL_KEYS = [-611, -268, -121, -31, 17, 32, 28, 13, 0];
  const PANEL_KEY_DT = 2 / 60;

  // Game-over panel layout
  const PANEL = { x: 58, y: 244, w: 278, h: 368 };
  const BTN_X = 69, BTN_W = 255, BTN_H = 57;
  const DLG_BTNS = { leaderboard: 400, quit: 471, retry: 543 };

  // ---------------------------------------------------------------- canvas
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // Render at 3 px per pt (or the device's pixel density, if higher) and let the browser
  // scale the canvas to fit the window.
  const NATIVE_PX = 3;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    const scale = Math.min(w / VIEW_W, h / VIEW_H);
    const cssW = Math.floor(VIEW_W * scale), cssH = Math.floor(VIEW_H * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const px = Math.max(NATIVE_PX, Math.ceil(scale * dpr));
    canvas.width = VIEW_W * px;
    canvas.height = VIEW_H * px;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- assets
  const images = {};
  function loadImage(key, src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { images[key] = im; res(); };
      im.onerror = rej;
      im.src = src;
    });
  }

  // Bitmaps from glyphs.js -> cached canvases per colour
  const bitmapCache = new Map();
  function bitmap(rows, color) {
    const key = rows.join('|') + color;
    let c = bitmapCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = rows[0].length;
    c.height = rows.length;
    const g = c.getContext('2d');
    g.fillStyle = color;
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) if (r[x] === '1') g.fillRect(x, y, 1, 1);
    });
    bitmapCache.set(key, c);
    return c;
  }

  // Digit string (with optional thousands separators) as a list of bitmaps
  function numberGlyphs(n, withCommas) {
    let s = String(n);
    if (withCommas) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return s.split('').map((ch) => (ch === ',' ? COMMA : DIGITS[ch]));
  }
  const GLYPH_GAP = 2;
  function numberWidth(glyphs) {
    return glyphs.reduce((w, g) => w + g[0].length, 0) + GLYPH_GAP * (glyphs.length - 1);
  }
  function drawNumber(n, cx, top, color, withCommas) {
    const glyphs = numberGlyphs(n, withCommas);
    let x = Math.round(cx - numberWidth(glyphs) / 2);
    for (const g of glyphs) {
      const isComma = g === COMMA;
      ctx.drawImage(bitmap(g, color), x, isComma ? top + 16 : top);
      x += g[0].length + GLYPH_GAP;
    }
  }
  function drawWord(name, cx, top, color) {
    const b = bitmap(WORDS[name], color);
    ctx.drawImage(b, Math.round(cx - b.width / 2), top);
  }

  // ---------------------------------------------------------------- storage
  const STORE_KEY = 'ball2048.scores';
  function loadScores() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY));
      return Array.isArray(v) ? v.filter((x) => Number.isFinite(x)) : [];
    } catch { return []; }
  }
  function saveScore(score) {
    const list = loadScores();
    list.push(score);
    list.sort((a, b) => b - a);
    const top = list.slice(0, 10);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(top)); } catch { /* private mode */ }
    return top;
  }

  // ---------------------------------------------------------------- game state
  const pl = window.planck;
  let world, balls, rings, state;

  const randTier = () => Math.floor(Math.random() * SPAWN_TIERS);
  const radius = (tier) => BALLS[tier].d / 2;

  function newGame() {
    world = new pl.World({ gravity: pl.Vec2(0, GRAVITY) });
    const walls = world.createBody();
    const top = -200 / U;
    walls.createFixture(pl.Edge(pl.Vec2(WALL_L / U, top), pl.Vec2(WALL_L / U, FLOOR_Y / U)), { friction: FRICTION, restitution: RESTITUTION });
    walls.createFixture(pl.Edge(pl.Vec2(WALL_R / U, top), pl.Vec2(WALL_R / U, FLOOR_Y / U)), { friction: FRICTION, restitution: RESTITUTION });
    walls.createFixture(pl.Edge(pl.Vec2(WALL_L / U, FLOOR_Y / U), pl.Vec2(WALL_R / U, FLOOR_Y / U)), { friction: FRICTION, restitution: RESTITUTION });

    world.on('begin-contact', (contact) => {
      for (const f of [contact.getFixtureA(), contact.getFixtureB()]) {
        const b = f.getBody().getUserData();
        if (b) b.landed = true;
        if (b && b === state.dropped) state.loadNext = true;
      }
    });

    balls = [];
    rings = [];
    state = {
      score: 0,
      current: randTier(),
      next: randTier(),
      cloudX: (WALL_L + WALL_R) / 2,
      dropped: null,          // ball waiting for its first contact
      loadNext: false,
      dangerTime: 0,
      over: false,
      overTime: 0,
      time: 0,
    };
  }

  function addBall(tier, x, y, angle) {
    const r = radius(tier);
    const body = world.createBody({
      type: 'dynamic',
      position: pl.Vec2(x / U, y / U),
      angle: angle || 0,
      linearDamping: LINEAR_DAMPING,
      angularDamping: ANGULAR_DAMPING,
    });
    body.createFixture(pl.Circle(r / U), { density: 1, friction: FRICTION, restitution: RESTITUTION });
    const ball = { tier, body, r, landed: false, dead: false };
    body.setUserData(ball);
    balls.push(ball);
    return ball;
  }

  function removeBall(ball) {
    ball.dead = true;
    const p = ball.body.getPosition();
    rings.push({ tier: ball.tier, x: p.x * U, y: p.y * U, t: 0 });
    world.destroyBody(ball.body);
  }

  function clampCloud(x) {
    const r = state.current != null ? radius(state.current) : radius(state.next);
    return Math.min(WALL_R - r, Math.max(WALL_L + r, x));
  }

  function drop() {
    if (state.over || state.current == null || screen !== 'game') return;
    const x = clampCloud(state.cloudX);
    state.dropped = addBall(state.current, x, HELD_Y, 0);
    state.dropped.droppedAt = state.time;
    state.current = null;
    state.loadNext = false;
  }

  function processMerges() {
    const pairs = [];
    for (let c = world.getContactList(); c; c = c.getNext()) {
      if (!c.isTouching()) continue;
      const a = c.getFixtureA().getBody().getUserData();
      const b = c.getFixtureB().getBody().getUserData();
      if (a && b && a.tier === b.tier) pairs.push([a, b]);
    }
    for (const [a, b] of pairs) {
      if (a.dead || b.dead) continue;
      const tier = a.tier;
      const pa = a.body.getPosition(), pb = b.body.getPosition();
      const mx = (pa.x + pb.x) / 2 * U, my = (pa.y + pb.y) / 2 * U;
      if (state.dropped === a || state.dropped === b) state.loadNext = true;
      removeBall(a);
      removeBall(b);
      state.score += points(tier);
      if (tier < MAX_TIER) {
        const nb = addBall(tier + 1, mx, my, 0);
        nb.landed = true;
      }
    }
    if (pairs.length) balls = balls.filter((b) => !b.dead);
  }

  function update(dt) {
    state.time += dt;
    for (const r of rings) r.t += dt;
    rings = rings.filter((r) => r.t < MERGE_ANIM);
    if (state.over) { state.overTime += dt; return; }

    world.step(STEP, 20, 20);
    processMerges();

    const sinceDrop = state.dropped ? state.time - state.dropped.droppedAt : 0;
    if (state.dropped && sinceDrop >= MIN_DROP_DELAY && (state.loadNext || sinceDrop > 3)) {
      state.dropped = null;
      state.loadNext = false;
      state.current = state.next;
      state.next = randTier();
      state.cloudX = clampCloud(state.cloudX);
    }

    // Game over: a settled ball sticking out above the rim for DANGER_TIME
    let danger = false;
    for (const b of balls) {
      if (!b.landed || b === state.dropped) continue;
      if (b.body.getPosition().y * U - b.r < RIM_Y) { danger = true; break; }
    }
    state.dangerTime = danger ? state.dangerTime + dt : 0;
    if (state.dangerTime >= DANGER_TIME) {
      state.over = true;
      state.overTime = 0;
      state.dangerTime = 0;
      state.board = saveScore(state.score);
    }
  }

  // ---------------------------------------------------------------- drawing
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

  // Diagonal 2pt pixel line between two points (1pt steps)
  function pixelDiag(x0, y0, x1, y1, color) {
    ctx.fillStyle = color;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function drawBox() {
    const B = BOX;
    // inside + top face
    ctx.fillStyle = COL.inside;
    ctx.beginPath();
    ctx.moveTo(B.frontL, B.frontT + 1);
    ctx.lineTo(B.backL + 1, B.backT);
    ctx.lineTo(B.backR - 1, B.backT);
    ctx.lineTo(B.frontR, B.frontT + 1);
    ctx.lineTo(B.frontR, B.frontB);
    ctx.lineTo(B.frontL, B.frontB);
    ctx.closePath();
    ctx.fill();
    // floor
    ctx.fillStyle = COL.floor;
    ctx.beginPath();
    ctx.moveTo(B.backL, B.floorT);
    ctx.lineTo(B.backR, B.floorT);
    ctx.lineTo(B.frontR, B.frontB);
    ctx.lineTo(B.frontL, B.frontB);
    ctx.closePath();
    ctx.fill();
    // back frame
    rect(B.backL, B.backT, B.backR - B.backL, 2, COL.line);
    rect(B.backL, B.backT, 2, B.floorT - B.backT, COL.line);
    rect(B.backR - 2, B.backT, 2, B.floorT - B.backT, COL.line);
    // corner diagonals (top)
    pixelDiag(B.frontL, B.frontT, B.backL, B.backT, COL.line);
    pixelDiag(B.frontR - 2, B.frontT, B.backR - 2, B.backT, COL.line);
    // front frame
    rect(B.frontL, B.frontT, B.frontR - B.frontL, 2, COL.line);
    rect(B.frontL, B.frontB - 2, B.frontR - B.frontL, 2, COL.line);
    rect(B.frontL, B.frontT, 2, B.frontB - B.frontT, COL.line);
    rect(B.frontR - 2, B.frontT, 2, B.frontB - B.frontT, COL.line);
  }

  function drawSprite(tier, x, y) {
    ctx.fillStyle = BALLS[tier].color;
    ctx.beginPath();
    ctx.arc(x, y, radius(tier), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRing(r) {
    const outer = radius(r.tier);
    const hole = outer * Math.min(1, r.t / MERGE_ANIM);
    ctx.fillStyle = BALLS[r.tier].color;
    ctx.beginPath();
    ctx.arc(r.x, r.y, outer, 0, Math.PI * 2);
    ctx.arc(r.x, r.y, hole, 0, Math.PI * 2, true);
    ctx.fill();
  }

  function drawHud() {
    ctx.drawImage(bitmap(ARROW, COL.white), ARROW_POS.x, ARROW_POS.y);
    drawNumber(state.score, VIEW_W / 2, SCORE_TOP, COL.white, false);
    drawSprite(state.next, NEXT_POS.x, NEXT_POS.y);
  }

  function drawPlayfield() {
    drawBox();

    const heldTier = state.current;
    const cx = Math.round(clampCloud(state.cloudX));
    // guide line (behind the balls)
    if (heldTier != null && !state.over) {
      const r = radius(heldTier);
      rect(cx - 1, HELD_Y + r, 2, BOX.frontB - (HELD_Y + r), COL.guide);
    }

    for (const b of balls) {
      const p = b.body.getPosition();
      drawSprite(b.tier, p.x * U, p.y * U);
    }
    for (const r of rings) drawRing(r);

    // cloud + held ball
    const cloud = images.cloud;
    ctx.drawImage(cloud, Math.round(cx - cloud.width / 2), CLOUD_TOP);
    if (heldTier != null) drawSprite(heldTier, cx, HELD_Y);

    // blinking danger line on the rim
    if (state.dangerTime > 0 && (state.dangerTime % BLINK_PERIOD) < BLINK_ON) {
      rect(BOX.frontL, BOX.frontT, BOX.frontR - BOX.frontL, 2, COL.danger);
    }
  }

  function drawButton(y, kind, label) {
    const x = BTN_X, w = BTN_W, h = BTN_H;
    if (kind === 'blue') {
      rect(x, y, w, h, COL.blueBtnBorder);
      rect(x + 2, y + 2, w - 4, h - 4, COL.blueBtnBevel);
      rect(x + 3, y + 3, w - 6, h - 6, COL.blueBtn);
    } else {
      rect(x, y, w, h, COL.btnBorder);
      rect(x + 2, y + 2, w - 4, h - 4, COL.btnShade);
      rect(x + 2, y + 2, w - 4, h - 7, COL.btnFill);
      rect(x + 2, y + 2, w - 4, 9, COL.white);
    }
    label();
  }

  function playIcon(cx, cy, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 12; i++) ctx.fillRect(cx - 7 + i, cy - 12 + i, 2, 24 - 2 * i); // pixel triangle
  }

  function drawPanelAt(offset) {
    const P = PANEL;
    const y0 = P.y + offset;
    rect(P.x, y0, P.w, P.h, COL.black);
    rect(P.x + 2, y0 + 2, P.w - 4, P.h - 4, COL.white);
    return y0 - P.y;
  }

  function panelOffset(t) {
    const k = t / PANEL_KEY_DT;
    const i = Math.floor(k);
    if (i >= PANEL_KEYS.length - 1) return 0;
    const f = k - i;
    return PANEL_KEYS[i] + (PANEL_KEYS[i + 1] - PANEL_KEYS[i]) * f;
  }

  function drawGameOver() {
    rect(0, 0, VIEW_W, VIEW_H, 'rgba(0,0,0,0.5)');
    const o = Math.round(panelOffset(state.overTime));
    drawPanelAt(o);
    drawWord('gameover', VIEW_W / 2, 275 + o, COL.blueText);
    drawNumber(state.score, VIEW_W / 2, 335 + o, COL.black, true);
    drawButton(DLG_BTNS.leaderboard + o, 'grey', () => drawWord('leaderboard', VIEW_W / 2, 419 + o, COL.black));
    drawButton(DLG_BTNS.quit + o, 'grey', () => drawWord('quit', VIEW_W / 2, 489 + o, COL.black));
    drawButton(DLG_BTNS.retry + o, 'blue', () => drawWord('retry', VIEW_W / 2, 560 + o, COL.white));
  }

  // ---------------------------------------------------------------- screens
  let screen = 'title';     // 'title' | 'game' | 'leaderboard'
  let boardReturn = 'title';

  const TITLE_BTNS = { play: 560, leaderboard: 630 };

  function drawTitle() {
    rect(0, 0, VIEW_W, VIEW_H, COL.bg);
    // ball showcase
    drawSprite(10, VIEW_W / 2, 300);
    const row = [0, 1, 2, 3, 4];
    let x = 70;
    for (const tier of row) {
      const r = radius(tier);
      drawSprite(tier, x + r, 470 - r);
      x += BALLS[tier].d + 8;
    }
    const best = loadScores()[0];
    if (best) drawNumber(best, VIEW_W / 2, 120, COL.white, true);
    drawButton(TITLE_BTNS.play, 'blue', () => playIcon(VIEW_W / 2, TITLE_BTNS.play + BTN_H / 2, COL.white));
    drawButton(TITLE_BTNS.leaderboard, 'grey', () => drawWord('leaderboard', VIEW_W / 2, TITLE_BTNS.leaderboard + 19, COL.black));
  }

  const LB_BACK_Y = 700;
  function drawLeaderboard() {
    rect(0, 0, VIEW_W, VIEW_H, COL.bg);
    const P = { x: 32, y: 110, w: VIEW_W - 64, h: 560 };
    rect(P.x, P.y, P.w, P.h, COL.black);
    rect(P.x, P.y, P.w, P.h, COL.line);
    rect(P.x + 2, P.y + 2, P.w - 4, P.h - 4, COL.white);
    drawWord('leaderboard', VIEW_W / 2, P.y + 26, COL.blueText);
    const list = loadScores();
    const highlight = boardReturn === 'game' && state && state.over ? list.indexOf(state.score) : -1;
    for (let i = 0; i < 10; i++) {
      const y = P.y + 80 + i * 46;
      const color = i === highlight ? COL.blueText : COL.black;
      drawNumber(i + 1, P.x + 40, y, color, false);
      if (list[i] != null) {
        const glyphs = numberGlyphs(list[i], true);
        const w = numberWidth(glyphs);
        drawNumber(list[i], P.x + P.w - 30 - w / 2, y, color, true);
      } else {
        rect(P.x + P.w - 60, y + 9, 30, 2, '#c0c0c0');
      }
    }
    drawButton(LB_BACK_Y, 'grey', () => {
      const a = bitmap(ARROW, COL.black);
      ctx.drawImage(a, Math.round(VIEW_W / 2 - a.width / 2), LB_BACK_Y + Math.round((BTN_H - a.height) / 2));
    });
  }

  // ---------------------------------------------------------------- input
  function toView(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * VIEW_W, y: (e.clientY - r.top) / r.height * VIEW_H };
  }
  const inBtn = (p, y) => p.x >= BTN_X && p.x <= BTN_X + BTN_W && p.y >= y && p.y <= y + BTN_H;

  // Mouse: the cloud follows the cursor, click to drop.
  // Touch: dragging moves the cloud relative to its current position (like a trackpad);
  // a quick tap without dragging drops the ball.
  const TAP_SLOP = 8;        // pt of finger movement allowed for a tap
  const TAP_TIME = 300;      // ms
  let pointerDown = false;
  let touch = null;          // { id, startX, lastX, startT, moved }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = toView(e);
    if (screen === 'title') {
      if (inBtn(p, TITLE_BTNS.play)) {
        if (!state || state.over) newGame();
        screen = 'game';
      } else if (inBtn(p, TITLE_BTNS.leaderboard)) { boardReturn = 'title'; screen = 'leaderboard'; }
      return;
    }
    if (screen === 'leaderboard') {
      if (inBtn(p, LB_BACK_Y)) screen = boardReturn;
      return;
    }
    // game
    if (state.over) {
      if (state.overTime < PANEL_KEYS.length * PANEL_KEY_DT) return;
      if (inBtn(p, DLG_BTNS.retry)) newGame();
      else if (inBtn(p, DLG_BTNS.quit)) { newGame(); screen = 'title'; }
      else if (inBtn(p, DLG_BTNS.leaderboard)) { boardReturn = 'game'; screen = 'leaderboard'; }
      return;
    }
    if (p.x < 70 && p.y > 60 && p.y < 125) { screen = 'title'; return; }
    if (e.pointerType === 'mouse') {
      pointerDown = true;
      state.cloudX = clampCloud(p.x);
    } else if (!touch) {
      touch = { id: e.pointerId, startX: p.x, lastX: p.x, startT: performance.now(), moved: false };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (screen !== 'game' || state.over) return;
    const x = toView(e).x;
    if (e.pointerType === 'mouse') {
      state.cloudX = clampCloud(x);
    } else if (touch && e.pointerId === touch.id) {
      state.cloudX = clampCloud(clampCloud(state.cloudX) + (x - touch.lastX));
      touch.lastX = x;
      if (Math.abs(x - touch.startX) > TAP_SLOP) touch.moved = true;
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') {
      if (!pointerDown) return;
      pointerDown = false;
      if (screen === 'game' && !state.over) {
        state.cloudX = clampCloud(toView(e).x);
        drop();
      }
      return;
    }
    if (!touch || e.pointerId !== touch.id) return;
    const tap = !touch.moved && performance.now() - touch.startT < TAP_TIME;
    touch = null;
    if (tap && screen === 'game' && !state.over) drop();
  });
  canvas.addEventListener('pointercancel', (e) => {
    pointerDown = false;
    if (touch && e.pointerId === touch.id) touch = null;
  });

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (screen !== 'game' || state.over) {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (screen === 'title' || (state && state.over)) { newGame(); screen = 'game'; }
      }
      return;
    }
    if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') { e.preventDefault(); drop(); }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (screen === 'game') {
      const dir = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      if (dir) state.cloudX = clampCloud(clampCloud(state.cloudX) + dir * 300 * dt);
      acc += dt;
      while (acc >= STEP) { update(STEP); acc -= STEP; }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    rect(0, 0, canvas.width, canvas.height, COL.bg);
    const s = canvas.width / VIEW_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = false;

    if (screen === 'title') drawTitle();
    else if (screen === 'leaderboard') drawLeaderboard();
    else {
      drawPlayfield();
      drawHud();
      if (state.over) drawGameOver();
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot
  loadImage('cloud', 'assets/cloud.png').then(() => {
    newGame();
    requestAnimationFrame(frame);
  });

  // debug hook for tests
  window.__game = { get state() { return state; }, get balls() { return balls; }, drop, newGame, addBall: (t, x, y) => addBall(t, x, y, 0), setScreen: (s) => { screen = s; } };
})();
