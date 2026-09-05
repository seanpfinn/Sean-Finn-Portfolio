// ── Homepage layout + category filter ─────────────────────────────────────
// Tabs on the left narrow the project list (all / apps / web, taken from each
// case study's Platform metadata); the toggles on the right choose how it's
// laid out — two columns, three across, or a globe showing only the project
// media. three.js is pulled in on demand so the default view never pays for it.
//
// NOTE ON ORDER: every `let` below is declared before any function runs, and
// the bootstrap sits at the very bottom of the file. Calling into these
// functions from above their declarations puts `globe`/`THREE` in the
// temporal dead zone and throws on module load.

const LAYOUT_KEY = 'home-layout';
const FILTER_KEY = 'home-filter';
const MODES = ['cols2', 'cols3', 'globe'];
const CATS  = ['all', 'apps', 'web'];
const FADE_MS = 240;

const grid     = document.getElementById('project-grid');
const stage    = document.getElementById('globe-stage');
const canvasEl = document.getElementById('globe-canvas');
const block    = document.querySelector('.projects-block');
const buttons  = Array.from(document.querySelectorAll('.layout-btn'));
const tabs     = Array.from(document.querySelectorAll('.filter-tab'));

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let mode    = 'cols2';
let filter  = 'all';
let globe   = null;
let THREE   = null;
let loading = false;

// ── Storage ───────────────────────────────────────────────────────────────

function readKey(key, allowed) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : null;
  } catch (e) { return null; }
}

function writeKey(key, v) {
  try { localStorage.setItem(key, v); } catch (e) {}
}

// ── Crossfade ─────────────────────────────────────────────────────────────
// Fade the block out, swap the state while it's invisible, then fade back in
// once the new layout has painted.

function transition(commit) {
  if (!block || reduceMotion) { commit(); return; }
  block.classList.add('is-switching');
  setTimeout(() => {
    commit();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => block.classList.remove('is-switching'));
    });
  }, FADE_MS);
}

// ── Category filter ───────────────────────────────────────────────────────

function commitFilter(next) {
  filter = next;
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.cat === filter)));
  grid.querySelectorAll('.gallery-card').forEach((card) => {
    card.hidden = filter !== 'all' && card.dataset.cat !== filter;
  });
  // The globe is built from the visible set, so it has to be rebuilt.
  if (globe && mode === 'globe') rebuildGlobe();
}

function applyFilter(next, userInitiated) {
  const target = CATS.includes(next) ? next : 'all';
  if (userInitiated && target === filter) return;
  if (userInitiated) {
    transition(() => commitFilter(target));
    writeKey(FILTER_KEY, target);
  } else {
    commitFilter(target);
  }
}

// ── Layout ────────────────────────────────────────────────────────────────

function commitLayout(next) {
  mode = next;
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === mode)));
  grid.classList.toggle('is-cols-3', mode === 'cols3');

  const globeOn = mode === 'globe';
  grid.hidden = globeOn;
  if (stage) stage.hidden = !globeOn;
  if (globeOn) startGlobe(); else stopGlobe();
}

function applyLayout(next, userInitiated) {
  const target = MODES.includes(next) ? next : 'cols2';
  if (userInitiated && target === mode) return;
  if (userInitiated) {
    transition(() => commitLayout(target));
    writeKey(LAYOUT_KEY, target);
  } else {
    commitLayout(target);
  }
}

// ── Globe ─────────────────────────────────────────────────────────────────

async function startGlobe() {
  if (globe) { globe.resume(); return; }
  if (loading || !canvasEl) return;
  loading = true;
  try {
    if (!THREE) THREE = await import('./lib/three.module.js');
    globe = createGlobe(THREE, canvasEl, readTiles());
  } catch (e) {
    if (canvasEl) canvasEl.innerHTML = '<p class="globe-hint">Could not load the globe view.</p>';
  } finally {
    loading = false;
  }
}

function stopGlobe() {
  if (globe) globe.pause();
}

function rebuildGlobe() {
  if (!globe || !THREE) return;
  globe.destroy();
  globe = createGlobe(THREE, canvasEl, readTiles());
}

// Built from what's on the page, so it stays in step with the grid and the
// active filter without a second source of truth.
function readTiles() {
  return Array.from(grid.querySelectorAll('.gallery-card'))
    .filter((card) => !card.hidden)
    .map((card) => {
      const video = card.querySelector('video');
      const img   = card.querySelector('img.gv-video');
      return {
        href:  card.getAttribute('href'),
        title: card.querySelector('.gallery-card-title')?.textContent?.trim() || '',
        type:  video ? 'video' : 'image',
        src:   video ? video.getAttribute('src') : img?.getAttribute('src'),
      };
    })
    .filter((t) => t.src);
}

