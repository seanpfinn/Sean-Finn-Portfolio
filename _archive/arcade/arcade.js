// ── The Arcade ────────────────────────────────────────────────────────────
// Two pieces: a Three.js cartridge library you can spin 360°, and an mGBA
// emulator (via EmulatorJS) that renders inside the Game Boy Advance SP's
// screen cutout. The library is driven by arcade-games.json; no ROMs ship
// with the site, so every cartridge is checked before it can be started.

import * as THREE from './lib/three.module.js';

const MANIFEST   = 'arcade-games.json';
const EJS_DATA   = 'lib/emulatorjs/';
const EJS_CORE   = 'mgba';

// GBA cartridge proportions (57.4 × 35.2 × 8 mm), normalised to width 2.
const CART_W = 2.0;
const CART_H = 2.0 * (35.2 / 57.4);
const CART_D = 2.0 * (8.0 / 57.4);

const stageEl    = document.getElementById('arcade-stage');
const screenEl   = document.getElementById('arcade-screen');
const emuEl      = document.getElementById('arcade-emulator');
const noticeEl   = document.getElementById('arcade-notice');
const nowEl      = document.getElementById('arcade-now');
const prevBtn    = document.getElementById('arcade-prev');
const nextBtn    = document.getElementById('arcade-next');
const startBtn   = document.getElementById('arcade-start');
const shelfEl    = document.getElementById('arcade-shelf');
const padEl      = document.getElementById('arcade-pad');

if (stageEl && shelfEl) init();

async function init() {
  let games = [];
  try {
    const res = await fetch(MANIFEST);
    games = (await res.json()).games || [];
  } catch (e) {
    setNotice('Could not load the game library.');
    return;
  }
  if (!games.length) { setNotice('No games in the library.'); return; }

  // Which cartridges actually have a ROM behind them? Checked up front so the
  // Start button can tell the truth before the visitor presses it.
  await Promise.all(games.map(async (g) => { g.available = await romExists(g.rom); }));

  const shelf = buildShelf(shelfEl, games);
  let index = Math.max(0, games.findIndex((g) => g.id === new URLSearchParams(location.search).get('game')));

  function select(i, { boot = false } = {}) {
    index = ((i % games.length) + games.length) % games.length;
    const g = games[index];
    shelf.focus(index);
    renderNowPlaying(g);
    if (!running) showIdleScreen(g);
    if (boot) start(g);
  }

  prevBtn?.addEventListener('click', () => select(index - 1));
  nextBtn?.addEventListener('click', () => select(index + 1));
  startBtn?.addEventListener('click', () => start(games[index]));
  shelf.onPick((i) => select(i));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || running) return;
    if (e.key === 'ArrowLeft')  select(index - 1);
    if (e.key === 'ArrowRight') select(index + 1);
  });

  setupPad();

  // A ?game= param means we were reloaded to swap cartridges — boot straight in.
  const wanted = new URLSearchParams(location.search).get('game');
  select(index, { boot: Boolean(wanted) && games[index]?.available });
}

// ── Console screen ────────────────────────────────────────────────────────

let running = false;

function showIdleScreen(game) {
  if (screenEl) {
    screenEl.hidden = false;
    if (game.screen) { screenEl.src = game.screen; screenEl.alt = game.title + ' title screen'; }
  }
  setNotice(game.available ? '' : 'Cartridge not inserted');
}

function setNotice(text) {
  if (!noticeEl) return;
  noticeEl.textContent = text;
  noticeEl.hidden = !text;
}

function renderNowPlaying(game) {
  if (!nowEl) return;
  const status = game.available ? '' : ' · no ROM';
  nowEl.innerHTML = `<b></b><span></span>`;
  nowEl.querySelector('b').textContent = game.title;
  nowEl.querySelector('span').textContent = game.meta + status;
  if (startBtn) {
    startBtn.disabled = !game.available;
    startBtn.textContent = game.available ? 'Insert cartridge' : 'No ROM found';
  }
}

async function romExists(url) {
  if (!url) return false;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok;
  } catch (e) {
    return false;
  }
}

