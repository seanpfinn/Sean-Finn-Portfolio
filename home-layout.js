// ── Homepage layout toggle ────────────────────────────────────────────────
// Three views over the same set of projects: two columns (the default),
// a three-across grid, and a globe that shows only the project media —
// no titles, no client logos. The globe pulls three.js in on demand so the
// default view never pays for it.

const STORE_KEY = 'home-layout';
const MODES = ['cols2', 'cols3', 'globe'];

const grid     = document.getElementById('project-grid');
const stage    = document.getElementById('globe-stage');
const canvasEl = document.getElementById('globe-canvas');
const buttons  = Array.from(document.querySelectorAll('.layout-btn'));

if (grid && buttons.length) {
  let mode = read() || 'cols2';
  buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.layout, true)));
  apply(mode, false);
}

function read() {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return MODES.includes(v) ? v : null;
  } catch (e) { return null; }
}

function write(v) {
  try { localStorage.setItem(STORE_KEY, v); } catch (e) {}
}

function apply(next, persist) {
  if (!MODES.includes(next)) next = 'cols2';
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === next)));
  grid.classList.toggle('is-cols-3', next === 'cols3');

  const globeOn = next === 'globe';
  grid.hidden = globeOn;
  if (stage) stage.hidden = !globeOn;
  if (globeOn) startGlobe(); else stopGlobe();

  if (persist) write(next);
}

// ── Globe ─────────────────────────────────────────────────────────────────

let globe = null;      // the running instance, once three.js has loaded
let loading = false;

async function startGlobe() {
  if (globe) { globe.resume(); return; }
  if (loading || !canvasEl) return;
  loading = true;
  try {
    const THREE = await import('./lib/three.module.js');
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

// The globe is built from what's already on the page, so it stays in step
// with the grid without a second source of truth.
function readTiles() {
  return Array.from(grid.querySelectorAll('.gallery-card')).map((card) => {
    const video = card.querySelector('video');
    const img   = card.querySelector('img.gv-video');
    return {
      href:  card.getAttribute('href'),
      title: card.querySelector('.gallery-card-title')?.textContent?.trim() || '',
      type:  video ? 'video' : 'image',
      src:   video ? video.getAttribute('src') : img?.getAttribute('src'),
    };
  }).filter((t) => t.src);
}

function createGlobe(THREE, mount, tiles) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 9.2);

  const world = new THREE.Group();
  scene.add(world);

  const R  = 3.35;                       // sphere radius
  const TW = 1.62;                       // tile width in world units
  const TH = TW * (314 / 575);           // matches the card aspect

  const panels = tiles.map((tile, i) => {
    const { texture, video } = makeTexture(THREE, tile);
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
    mesh.rotateY(Math.PI);               // face outward
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
  new ResizeObserver(resize).observe(mount);
  resize();

  // ── drag to spin ────────────────────────────────────────────────────────
  let velY = reduced ? 0 : 0.0026, velX = 0;
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
  function release(e) {
    if (!dragging) return;
    dragging = false;
    if (moved < 6) openAt(e);
  }
  el.addEventListener('pointerup', release);
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
      velY += ((reduced ? 0 : 0.0026) - velY) * 0.04;   // ease back to drift
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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (active) frame();
  });

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
  };
}

function makeTexture(THREE, tile) {
  if (tile.type === 'video') {
    // A dedicated element per panel; the file is already cached by the grid.
    const video = document.createElement('video');
    video.src = tile.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
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