function createGlobe(THREE, mount, tiles) {
  if (!tiles.length) {
    mount.innerHTML = '<p class="globe-hint">Nothing to show in this category.</p>';
    return { pause() {}, resume() {}, destroy() { mount.innerHTML = ''; } };
  }

  // Video elements have to be in the document to reliably decode — a detached
  // one is enough for some browsers but not others. Park them in an
  // off-screen holder rather than display:none, which suspends decoding.
  const pool = document.createElement('div');
  pool.className = 'globe-video-pool';
  pool.setAttribute('aria-hidden', 'true');
  mount.appendChild(pool);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 9.2);

  const world = new THREE.Group();
  scene.add(world);

  // A short list shouldn't sprawl across a big sphere — pull the radius in.
  const R  = Math.max(2.1, Math.min(3.35, 1.15 + tiles.length * 0.17));
  const TW = 1.62;
  const TH = TW * (314 / 575);

  const panels = tiles.map((tile, i) => {
    const { texture, video } = makeTexture(THREE, tile);
    if (video) pool.appendChild(video);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TW, TH),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide })
    );
    // Fibonacci sphere: even coverage without clumping at the poles.
    const k = i + 0.5;
    const phi = Math.acos(1 - 2 * k / tiles.length);
    const theta = Math.PI * (1 + Math.sqrt(5)) * k;
    mesh.position.set(
      R * Math.cos(theta) * Math.sin(phi),
      R * Math.cos(phi),
      R * Math.sin(theta) * Math.sin(phi)
    );
    mesh.lookAt(0, 0, 0);
    mesh.rotateY(Math.PI);
    mesh.userData = { tile, video };
    world.add(mesh);
    return mesh;
  });

  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  resize();

  // ── drag to spin ────────────────────────────────────────────────────────
  let velY = reduceMotion ? 0 : 0.0026, velX = 0;
  let dragging = false, moved = 0, lastX = 0, lastY = 0;
  const el = renderer.domElement;

  el.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    velY = dx * 0.0045;
    velX = dy * 0.0032;
  });
  el.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    if (moved < 6) openAt(e);
  });
  el.addEventListener('pointercancel', () => { dragging = false; });

  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  function openAt(e) {
    const r = el.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(panels, false)[0];
    if (hit?.object?.userData?.tile?.href) location.href = hit.object.userData.tile.href;
  }

  // ── loop ────────────────────────────────────────────────────────────────
  let raf = 0, active = true;
  const forward = new THREE.Vector3();
  const worldPos = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!dragging) {
      velY += ((reduceMotion ? 0 : 0.0026) - velY) * 0.04;
      velX *= 0.92;
    }
    world.rotation.y += velY;
    world.rotation.x = clamp(world.rotation.x + velX, -0.6, 0.6);

    // Only decode video for panels actually facing the viewer.
    for (const m of panels) {
      const v = m.userData.video;
      if (!v) continue;
      m.getWorldPosition(worldPos);
      forward.copy(worldPos).normalize();
      const facing = forward.z > 0.1;
      if (facing && v.paused) v.play().catch(() => {});
      else if (!facing && !v.paused) v.pause();
    }
    renderer.render(scene, camera);
  }
  frame();

  const onVis = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (active) frame();
  };
  document.addEventListener('visibilitychange', onVis);

  return {
    pause() {
      active = false;
      cancelAnimationFrame(raf);
      panels.forEach((m) => m.userData.video?.pause());
    },
    resume() {
      if (active) return;
      active = true;
      resize();
      frame();
    },
    destroy() {
      active = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      panels.forEach((m) => {
        const v = m.userData.video;
        if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
        m.geometry.dispose();
        m.material.map?.dispose();
        m.material.dispose();
      });
      renderer.dispose();
      el.remove();
      pool.remove();
    },
  };
}

function makeTexture(THREE, tile) {
  if (tile.type === 'video') {
    const video = document.createElement('video');
    video.src = tile.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { texture, video };
  }
  const texture = new THREE.TextureLoader().load(tile.src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { texture, video: null };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// ── Bootstrap ─────────────────────────────────────────────────────────────
// Last, so every binding above is initialised before anything runs.

if (grid && buttons.length) {
  buttons.forEach((b) => b.addEventListener('click', () => applyLayout(b.dataset.layout, true)));
  tabs.forEach((t) => t.addEventListener('click', () => applyFilter(t.dataset.cat, true)));

  applyFilter(readKey(FILTER_KEY, CATS) || 'all', false);
  applyLayout(readKey(LAYOUT_KEY, MODES) || 'cols2', false);
}