// EmulatorJS installs a lot of globals and isn't built to be torn down and
// re-initialised, so the first cartridge boots in place and any later swap
// goes through a reload carrying ?game=.
function start(game) {
  if (!game || !game.available) return;
  if (running) {
    location.search = '?game=' + encodeURIComponent(game.id);
    return;
  }
  running = true;
  if (screenEl) screenEl.hidden = true;
  setNotice('');
  stageEl.classList.add('is-running');
  if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'Running'; }

  window.EJS_player        = '#arcade-emulator';
  window.EJS_core          = EJS_CORE;
  window.EJS_gameUrl       = game.rom;
  window.EJS_pathtodata    = EJS_DATA;
  window.EJS_gameName      = game.title;
  window.EJS_startOnLoaded = true;
  window.EJS_volume        = 0.5;
  window.EJS_onGameStart   = () => padEl?.classList.remove('is-idle');

  const s = document.createElement('script');
  s.src = EJS_DATA + 'loader.js';
  s.onerror = () => {
    running = false;
    stageEl.classList.remove('is-running');
    if (screenEl) screenEl.hidden = false;
    setNotice('Emulator failed to load');
  };
  document.body.appendChild(s);
}

// ── Console buttons ───────────────────────────────────────────────────────
// The shell art is just an image, so each control is a transparent hotspot
// laid over it. Indices are libretro joypad ids, read off EmulatorJS's own
// GBA control table (src/emulator.js).

const GBA_BUTTON = { B: 0, SELECT: 2, START: 3, UP: 4, DOWN: 5, LEFT: 6, RIGHT: 7, A: 8, L: 10, R: 11 };

function padInput(name, isDown) {
  const index = GBA_BUTTON[name];
  if (index === undefined) return;
  const gm = window.EJS_emulator?.gameManager;
  if (!gm || typeof gm.simulateInput !== 'function') return;
  try { gm.simulateInput(0, index, isDown ? 1 : 0); } catch (e) {}
}

function releaseAll() {
  padEl?.querySelectorAll('.pad-btn.is-down').forEach((b) => {
    b.classList.remove('is-down');
    padInput(b.dataset.btn, false);
  });
}

function setupPad() {
  if (!padEl) return;

  padEl.querySelectorAll('.pad-btn').forEach((btn) => {
    const name = btn.dataset.btn;

    function press(e) {
      e?.preventDefault();
      // Nothing is running yet: Start doubles as "insert cartridge", which is
      // what pressing Start on a real console with no game would suggest.
      if (!running) {
        if (name === 'START') startBtn?.click();
        return;
      }
      if (btn.classList.contains('is-down')) return;
      btn.classList.add('is-down');
      padInput(name, true);
    }
    function release() {
      if (!btn.classList.contains('is-down')) return;
      btn.classList.remove('is-down');
      padInput(name, false);
    }

    // Each hotspot tracks its own pointer, so holding a direction while
    // pressing A (or two directions for a diagonal) works on touch too.
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(); }
    });
    btn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') release();
    });
    btn.addEventListener('blur', release);
  });

  // A pointer let go outside the console must still end the press, otherwise
  // the button sticks down in the emulator.
  window.addEventListener('pointerup', releaseAll);
  window.addEventListener('pointercancel', releaseAll);
  window.addEventListener('blur', releaseAll);
}

// ── 3D cartridge library ──────────────────────────────────────────────────

