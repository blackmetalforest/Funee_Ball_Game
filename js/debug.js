/* Funee Ball Game - debug panel
 *
 * Opened by tapping the faint gear in the bottom-left corner (or the ` key).
 * Every value is applied live and remembered in localStorage until reset.
 */
(() => {
  'use strict';
  const G = window.FuneeGame;
  if (!G) return;
  const { CFG, DEFAULTS, BALLS, BALL_DEFAULTS, MAX_TIER, THEMES, actions } = G;

  const tierOptions = (withRandom) => [
    ...(withRandom ? [[-1, 'random']] : []),
    ...BALLS.map((b, i) => [i, `${i + 1} ${b.name}`]),
  ];

  // [key, label, options]  options: { step, min, max, unit, type: 'select', choices }
  const SECTIONS = [
    ['Physics', [
      ['gravity', 'Gravity', { step: 10, unit: 'pt/s²' }],
      ['linearDamping', 'Air drag', { step: 0.05, min: 0, unit: '/s' }],
      ['angularDamping', 'Spin drag', { step: 0.05, min: 0, unit: '/s' }],
      ['restitution', 'Ball bounce', { step: 0.01, min: 0, max: 1.5 }],
      ['friction', 'Ball friction', { step: 0.01, min: 0 }],
      ['wallRestitution', 'Wall/floor bounce', { step: 0.01, min: 0, max: 1.5 }],
      ['wallFriction', 'Wall/floor friction', { step: 0.01, min: 0 }],
      ['massMin', 'Mass of smallest ball', { step: 1, min: 0.01 }],
      ['massMax', 'Mass of largest ball', { step: 1, min: 0.01 }],
      ['timeScale', 'Game speed (slow-mo < 1)', { step: 0.1, min: 0, unit: '×' }],
      ['physicsHz', 'Physics steps per second', { step: 30, min: 30, max: 1000 }],
      ['velocityIterations', 'Velocity iterations', { step: 1, min: 1, max: 100 }],
      ['positionIterations', 'Position iterations', { step: 1, min: 1, max: 100 }],
    ]],
    ['Gameplay', [
      ['dropDelay', 'Min. time between drops', { step: 0.05, min: 0, unit: 's' }],
      ['nextBallTimeout', 'Next ball timeout', { step: 0.1, min: 0, unit: 's' }],
      ['gameOverTime', 'Game-over delay (red warning)', { step: 0.1, min: 0, unit: 's' }],
      ['rimY', 'Game-over line height', { step: 1, unit: 'pt' }],
      ['heldY', 'Drop height (ball centre)', { step: 1, unit: 'pt' }],
      ['dropSpin', 'Drop spin (random direction)', { step: 0.5, min: 0, unit: 'rad/s' }],
      ['spawnTiers', 'Droppable ball types', { step: 1, min: 1, max: MAX_TIER + 1 }],
      ['pointsBase', 'Points: base', { step: 1, min: 0 }],
      ['pointsMultiplier', 'Points: × per size', { step: 0.1, min: 0 }],
      ['maxPairVanish', 'Two largest balls vanish', {}],
      ['mergeKeepsMomentum', 'Merged ball keeps momentum', {}],
      ['mergePopSpeed', 'Merged ball upward pop', { step: 10, min: 0, unit: 'pt/s' }],
      ['mergeAnim', 'Merge ring animation', { step: 0.05, min: 0, unit: 's' }],
      ['blinkPeriod', 'Red warning blink period', { step: 0.05, min: 0.01, unit: 's' }],
      ['blinkOn', 'Red warning blink on-time', { step: 0.05, min: 0, unit: 's' }],
    ]],
    ['Controls', [
      ['tapSlop', 'Tap: max finger movement', { step: 1, min: 0, unit: 'pt' }],
      ['tapTime', 'Tap: max duration', { step: 10, min: 0, unit: 'ms' }],
      ['keyMoveSpeed', 'Arrow-key cloud speed', { step: 10, min: 0, unit: 'pt/s' }],
    ]],
    ['Display', [
      ['theme', 'Theme', { type: 'select', choices: () => Object.entries(THEMES).map(([k, t]) => [k, t.label]) }],
      ['spinLineWidth', 'Spin line width (debug theme)', { step: 0.5, min: 0, unit: 'pt' }],
      ['showTierNumbers', 'Show ball size numbers', {}],
      ['showVelocity', 'Show velocity arrows', {}],
      ['showDangerTimer', 'Show game-over countdown', {}],
      ['showDebugHud', 'Show stats (fps, balls…)', {}],
    ]],
    ['Cheats', [
      ['godMode', 'God mode (no game over)', {}],
      ['pausePhysics', 'Pause physics', {}],
      ['forceTier', 'Always spawn', { type: 'select', choices: () => tierOptions(true) }],
      ['autoDrop', 'Auto-drop (random spot)', {}],
      ['autoDropInterval', 'Auto-drop interval', { step: 0.05, min: 0.05, unit: 's' }],
    ]],
  ];

  // ------------------------------------------------------------------ DOM
  const css = `
  #debug{position:fixed;z-index:10;display:none;flex-direction:column;
    background:rgba(12,12,24,.7);color:#e9ecf5;border:1px solid rgba(255,255,255,.25);
    border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5);backdrop-filter:blur(3px);
    font:13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;touch-action:pan-y}
  #debug.open{display:flex}
  #debug header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 14px;
    border-bottom:1px solid rgba(255,255,255,.15);font-weight:700;letter-spacing:.04em}
  #debug header button{all:unset;cursor:pointer;font-size:20px;line-height:1;padding:2px 8px;border-radius:6px}
  #debug header button:hover{background:rgba(255,255,255,.12)}
  #debug .body{overflow-y:scroll;padding:4px 12px 14px;-webkit-overflow-scrolling:touch;
    scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.45) transparent}
  #debug .body::-webkit-scrollbar{width:8px}
  #debug .body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.4);border-radius:4px}
  #debug h3{margin:14px 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#9fb0ff}
  #debug .row{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06)}
  #debug .row label{flex:1;min-width:0}
  #debug .row .unit{color:#8f96aa;font-size:11px;margin-left:4px}
  #debug .row.changed label{color:#ffd166}
  #debug input[type=number],#debug select{width:92px;box-sizing:border-box;padding:4px 6px;border-radius:6px;
    border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.45);color:#fff;font:inherit;text-align:right}
  #debug select{text-align:left;width:150px}
  #debug input[type=checkbox]{width:20px;height:20px;accent-color:#5b7cff}
  #debug input[type=color]{width:40px;height:26px;padding:0;border:none;background:none}
  #debug button.act{padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.25);
    background:rgba(91,124,255,.25);color:#fff;font:inherit;cursor:pointer}
  #debug button.act:hover{background:rgba(91,124,255,.45)}
  #debug button.danger{background:rgba(255,80,110,.25)}
  #debug .btns{display:flex;flex-wrap:wrap;gap:6px;padding:6px 0}
  #debug .ball{display:grid;grid-template-columns:1fr 70px 40px;gap:8px;align-items:center;padding:3px 0}
  #debug .ball input[type=number]{width:70px}
  #debug .hint{color:#8f96aa;font-size:11px;margin:6px 0}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'debug';
  root.innerHTML = `<header><span>DEBUG</span><button type="button" aria-label="Close">✕</button></header><div class="body"></div>`;
  document.body.appendChild(root);
  const body = root.querySelector('.body');
  root.querySelector('header button').addEventListener('click', () => panel.close());

  const el = (tag, props = {}, ...kids) => {
    const e = document.createElement(tag);
    Object.assign(e, props);
    for (const k of kids) e.append(k);
    return e;
  };
  const rows = [];   // { refresh() }

  function changed() { G.changed(); refreshAll(); }

  function numRow(key, label, o) {
    const input = el('input', { type: 'number', step: o.step ?? 'any', inputMode: 'decimal' });
    if (o.min !== undefined) input.min = o.min;
    if (o.max !== undefined) input.max = o.max;
    const row = el('div', { className: 'row' },
      el('label', { textContent: label }, el('span', { className: 'unit', textContent: o.unit || '' })), input);
    const commit = () => {
      let v = parseFloat(input.value);
      if (!Number.isFinite(v)) return;
      if (o.min !== undefined) v = Math.max(o.min, v);
      if (o.max !== undefined) v = Math.min(o.max, v);
      CFG[key] = v;
      changed();
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { commit(); input.blur(); } });
    rows.push({ refresh() {
      if (document.activeElement !== input) input.value = +CFG[key].toFixed(4);
      row.classList.toggle('changed', CFG[key] !== DEFAULTS[key]);
    } });
    return row;
  }

  function boolRow(key, label) {
    const input = el('input', { type: 'checkbox' });
    const row = el('div', { className: 'row' }, el('label', { textContent: label }), input);
    input.addEventListener('change', () => { CFG[key] = input.checked; changed(); });
    rows.push({ refresh() { input.checked = CFG[key]; row.classList.toggle('changed', CFG[key] !== DEFAULTS[key]); } });
    return row;
  }

  function selectRow(key, label, o) {
    const sel = el('select');
    for (const [v, t] of o.choices()) sel.append(el('option', { value: v, textContent: t }));
    const row = el('div', { className: 'row' }, el('label', { textContent: label }), sel);
    sel.addEventListener('change', () => {
      CFG[key] = typeof DEFAULTS[key] === 'number' ? Number(sel.value) : sel.value;
      changed();
    });
    rows.push({ refresh() { sel.value = CFG[key]; row.classList.toggle('changed', CFG[key] !== DEFAULTS[key]); } });
    return row;
  }

  function button(text, fn, cls = '') {
    const b = el('button', { type: 'button', className: 'act ' + cls, textContent: text });
    b.addEventListener('click', () => { fn(); refreshAll(); });
    return b;
  }

  // ------------------------------------------------------------------ build
  for (const [title, items] of SECTIONS) {
    body.append(el('h3', { textContent: title }));
    for (const [key, label, o] of items) {
      const kind = o.type === 'select' ? 'select' : typeof DEFAULTS[key];
      body.append(kind === 'boolean' ? boolRow(key, label) : kind === 'select' ? selectRow(key, label, o) : numRow(key, label, o));
    }
    if (title === 'Cheats') {
      // one-shot actions
      const tierSel = el('select');
      for (const [v, t] of tierOptions(false)) tierSel.append(el('option', { value: v, textContent: t }));
      body.append(el('div', { className: 'row' }, el('label', { textContent: 'Ball' }), tierSel));
      body.append(el('div', { className: 'btns' },
        button('Spawn at cloud', () => actions.spawn(+tierSel.value)),
        button('Hold in cloud', () => actions.setCurrent(+tierSel.value)),
        button('Set as next', () => actions.setNext(+tierSel.value)),
      ));
      const scoreIn = el('input', { type: 'number', step: 10, value: 1000, inputMode: 'numeric' });
      body.append(el('div', { className: 'row' }, el('label', { textContent: 'Score amount' }), scoreIn));
      body.append(el('div', { className: 'btns' },
        button('Add to score', () => actions.addScore(+scoreIn.value || 0)),
        button('Set score', () => actions.setScore(+scoreIn.value || 0)),
      ));
      body.append(el('div', { className: 'btns' },
        button('Step 1 physics frame', () => actions.step()),
        button('Shake box', () => actions.shake()),
        button('Clear board', () => actions.clearBoard()),
        button('New game', () => actions.newGame()),
        button('Trigger game over', () => actions.gameOver(), 'danger'),
      ));
    }
  }

  // per-ball size and colour
  body.append(el('h3', { textContent: 'Balls' }));
  body.append(el('div', { className: 'hint', textContent: 'Diameter in pt (= physics size) and colour. Applies to balls already in play.' }));
  BALLS.forEach((b, i) => {
    const size = el('input', { type: 'number', step: 1, min: 4, inputMode: 'numeric' });
    const color = el('input', { type: 'color' });
    const label = el('label', { textContent: `${i + 1} ${b.name}` });
    size.addEventListener('change', () => {
      const v = parseFloat(size.value);
      if (Number.isFinite(v) && v >= 4) { b.d = v; changed(); }
    });
    color.addEventListener('input', () => { b.color = color.value; G.changed(); refreshAll(); });
    const row = el('div', { className: 'ball' }, label, size, color);
    body.append(row);
    rows.push({ refresh() {
      if (document.activeElement !== size) size.value = b.d;
      color.value = b.color;
      label.style.color = (b.d !== BALL_DEFAULTS[i].d || b.color !== BALL_DEFAULTS[i].color) ? '#ffd166' : '';
    } });
  });

  body.append(el('h3', { textContent: 'Reset' }));
  body.append(el('div', { className: 'hint', textContent: 'Changed values are shown in yellow and are remembered on this device.' }));
  body.append(el('div', { className: 'btns' },
    button('Reset all settings', () => G.resetSettings(), 'danger'),
    button('Clear high scores', () => { if (confirm('Clear all saved high scores?')) actions.resetScores(); }, 'danger'),
  ));

  function refreshAll() { for (const r of rows) r.refresh(); }

  // ------------------------------------------------------------------ placement
  function place() {
    const c = document.getElementById('game').getBoundingClientRect();
    const w = Math.min(c.width * 0.92, 420);
    root.style.left = Math.round(c.left + (c.width - w) / 2) + 'px';
    root.style.width = Math.round(w) + 'px';
    root.style.top = Math.round(c.top + c.height * 0.06) + 'px';
    root.style.height = Math.round(c.height * 0.82) + 'px';
  }
  window.addEventListener('resize', () => { if (panel.isOpen()) place(); });

  const panel = {
    isOpen: () => root.classList.contains('open'),
    open() { place(); refreshAll(); root.classList.add('open'); },
    close() { root.classList.remove('open'); document.activeElement && document.activeElement.blur(); },
    toggle() { this.isOpen() ? this.close() : this.open(); },
  };
  G.registerPanel(panel);
})();
