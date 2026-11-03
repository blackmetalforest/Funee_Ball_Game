/* Funee Ball Game
 *
 * All layout values are in "pt" on a 393x852 portrait screen. Everything is drawn as
 * clean vector shapes on a canvas; text uses the device's standard UI font.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- constants
  const VERSION = '0.3.5';
  const REPO_URL = 'https://github.com/blackmetalforest/Funee_Ball_Game';
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
  const BALL_DEFAULTS = BALLS.map((b) => ({ d: b.d, color: b.color }));

  // Box physics bounds (where ball edges touch the walls / floor)
  const WALL_L = 39.5;
  const WALL_R = 353.5;
  const FLOOR_Y = 731.4;

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
    dangerFill: 'rgba(235, 30, 60, 0.5)',
    white: '#ffffff',
    black: '#000000',
    blueText: '#0000fc',
    btnFill: '#f0edf1',
    btnShade: '#a8a5aa',
    btnBorder: '#121012',
    blueBtn: '#0000fe',
    blueBtnBevel: '#3d32bd',
    blueBtnBorder: '#0b0730',
    cloud: '#ffffff',
    cloudEdge: '#b8f6de',
    panel: '#ffffff',
    btnGrey: '#eceef3',
    btnGreyEdge: '#c9ccd6',
    btnBlue: '#2f5bff',
    btnBlueEdge: '#1f3fc4',
    textDark: '#14151c',
    textMuted: '#8a8fa3',
    accent: '#2f5bff',
    gameOver: '#ff3b5c',
  };
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // Cloud
  const CLOUD_TOP = 155.4;

  // HUD
  const ARROW_POS = { x: 32, y: 91 };   // centre of the back chevron
  const SCORE_Y = 91;                    // vertical centre of the score
  const NEXT_POS = { x: 350, y: 91 };   // centre of the next-ball icon (kept on screen for big balls)

  // The physics world uses 1 unit = 10pt.
  const U = 10;

  // ---------------------------------------------------------------- settings
  // Every tunable value lives here. The debug panel (js/debug.js) edits these live and
  // saves them in localStorage; DEFAULTS is what "reset" goes back to.
  const DEFAULTS = Object.freeze({
    // physics
    gravity: 1434,              // pt/s^2
    linearDamping: 0,           // 1/s, air drag
    angularDamping: 1.0,        // 1/s, spin drag
    restitution: 0.05,          // ball-to-ball bounce
    friction: 0.2,              // ball-to-ball grip
    wallRestitution: 0.2,       // walls/floor bounce
    wallFriction: 0.2,          // walls/floor grip
    massMin: 30,                // mass of the smallest ball
    massMax: 232.35,            // mass of the beach ball
    physicsHz: 240,             // physics steps per second
    velocityIterations: 20,
    positionIterations: 20,
    timeScale: 1,               // < 1 = slow motion
    // gameplay
    dropDelay: 0.5,             // s, minimum time between drops
    nextBallTimeout: 3,         // s, load the next ball even if the dropped one never lands
    gameOverTime: 3.66,         // s the pile may stick out over the rim
    rimY: 223,                  // pt, game-over line
    heldY: 190,                 // pt, centre of the ball under the cloud
    dropSpin: 1,                // rad/s, each drop gets this much spin in a random direction
    spawnTiers: 5,              // drop the N smallest ball types
    pointsBase: 10,             // points = base * multiplier^tier
    pointsMultiplier: 2,
    maxPairVanish: true,        // two largest balls cancel out
    mergeKeepsMomentum: false,  // merged ball inherits the pair's average velocity
    mergePopSpeed: 0,           // pt/s, upward kick given to a freshly merged ball
    mergeAnim: 0.1,             // s, ring animation of the merged pair
    blinkPeriod: 0.5,           // s
    blinkOn: 1 / 6,             // s
    tapSlop: 8,                 // pt of finger movement allowed for a tap
    tapTime: 300,               // ms, longest touch that counts as a tap
    keyMoveSpeed: 300,          // pt/s, arrow-key cloud speed
    // display
    theme: 'default',           // see THEMES
    spinLineWidth: 2,
    showTierNumbers: false,
    showVelocity: false,
    showDangerTimer: false,
    showDebugHud: false,
    // cheats
    godMode: false,             // never game over
    pausePhysics: false,
    forceTier: -1,              // -1 random, else always spawn this tier (0-based)
    autoDrop: false,
    autoDropInterval: 0.6,      // s
  });
  const CFG = { ...DEFAULTS };

  // Visual themes, picked in the debug panel.
  const THEMES = {
    default: { label: 'Default (plain balls)', spinLine: false },
    debug: { label: 'Debug (spin lines)', spinLine: true },
  };
  const theme = () => THEMES[CFG.theme] || THEMES.default;

  const SETTINGS_KEY = 'funee.debug';
  function saveSettings() {
    try {
      const cfg = {};
      for (const k in DEFAULTS) if (CFG[k] !== DEFAULTS[k]) cfg[k] = CFG[k];
      const balls = BALLS.map((b, i) =>
        (b.d !== BALL_DEFAULTS[i].d || b.color !== BALL_DEFAULTS[i].color) ? { d: b.d, color: b.color } : null);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ cfg, balls }));
    } catch { /* private mode */ }
  }
  function loadSettings() {
    try {
      const v = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (!v) return;
      for (const k in v.cfg || {}) if (k in DEFAULTS && typeof v.cfg[k] === typeof DEFAULTS[k]) CFG[k] = v.cfg[k];
      (v.balls || []).forEach((b, i) => { if (b && BALLS[i]) Object.assign(BALLS[i], b); });
    } catch { /* ignore */ }
  }
  loadSettings();

  const points = (tier) => Math.round(CFG.pointsBase * CFG.pointsMultiplier ** tier);

  // Ball mass: the area-based mass (density 1) linearly rescaled so the smallest ball weighs
  // massMin and the beach ball massMax. Small balls stay light, but can still shove big ones.
  function ballMass(r) {
    const area = (rr) => Math.PI * (rr / U) ** 2;
    const a0 = area(BALLS[0].d / 2), a1 = area(BALLS[MAX_TIER].d / 2);
    if (Math.abs(a1 - a0) < 1e-9) return Math.max(0.01, CFG.massMax);
    return Math.max(0.01, CFG.massMin + (area(r) - a0) * (CFG.massMax - CFG.massMin) / (a1 - a0));
  }

  // Buttons
  const BTN_X = 69, BTN_W = 255, BTN_H = 57;
  // Game over: two buttons below the box (clear of the debug gear in the bottom-left corner)
  const GO_BTNS = { y: 748, h: 50, highscores: { x: 36, w: 154 }, retry: { x: 203, w: 154 } };
  const GO_TEXT_Y = 130;             // "Game Over", between the score and the cloud
  const GO_INPUT_DELAY = 0.4;        // s before the game-over buttons react (no accidental taps)

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

  // ---------------------------------------------------------------- text
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  function text(str, x, y, { size = 20, weight = 700, color = COL.white, align = 'center', baseline = 'middle' } = {}) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------------------------------------------------------- storage
  const STORE_KEY = 'ball2048.scores';
  // Each entry: { score, tier, count } - tier/count = the largest ball made in that game and how
  // many of it were made (older saves only stored the score).
  function loadScores() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!Array.isArray(v)) return [];
      return v.map((e) => (typeof e === 'number' ? { score: e, tier: null, count: 0 } : e))
        .filter((e) => e && Number.isFinite(e.score));
    } catch { return []; }
  }
  function saveScore(entry) {
    const list = loadScores();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, 10);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(top)); } catch { /* private mode */ }
  }

  // ---------------------------------------------------------------- game state
  const pl = window.planck;
  let world, balls, rings, state;

  const randTier = () => {
    if (CFG.forceTier >= 0) return Math.min(MAX_TIER, CFG.forceTier);
    const n = Math.max(1, Math.min(BALLS.length, Math.round(CFG.spawnTiers)));
    return Math.floor(Math.random() * n);
  };
  const radius = (tier) => BALLS[tier].d / 2;
  const stepDt = () => 1 / Math.max(30, CFG.physicsHz);

  let walls = null;
  function buildWalls() {
    if (walls) world.destroyBody(walls);
    walls = world.createBody();
    const top = -200 / U, L = WALL_L / U, R = WALL_R / U, F = FLOOR_Y / U;
    const opts = () => ({ friction: CFG.wallFriction, restitution: CFG.wallRestitution });
    walls.createFixture(pl.Edge(pl.Vec2(L, top), pl.Vec2(L, F)), opts());
    walls.createFixture(pl.Edge(pl.Vec2(R, top), pl.Vec2(R, F)), opts());
    walls.createFixture(pl.Edge(pl.Vec2(L, F), pl.Vec2(R, F)), opts());
  }

  function newGame() {
    world = new pl.World({ gravity: pl.Vec2(0, CFG.gravity / U) });
    walls = null;
    buildWalls();

    // The engine would mix two surfaces' bounce by taking the larger value, so a ball against a
    // wall or the floor would ignore the wall settings. Use the wall/floor values for those contacts.
    world.on('pre-solve', (contact) => {
      if (contact.getFixtureA().getBody() === walls || contact.getFixtureB().getBody() === walls) {
        contact.setRestitution(CFG.wallRestitution);
        contact.setFriction(CFG.wallFriction);
      }
    });

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
      lastAutoDrop: 0,
      started: false,         // a ball has been dropped (home screen then offers "Resume")
      bestTier: -1,           // largest ball made this game
      bestCount: 0,           // how many of that ball were made
    };
  }

  function makeFixture(body, r) {
    const density = ballMass(r) / (Math.PI * (r / U) ** 2);
    return body.createFixture(pl.Circle(r / U), { density, friction: CFG.friction, restitution: CFG.restitution });
  }

  function addBall(tier, x, y, angle) {
    const r = radius(tier);
    const body = world.createBody({
      type: 'dynamic',
      position: pl.Vec2(x / U, y / U),
      angle: angle || 0,
      linearDamping: CFG.linearDamping,
      angularDamping: CFG.angularDamping,
    });
    makeFixture(body, r);
    const ball = { tier, body, r, landed: false, dead: false };
    body.setUserData(ball);
    balls.push(ball);
    if (tier > state.bestTier) { state.bestTier = tier; state.bestCount = 1; }
    else if (tier === state.bestTier) state.bestCount++;
    return ball;
  }

  // Push the current settings into every body already in the world.
  function syncPhysics() {
    if (!world) return;
    world.setGravity(pl.Vec2(0, CFG.gravity / U));
    for (const b of balls) {
      const r = radius(b.tier);
      const body = b.body;
      body.setLinearDamping(CFG.linearDamping);
      body.setAngularDamping(CFG.angularDamping);
      if (r !== b.r) {
        body.destroyFixture(body.getFixtureList());
        makeFixture(body, r);
        b.r = r;
      } else {
        const f = body.getFixtureList();
        f.setFriction(CFG.friction);
        f.setRestitution(CFG.restitution);
        f.setDensity(ballMass(r) / (Math.PI * (r / U) ** 2));
        body.resetMassData();
      }
      body.setAwake(true);
    }
    buildWalls();
    for (let c = world.getContactList(); c; c = c.getNext()) { c.resetFriction(); c.resetRestitution(); }
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
    state.dropped = addBall(state.current, x, CFG.heldY, 0);
    // a little spin makes a ball roll off one it lands on dead-centre, instead of balancing
    state.dropped.body.setAngularVelocity((Math.random() < 0.5 ? -1 : 1) * CFG.dropSpin);
    state.dropped.droppedAt = state.time;
    state.started = true;
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
      if (tier === MAX_TIER && !CFG.maxPairVanish) continue;
      const pa = a.body.getPosition(), pb = b.body.getPosition();
      const mx = (pa.x + pb.x) / 2 * U, my = (pa.y + pb.y) / 2 * U;
      const va = a.body.getLinearVelocity(), vb = b.body.getLinearVelocity();
      const vx = (va.x + vb.x) / 2, vy = (va.y + vb.y) / 2;
      if (state.dropped === a || state.dropped === b) state.loadNext = true;
      removeBall(a);
      removeBall(b);
      state.score += points(tier);
      if (tier < MAX_TIER) {
        const nb = addBall(tier + 1, mx, my, 0);
        nb.landed = true;
        const v = CFG.mergeKeepsMomentum ? pl.Vec2(vx, vy) : pl.Vec2(0, 0);
        v.y -= CFG.mergePopSpeed / U;
        nb.body.setLinearVelocity(v);
      }
    }
    if (pairs.length) balls = balls.filter((b) => !b.dead);
  }

  function loadNextBall() {
    state.dropped = null;
    state.loadNext = false;
    state.current = state.next;
    state.next = randTier();
    state.cloudX = clampCloud(state.cloudX);
  }

  function endGame() {
    state.over = true;
    state.overTime = 0;
    state.dangerTime = 0;
    saveScore({ score: state.score, tier: state.bestTier, count: state.bestCount });
  }

  function update(dt, force) {
    state.time += dt;
    for (const r of rings) r.t += dt;
    rings = rings.filter((r) => r.t < CFG.mergeAnim);
    if (state.over) { state.overTime += dt; return; }
    if (CFG.pausePhysics && !force) return;

    world.step(dt, Math.round(CFG.velocityIterations), Math.round(CFG.positionIterations));
    processMerges();

    const sinceDrop = state.dropped ? state.time - state.dropped.droppedAt : 0;
    if (state.dropped && sinceDrop >= CFG.dropDelay && (state.loadNext || sinceDrop > CFG.nextBallTimeout)) {
      loadNextBall();
    }

    if (CFG.autoDrop && state.current != null && state.time - state.lastAutoDrop >= CFG.autoDropInterval) {
      state.lastAutoDrop = state.time;
      state.cloudX = WALL_L + Math.random() * (WALL_R - WALL_L);
      drop();
    }

    // Game over: a settled ball sticking out above the rim for gameOverTime
    let danger = false;
    for (const b of balls) {
      if (!b.landed || b === state.dropped) continue;
      if (b.body.getPosition().y * U - b.r < CFG.rimY) { danger = true; break; }
    }
    state.dangerTime = danger ? state.dangerTime + dt : 0;
    if (state.dangerTime >= CFG.gameOverTime && !CFG.godMode) endGame();
  }

  // ---------------------------------------------------------------- debug actions
  const actions = {
    newGame() { newGame(); screen = 'game'; },
    step() { if (world && !state.over) update(stepDt(), true); },
    clearBoard() {
      for (const b of balls) world.destroyBody(b.body);
      balls = []; rings = [];
      if (state.dropped) loadNextBall();
      state.dangerTime = 0;
    },
    gameOver() { if (!state.over) endGame(); screen = 'game'; },
    shake(strength = 600) {
      for (const b of balls) {
        const v = b.body.getLinearVelocity();
        b.body.setLinearVelocity(pl.Vec2(v.x + (Math.random() - 0.5) * strength / U, v.y - strength / U * (0.6 + Math.random() * 0.4)));
        b.body.setAwake(true);
      }
    },
    spawn(tier) {
      tier = Math.max(0, Math.min(MAX_TIER, tier));
      const r = radius(tier);
      const x = Math.min(WALL_R - r, Math.max(WALL_L + r, clampCloud(state.cloudX)));
      addBall(tier, x, CFG.heldY, 0);
    },
    setCurrent(tier) { state.current = Math.max(0, Math.min(MAX_TIER, tier)); state.dropped = null; state.cloudX = clampCloud(state.cloudX); },
    setNext(tier) { state.next = Math.max(0, Math.min(MAX_TIER, tier)); },
    addScore(n) { state.score = Math.max(0, state.score + Math.round(n)); },
    setScore(n) { state.score = Math.max(0, Math.round(n)); },
    resetScores() { try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ } },
  };

  // ---------------------------------------------------------------- drawing
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

  function line(x0, y0, x1, y1, color, w = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function drawBox() {
    const B = BOX;
    // line centres (the frame is drawn with 2pt strokes)
    const fl = B.frontL + 1, fr = B.frontR - 1, ft = B.frontT + 1, fb = B.frontB - 1;
    const bl = B.backL + 1, br = B.backR - 1, bt = B.backT + 1, ff = B.floorT;
    // inside + top face
    ctx.fillStyle = COL.inside;
    ctx.beginPath();
    ctx.moveTo(fl, ft); ctx.lineTo(bl, bt); ctx.lineTo(br, bt); ctx.lineTo(fr, ft);
    ctx.lineTo(fr, fb); ctx.lineTo(fl, fb); ctx.closePath();
    ctx.fill();
    // floor
    ctx.fillStyle = COL.floor;
    ctx.beginPath();
    ctx.moveTo(bl, ff); ctx.lineTo(br, ff); ctx.lineTo(fr, fb); ctx.lineTo(fl, fb); ctx.closePath();
    ctx.fill();
    // back frame + top corners
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bl, ff); ctx.lineTo(bl, bt); ctx.lineTo(br, bt); ctx.lineTo(br, ff);
    ctx.moveTo(fl, ft); ctx.lineTo(bl, bt);
    ctx.moveTo(fr, ft); ctx.lineTo(br, bt);
    ctx.stroke();
    // front frame
    roundRect(fl, ft, fr - fl, fb - ft, 1.5);
    ctx.stroke();
  }

  function drawCloud(cx, top) {
    // union of three puffs and a rounded base; outline drawn first (grown by 2pt), fill on top
    const puffs = [[cx - 16, top + 20, 11], [cx, top + 13, 13], [cx + 16, top + 20, 11]];
    for (const [color, g] of [[COL.cloudEdge, 2], [COL.cloud, 0]]) {
      ctx.fillStyle = color;
      for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(x, y, r + g, 0, Math.PI * 2); ctx.fill(); }
      roundRect(cx - 30 - g, top + 16 - g, 60 + 2 * g, 17 + 2 * g, 8.5 + g);
      ctx.fill();
    }
  }

  function drawBackArrow(cx, cy, color, size = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4 * size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 6 * size, cy - 12 * size);
    ctx.lineTo(cx - 6 * size, cy);
    ctx.lineTo(cx + 6 * size, cy + 12 * size);
    ctx.stroke();
  }

  // The debug theme adds a black line through each ball's centre to show its rotation.
  function drawSprite(tier, x, y, angle = 0, r = radius(tier)) {
    ctx.fillStyle = BALLS[tier].color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (!theme().spinLine) return;
    const c = Math.cos(angle) * r, s = Math.sin(angle) * r;
    ctx.strokeStyle = COL.black;
    ctx.lineWidth = CFG.spinLineWidth;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x - c, y - s);
    ctx.lineTo(x + c, y + s);
    ctx.stroke();
  }

  function drawRing(r) {
    const outer = radius(r.tier);
    const hole = outer * Math.min(1, r.t / Math.max(1e-6, CFG.mergeAnim));
    ctx.fillStyle = BALLS[r.tier].color;
    ctx.beginPath();
    ctx.arc(r.x, r.y, outer, 0, Math.PI * 2);
    ctx.arc(r.x, r.y, hole, 0, Math.PI * 2, true);
    ctx.fill();
  }

  function drawHud() {
    drawBackArrow(ARROW_POS.x, ARROW_POS.y, COL.white);
    ctx.save();
    ctx.fontVariantNumeric = 'tabular-nums';
    text(fmt(state.score), VIEW_W / 2, SCORE_Y, { size: 30, weight: 800 });
    ctx.restore();
    const nr = radius(state.next);
    drawSprite(state.next, Math.min(NEXT_POS.x, VIEW_W - 6 - nr), NEXT_POS.y);
    text(`v${VERSION}`, VIEW_W - 10, VIEW_H - 22, { size: 11, weight: 500, color: COL.textMuted, align: 'right' });
  }

  function drawPlayfield() {
    drawBox();

    const heldTier = state.current;
    const cx = Math.round(clampCloud(state.cloudX));
    // guide line (behind the balls)
    if (heldTier != null && !state.over) {
      const r = radius(heldTier);
      line(cx, CFG.heldY + r, cx, BOX.frontB - 1, COL.guide, 2);
    }

    for (const b of balls) {
      const p = b.body.getPosition();
      drawSprite(b.tier, p.x * U, p.y * U, b.body.getAngle());
    }
    for (const r of rings) drawRing(r);

    // cloud + held ball
    drawCloud(cx, CLOUD_TOP);
    if (heldTier != null) drawSprite(heldTier, cx, CFG.heldY);

    // over the limit: the box's top face (the trapezoid above the rim) blinks transparent red,
    // drawn in front of the balls
    if (state.dangerTime > 0 && (state.dangerTime % Math.max(1e-3, CFG.blinkPeriod)) < CFG.blinkOn) {
      const B = BOX;
      ctx.fillStyle = COL.dangerFill;
      ctx.beginPath();
      ctx.moveTo(B.frontL, B.frontT + 2);
      ctx.lineTo(B.backL, B.backT);
      ctx.lineTo(B.backR, B.backT);
      ctx.lineTo(B.frontR, B.frontT + 2);
      ctx.closePath();
      ctx.fill();
    }
    drawDebugOverlays();
  }

  // ---------------------------------------------------------------- debug overlays
  function debugText(text, x, y, align = 'left', color = '#ffffff') {
    ctx.font = '600 10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  let fps = 0, fpsFrames = 0, fpsT = 0;
  function drawDebugOverlays() {
    if (CFG.showTierNumbers || CFG.showVelocity) {
      for (const b of balls) {
        const p = b.body.getPosition(), x = p.x * U, y = p.y * U;
        if (CFG.showVelocity) {
          const v = b.body.getLinearVelocity();
          ctx.strokeStyle = '#ff3df5';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + v.x * U * 0.1, y + v.y * U * 0.1);   // arrow = distance covered in 0.1 s
          ctx.stroke();
        }
        if (CFG.showTierNumbers) debugText(String(b.tier + 1), x, y, 'center');
      }
    }
    if (CFG.showDangerTimer && state.dangerTime > 0) {
      const left = Math.max(0, CFG.gameOverTime - state.dangerTime);
      debugText(CFG.godMode ? 'danger (god mode)' : `game over in ${left.toFixed(2)} s`, VIEW_W / 2, BOX.frontT - 8, 'center', '#ff6b8a');
    }
    if (CFG.rimY !== DEFAULTS.rimY || CFG.showDangerTimer) {
      ctx.fillStyle = 'rgba(255,80,120,0.6)';
      ctx.fillRect(BOX.frontL, CFG.rimY - 0.5, BOX.frontR - BOX.frontL, 1);
    }
    if (CFG.showDebugHud) {
      const lines = [
        `fps ${fps}`,
        `balls ${balls.length}`,
        `t ${state.time.toFixed(1)} s  x${CFG.timeScale}`,
        `danger ${state.dangerTime.toFixed(2)} s`,
        CFG.pausePhysics ? 'PAUSED' : '',
        CFG.godMode ? 'GOD MODE' : '',
        CFG.autoDrop ? 'AUTO DROP' : '',
      ].filter(Boolean);
      lines.forEach((l, i) => debugText(l, 60, BOX.frontB + 14 + i * 12));
    }
  }

  // Small, faint hotspot in the bottom-left corner that opens the debug panel.
  const HOTSPOT = { x: 0, y: VIEW_H - 48, w: 48, h: 48 };
  function drawHotspot() {
    ctx.save();
    ctx.globalAlpha = debugOpen() ? 0.7 : 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    const cx = 20, cy = VIEW_H - 22;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
      ctx.lineTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawButton(y, kind, label, x = BTN_X, w = BTN_W, h = BTN_H) {
    const blue = kind === 'blue';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    roundRect(x, y, w, h, 12);
    ctx.fillStyle = blue ? COL.btnBlue : COL.btnGrey;
    ctx.fill();
    ctx.restore();
    roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, 11.25);
    ctx.strokeStyle = blue ? COL.btnBlueEdge : COL.btnGreyEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(label, x + w / 2, y + h / 2 + 1, { size: 22, weight: 700, color: blue ? COL.white : COL.textDark });
  }

  // Game over: the board stays visible; red text under the score and two buttons below the box.
  function drawGameOver() {
    text('Game Over', VIEW_W / 2, GO_TEXT_Y, { size: 28, weight: 800, color: COL.gameOver });
    const B = GO_BTNS;
    drawButton(B.y, 'grey', 'Highscores', B.highscores.x, B.highscores.w, B.h);
    drawButton(B.y, 'blue', 'Retry', B.retry.x, B.retry.w, B.h);
  }

  // ---------------------------------------------------------------- screens
  let screen = 'title';     // 'title' | 'game' | 'highscores'
  let boardReturn = 'title';

  const TITLE_BTNS = { play: 540, highscores: 610, newGame: 680 };
  const TITLE_FOOT_Y = 800;          // version + "View on GitHub" line
  let titleLink = null;              // clickable area of "View on GitHub", set when drawn
  const inProgress = () => !!(state && state.started && !state.over);

  function drawTitle() {
    rect(0, 0, VIEW_W, VIEW_H, COL.bg);
    text('Funee Ball Game', VIEW_W / 2, 120, { size: 36, weight: 800 });
    const best = (loadScores()[0] || {}).score;
    if (best) text(`Best  ${fmt(best)}`, VIEW_W / 2, 160, { size: 18, weight: 600, color: COL.textMuted });
    // ball showcase
    drawSprite(10, VIEW_W / 2, 300);
    const row = [0, 1, 2, 3, 4];
    let x = 70;
    for (const tier of row) {
      const r = radius(tier);
      drawSprite(tier, x + r, 460 - r);
      x += BALLS[tier].d + 8;
    }
    drawButton(TITLE_BTNS.play, 'blue', inProgress() ? 'Resume' : 'Play');
    drawButton(TITLE_BTNS.highscores, 'grey', 'Highscores');
    if (inProgress()) drawButton(TITLE_BTNS.newGame, 'grey', 'New Game');
    // footer: version and GitHub link on one line, same font and size
    const ver = `v${VERSION}`, sep = '   ·   ', link = 'View on GitHub';
    ctx.font = `500 12px ${FONT}`;
    const wv = ctx.measureText(ver).width, ws = ctx.measureText(sep).width, wl = ctx.measureText(link).width;
    let fx = VIEW_W / 2 - (wv + ws + wl) / 2;
    const y = TITLE_FOOT_Y;
    text(ver, fx, y, { size: 12, weight: 500, color: COL.textMuted, align: 'left' });
    text(sep, fx + wv, y, { size: 12, weight: 500, color: COL.textMuted, align: 'left' });
    fx += wv + ws;
    text(link, fx, y, { size: 12, weight: 500, color: '#8fa6ff', align: 'left' });
    line(fx, y + 8, fx + wl, y + 8, '#8fa6ff', 0.75);
    titleLink = { x: fx - 6, y: y - 14, w: wl + 12, h: 28 };
  }

  const HS_BACK_Y = 728;
  const HS_ROW = 52;                 // row spacing, fits the 50pt beach-ball icon
  // Icon diameter on the highscores list: 9pt for the smallest ball up to 36.8pt for the
  // largest, scaled linearly with the ball's real size.
  const HS_ICON_MIN = 9, HS_ICON_MAX = 36.8;
  function badgeRadius(tier) {
    const d0 = BALLS[0].d, d1 = BALLS[MAX_TIER].d;
    const f = d1 === d0 ? 1 : (BALLS[tier].d - d0) / (d1 - d0);
    return (HS_ICON_MIN + f * (HS_ICON_MAX - HS_ICON_MIN)) / 2;
  }
  // Small icon of a ball. Only the largest ball (beach ball) gets an "Nx" count on top.
  function drawBallBadge(tier, count, x, y, r) {
    drawSprite(tier, x, y, 0, r);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
    ctx.stroke();
    if (tier === MAX_TIER && count > 1) {
      ctx.font = `800 ${Math.max(11, Math.round(r * 0.7))}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, r * 0.18);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(`${count}x`, x, y + 0.5);
      ctx.fillStyle = COL.white;
      ctx.fillText(`${count}x`, x, y + 0.5);
    }
  }

  function drawHighscores() {
    rect(0, 0, VIEW_W, VIEW_H, COL.bg);
    const P = { x: 32, y: 96, w: VIEW_W - 64, h: 616 };
    roundRect(P.x, P.y, P.w, P.h, 18);
    ctx.fillStyle = COL.panel;
    ctx.fill();
    text('Highscores', VIEW_W / 2, P.y + 40, { size: 28, weight: 800, color: COL.accent });
    const list = loadScores();
    ctx.save();
    ctx.fontVariantNumeric = 'tabular-nums';
    for (let i = 0; i < 10; i++) {
      const y = P.y + 92 + i * HS_ROW;
      if (i > 0) line(P.x + 24, y - HS_ROW / 2, P.x + P.w - 24, y - HS_ROW / 2, '#eceef3', 1);
      const color = COL.textDark;
      const e = list[i];
      text(String(i + 1), P.x + 30, y, { size: 22, weight: 700, color, align: 'left' });
      const right = P.x + P.w - 30;
      text(e ? fmt(e.score) : '—', right, y, { size: 22, weight: 700, color: e ? color : COL.textMuted, align: 'right' });
      if (e && e.tier != null && e.tier >= 0 && e.tier <= MAX_TIER) {
        const w = ctx.measureText(fmt(e.score)).width;
        const r = badgeRadius(e.tier);
        drawBallBadge(e.tier, e.count, right - w - 10 - r, y, r);
      }
    }
    ctx.restore();
    drawButton(HS_BACK_Y, 'grey', 'Back');
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
  let pointerDown = false;
  let touch = null;          // { id, startX, lastX, startT, moved }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = toView(e);
    if (p.x >= HOTSPOT.x && p.x <= HOTSPOT.x + HOTSPOT.w && p.y >= HOTSPOT.y && p.y <= HOTSPOT.y + HOTSPOT.h) {
      toggleDebug();
      return;
    }
    if (screen === 'title') {
      if (inBtn(p, TITLE_BTNS.play)) {
        if (!inProgress()) newGame();
        screen = 'game';
      } else if (inBtn(p, TITLE_BTNS.highscores)) { boardReturn = 'title'; screen = 'highscores'; }
      else if (inProgress() && inBtn(p, TITLE_BTNS.newGame)) { newGame(); screen = 'game'; }
      return;
    }
    if (screen === 'highscores') {
      if (inBtn(p, HS_BACK_Y)) screen = boardReturn;
      return;
    }
    // game
    if (p.x < 70 && p.y > 60 && p.y < 125) { screen = 'title'; return; }
    if (state.over) {
      if (state.overTime < GO_INPUT_DELAY) return;
      const B = GO_BTNS;
      const hit = (b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= B.y && p.y <= B.y + B.h;
      if (hit(B.retry)) newGame();
      else if (hit(B.highscores)) { boardReturn = 'game'; screen = 'highscores'; }
      return;
    }
    if (e.pointerType === 'mouse') {
      pointerDown = true;
      state.cloudX = clampCloud(p.x);
    } else if (!touch) {
      touch = { id: e.pointerId, startX: p.x, lastX: p.x, startT: performance.now(), moved: false };
    }
  });
  // The GitHub link opens on 'click' (phones only allow opening links from a finished tap).
  canvas.addEventListener('click', (e) => {
    if (screen !== 'title' || !titleLink) return;
    const p = toView(e), L = titleLink;
    if (p.x >= L.x && p.x <= L.x + L.w && p.y >= L.y && p.y <= L.y + L.h) {
      window.open(REPO_URL, '_blank', 'noopener');
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
      if (Math.abs(x - touch.startX) > CFG.tapSlop) touch.moved = true;
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
    const tap = !touch.moved && performance.now() - touch.startT < CFG.tapTime;
    touch = null;
    if (tap && screen === 'game' && !state.over) drop();
  });
  canvas.addEventListener('pointercancel', (e) => {
    pointerDown = false;
    if (touch && e.pointerId === touch.id) touch = null;
  });

  const keys = new Set();
  const typing = (e) => e.target && e.target.closest && e.target.closest('input, select, textarea, #debug');
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    if (e.code === 'Backquote') { toggleDebug(); return; }
    if (screen !== 'game' || state.over) {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (screen === 'title') { if (!inProgress()) newGame(); screen = 'game'; }
        else if (state && state.over && state.overTime >= GO_INPUT_DELAY) newGame();
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
      if (dir) state.cloudX = clampCloud(clampCloud(state.cloudX) + dir * CFG.keyMoveSpeed * dt);
      const h = stepDt();
      acc += dt * Math.max(0, CFG.timeScale);
      let n = 0;
      while (acc >= h && n++ < 2000) { update(h); acc -= h; }
      if (n >= 2000) acc = 0;
    }
    fpsFrames++; fpsT += dt;
    if (fpsT >= 0.5) { fps = Math.round(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    rect(0, 0, canvas.width, canvas.height, COL.bg);
    const s = canvas.width / VIEW_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);

    if (screen === 'title') drawTitle();
    else if (screen === 'highscores') drawHighscores();
    else {
      drawPlayfield();
      drawHud();
      if (state.over) drawGameOver();
    }
    drawHotspot();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot
  newGame();
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- debug API
  // Used by the debug panel (js/debug.js) and tests.
  let debugPanel = null;
  const debugOpen = () => !!(debugPanel && debugPanel.isOpen());
  function toggleDebug() { if (debugPanel) debugPanel.toggle(); }

  window.FuneeGame = {
    CFG, DEFAULTS, BALLS, BALL_DEFAULTS, MAX_TIER, THEMES,
    get state() { return state; },
    get balls() { return balls; },
    get screen() { return screen; },
    actions,
    // call after changing CFG or BALLS
    changed() { syncPhysics(); saveSettings(); },
    resetSettings() {
      Object.assign(CFG, DEFAULTS);
      BALLS.forEach((b, i) => Object.assign(b, BALL_DEFAULTS[i]));
      syncPhysics();
      saveSettings();
    },
    registerPanel(panel) { debugPanel = panel; },
    // test helpers
    drop, newGame, addBall: (t, x, y) => addBall(t, x, y, 0), setScreen: (s) => { screen = s; },
  };
  window.__game = window.FuneeGame;
})();