function buildShelf(container, games) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.15, 6.4);

  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555560, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(2.4, 3.2, 4.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-3, 1.2, -2.5);
  scene.add(rim);

  const SPACING = 2.55;
  const carts = games.map((g, i) => {
    const mesh = makeCartridge(g);
    mesh.userData.index = i;
    scene.add(mesh);
    return mesh;
  });

  let active = 0;
  let spinY = 0, tiltX = 0;
  let dragging = false, moved = 0, lastX = 0, lastY = 0;
  let idleSince = performance.now();

  function layout() {
    carts.forEach((m, i) => {
      const d = i - active;
      m.userData.targetX = d * SPACING;
      m.userData.targetZ = d === 0 ? 0 : -0.9;
      m.userData.targetS = d === 0 ? 1 : 0.72;
    });
  }
  layout();

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight || Math.round(w * 0.42);
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // ── drag to rotate the front cartridge a full 360° ──────────────────────
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let pickHandler = null;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0;
    lastX = e.clientX; lastY = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    spinY += dx * 0.011;
    tiltX = clamp(tiltX + dy * 0.006, -0.55, 0.55);
    idleSince = performance.now();
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    idleSince = performance.now();
    // A press that never really moved is a click, not a drag.
    if (moved < 6) pick(e);
  }
  renderer.domElement.addEventListener('pointerup', endDrag);
  renderer.domElement.addEventListener('pointercancel', () => { dragging = false; });

  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(carts, true)[0];
    if (!hit) return;
    let o = hit.object;
    while (o && o.userData.index === undefined) o = o.parent;
    if (!o) return;
    if (o.userData.index === active) { startBtn?.click(); return; }
    pickHandler?.(o.userData.index);
  }

  let raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    // Idle drift, so the shelf never looks frozen.
    if (!dragging && performance.now() - idleSince > 2200) spinY += 0.0032;
    carts.forEach((m, i) => {
      m.position.x += (m.userData.targetX - m.position.x) * 0.12;
      m.position.z += (m.userData.targetZ - m.position.z) * 0.12;
      const s = m.userData.targetS;
      m.scale.x += (s - m.scale.x) * 0.12;
      m.scale.y = m.scale.z = m.scale.x;
      if (i === active) {
        m.rotation.y += (spinY - m.rotation.y) * 0.18;
        m.rotation.x += (tiltX - m.rotation.x) * 0.18;
      } else {
        m.rotation.y += (-0.42 - m.rotation.y) * 0.1;
        m.rotation.x += (0 - m.rotation.x) * 0.1;
      }
    });
    renderer.render(scene, camera);
  }
  tick();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else { idleSince = performance.now(); tick(); }
  });

  return {
    focus(i) { active = i; spinY = 0; tiltX = 0; idleSince = performance.now(); layout(); },
    onPick(fn) { pickHandler = fn; },
  };
}

function makeCartridge(game) {
  const group = new THREE.Group();
  const shell = new THREE.Color(game.shell || '#6b7280');

  // Body: rounded-rectangle outline extruded to the cartridge's depth.
  const r = CART_H * 0.13;
  const shape = roundedRect(CART_W, CART_H, r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: CART_D, bevelEnabled: true,
    bevelThickness: CART_D * 0.16, bevelSize: CART_D * 0.13, bevelSegments: 3, curveSegments: 12,
  });
  geo.center();
  const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: shell, roughness: 0.62, metalness: 0.05,
  }));
  group.add(body);

  // Label, sitting just proud of the front face.
  const lw = CART_W * 0.84, lh = CART_H * 0.66;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(lw, lh),
    new THREE.MeshBasicMaterial({ map: labelTexture(game), toneMapped: false })
  );
  label.position.set(0, CART_H * 0.07, CART_D / 2 + 0.021);
  group.add(label);

  // Connector lip along the bottom edge.
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(CART_W * 0.66, CART_H * 0.1, CART_D * 0.62),
    new THREE.MeshStandardMaterial({ color: shell.clone().multiplyScalar(0.72), roughness: 0.8 })
  );
  lip.position.set(0, -CART_H / 2 - CART_H * 0.03, 0);
  group.add(lip);

  return group;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Uses the artwork at game.label when present. Otherwise draws a plain
// typographic label from the manifest — deliberately generic, not a
// reproduction of any published cartridge art.
function labelTexture(game) {
  const W = 768, H = 604;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  g.fillStyle = '#f4f4f2';
  g.fillRect(0, 0, W, H);
  g.fillStyle = game.shell || '#6b7280';
  g.fillRect(0, 0, W, 92);
  g.fillStyle = game.accent || '#ffffff';
  g.fillRect(0, 92, W, 10);

  g.fillStyle = '#ffffff';
  g.font = '600 34px "Geist Mono", ui-monospace, monospace';
  g.textBaseline = 'middle';
  g.fillText('GAME BOY ADVANCE', 28, 48);

  g.fillStyle = '#17171a';
  g.font = '600 52px "Geist", system-ui, sans-serif';
  wrapText(g, game.title, 28, 190, W - 56, 62);

  g.fillStyle = '#6b6b72';
  g.font = '400 30px "Geist Mono", ui-monospace, monospace';
  g.fillText(game.meta || '', 28, H - 52);

  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, W - 4, H - 4);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  if (game.label) {
    // Swap in the real artwork once it loads; the drawn label is the fallback.
    new THREE.TextureLoader().load(game.label, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = 8;
      tex.image = loaded.image;
      tex.needsUpdate = true;
    }, undefined, () => {});
  }
  return tex;
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(/\s+/);
  let line = '', row = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + row * lh); line = w; row++;
      if (row > 2) return;
    } else line = test;
  }
  ctx.fillText(line, x, y + row * lh);
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
