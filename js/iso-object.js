/*
 * <iso-object> — turns a flat product photo into a lit, extruded 3D object
 * presented at an isometric angle. Click to spin it 360°, drag to rotate.
 *
 *   import "./iso-object.js";   // or a module script tag pointing at this file
 *   <iso-object src="device.png" depth="0.06" grid></iso-object>
 *
 * Attributes
 *   src         front image (PNG with alpha, or JPG/PNG on a plain background)
 *   back        optional image of the back side; framing and scale may differ — the silhouettes are
 *               fitted to each other and the image is mirrored to match
 *   back-relief-spec  relief spec for the back (coordinates in the back image's pixels), or a child
 *               <script type="application/json" data-relief="back">
 *   depth       thickness as a fraction of the object's width   (default 0.06)
 *   bevel       edge roundness as a fraction of depth            (default 0.35)
 *   relief      front relief strength, 0 = flat face             (default 1)
 *   relief-spec JSON file describing the front's raised/recessed shapes (see reliefFromSpec);
 *               or put the JSON in a child <script type="application/json" data-relief>.
 *               Without a spec, the component detects a screen and large round controls itself.
 *   tolerance   background removal tolerance, 0–255              (default 28)
 *   yaw         resting yaw in degrees                           (default 22)
 *   elevation   camera elevation in degrees (35.26 = true iso)   (default 30)
 *   azimuth     camera azimuth in degrees                        (default 45)
 *   gloss       front-face clearcoat 0–1                         (default 0.6)
 *   exposure    overall brightness                               (default 1.05)
 *   fit         framing zoom; >1 fills more of the box           (default 1)
 *   body        body color for the back/edges, e.g. "#2b2c2f"   (default: sampled)
 *   grid        show an isometric floor grid
 *   no-shadow   hide the floor shadow
 *   no-hint     hide the "Click to spin" pill
 *   hint-idle / hint-active   custom pill text for the resting and rotating states
 *
 * Events: "iso-ready" (detail: body, reliefFeatures, reliefSource), "iso-rotate" (detail: {yaw, pitch} in degrees), "iso-mode".
 * Methods: spin(), reset(), setPose(yawDeg, pitchDeg), getPose(),
 *          exportPNG({ yaw, pitch, width, height, shadow, grid }) → Promise<Blob> (transparent PNG).
 * Styling: --iso-grid-color, --iso-shadow-opacity, ::part(hint).
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------------------------------------------ */
/* Image → mask, bled texture, body color                              */
/* ------------------------------------------------------------------ */

async function loadImage(src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  return img;
}

function prepareImage(img, { tolerance = 28, maxSize = 1400 } = {}) {
  const s = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(2, Math.round(img.naturalWidth * s));
  const h = Math.max(2, Math.round(img.naturalHeight * s));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const N = w * h;
  let mask = new Uint8Array(N);

  // 1) Foreground: real alpha if present, otherwise flood-fill the background from the border.
  let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 200) clear++;
  if (clear > N * 0.01) {
    for (let i = 0; i < N; i++) mask[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  } else {
    const ref = [0, 0, 0];
    const corners = [0, w - 1, (h - 1) * w, h * w - 1];
    for (const c of corners) for (let k = 0; k < 3; k++) ref[k] += d[c * 4 + k] / 4;
    const isBg = (p) => {
      const o = p * 4;
      return Math.max(Math.abs(d[o] - ref[0]), Math.abs(d[o + 1] - ref[1]), Math.abs(d[o + 2] - ref[2])) <= tolerance;
    };
    mask.fill(1);
    const stack = [];
    const push = (p) => { if (mask[p] && isBg(p)) { mask[p] = 0; stack.push(p); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = (p / w) | 0;
      if (x > 0) push(p - 1); if (x < w - 1) push(p + 1);
      if (y > 0) push(p - w); if (y < h - 1) push(p + w);
    }
  }

  // 2) Fill interior holes (anything background-colored not reachable from the border stays foreground already);
  //    erode 1px to drop anti-aliased halo pixels.
  const eroded = new Uint8Array(N);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    eroded[p] = mask[p] & mask[p - 1] & mask[p + 1] & mask[p - w] & mask[p + w];
  }
  mask = eroded;

  // 3) Keep the largest connected component.
  const label = new Int32Array(N);
  let best = 0, bestSize = 0, cur = 0;
  for (let p0 = 0; p0 < N; p0++) {
    if (!mask[p0] || label[p0]) continue;
    cur++; let size = 0; const st = [p0]; label[p0] = cur;
    while (st.length) {
      const p = st.pop(); size++;
      const x = p % w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of nb) if (q >= 0 && q < N && mask[q] && !label[q]) { label[q] = cur; st.push(q); }
    }
    if (size > bestSize) { bestSize = size; best = cur; }
  }
  for (let p = 0; p < N; p++) mask[p] = label[p] === best ? 1 : 0;

  // 4) Body color: average of the band just inside the silhouette.
  let r = 0, g = 0, b = 0, n = 0;
  const R = Math.max(2, Math.round(Math.min(w, h) * 0.01));
  for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) {
    const p = y * w + x;
    if (!mask[p]) continue;
    if (!mask[p - R] || !mask[p + R] || !mask[p - R * w] || !mask[p + R * w]) {
      const o = p * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; n++;
    }
  }
  const body = n ? [r / n, g / n, b / n] : [40, 40, 44];

  // 5) Bleed edge colors outward so bevels and texture filtering never sample the background.
  const filled = mask.slice();
  for (let p = 0; p < N; p++) d[p * 4 + 3] = 255;
  let frontier = [];
  for (let p = 0; p < N; p++) if (!filled[p]) frontier.push(p);
  for (let pass = 0; pass < 24 && frontier.length; pass++) {
    const next = [], writes = [];
    for (const p of frontier) {
      const x = p % w; let rr = 0, gg = 0, bb = 0, c = 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w, x > 0 ? p - w - 1 : -1, x < w - 1 ? p + w + 1 : -1];
      for (const q of nb) if (q >= 0 && q < N && filled[q]) { const o = q * 4; rr += d[o]; gg += d[o + 1]; bb += d[o + 2]; c++; }
      if (c) writes.push(p, rr / c, gg / c, bb / c); else next.push(p);
    }
    for (let i = 0; i < writes.length; i += 4) {
      const o = writes[i] * 4; d[o] = writes[i + 1]; d[o + 1] = writes[i + 2]; d[o + 2] = writes[i + 3]; filled[writes[i]] = 1;
    }
    frontier = next;
  }
  for (const p of frontier) { const o = p * 4; d[o] = body[0]; d[o + 1] = body[1]; d[o + 2] = body[2]; }
  ctx.putImageData(id, 0, 0);

  return { canvas, mask, w, h, body, srcW: img.naturalWidth, srcH: img.naturalHeight };
}

/* ------------------------------------------------------------------ */
/* Mask → smooth outline                                               */
/* ------------------------------------------------------------------ */

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const dirIndex = (dx, dy) => DIRS.findIndex(([a, b]) => a === dx && b === dy);

function traceOutline(mask, w, h) {
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  let sx = -1, sy = -1;
  outer: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) { sx = x; sy = y; break outer; }
  if (sx < 0) return [];
  const pts = [[sx, sy]];
  let cx = sx, cy = sy, bd = 4; // backtrack starts to the west
  for (let guard = 0; guard < w * h * 4; guard++) {
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const i = (bd + k) % 8;
      const nx = cx + DIRS[i][0], ny = cy + DIRS[i][1];
      if (at(nx, ny)) {
        const j = (bd + k - 1) % 8;
        const bx = cx + DIRS[j][0], by = cy + DIRS[j][1];
        cx = nx; cy = ny; bd = dirIndex(bx - cx, by - cy);
        found = true; break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy) break;
    pts.push([cx, cy]);
  }
  return pts;
}

function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const dd = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (dd > md) { md = dd; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function chaikin(pts, iterations) {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

/* ------------------------------------------------------------------ */
/* Outline → extruded mesh with front / back / edge groups             */
/* ------------------------------------------------------------------ */

function buildGeometry(outline, w, h, { depthRatio, bevelRatio, width = 2 }) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of outline) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const k = width / (maxX - minX);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2((x - cx) * k, (cy - y) * k)));

  const D = width * depthRatio;
  const bevel = D * bevelRatio;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0001, D - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 8,
    curveSegments: 4,
  });
  geo.translate(0, 0, -(D - 2 * bevel) / 2);
  geo.userData = { k, cx, cy, D, bevel };

  // Front-projected UVs: every vertex samples the photo at its own x/y.
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) / k + cx, py = cy - pos.getY(i) / k;
    uv[i * 2] = px / w; uv[i * 2 + 1] = 1 - py / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // Back-face UVs mirror horizontally (used only when a back image is supplied).
  const uvBack = new Float32Array(uv);
  for (let i = 0; i < pos.count; i++) uvBack[i * 2] = 1 - uv[i * 2];
  geo.setAttribute('uv1', new THREE.BufferAttribute(uvBack, 2));

  // Split the lid group into front and back, keep sides; build an index so groups are contiguous.
  const [lids, sides] = geo.groups;
  const front = [], back = [], side = [];
  for (let t = lids.start; t < lids.start + lids.count; t += 3) (pos.getZ(t) > 0 ? front : back).push(t, t + 1, t + 2);
  for (let t = sides.start; t < sides.start + sides.count; t += 3) side.push(t, t + 1, t + 2);

  // Smooth the edge normals so the bevel reads as a soft, continuous radius.
  const nrm = geo.attributes.normal;
  const acc = new Map();
  const key = (i) => `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
  for (const i of side) {
    const kk = key(i); const a = acc.get(kk) || [0, 0, 0];
    a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i); acc.set(kk, a);
  }
  for (const i of side) {
    const a = acc.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1;
    nrm.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }

  geo.setIndex([...front, ...back, ...side]);
  geo.clearGroups();
  geo.addGroup(0, front.length, 0);
  geo.addGroup(front.length, back.length, 1);
  geo.addGroup(front.length + back.length, side.length, 2);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

/* ------------------------------------------------------------------ */
/* Front relief: read the photo for screens, buttons and sticks        */
/* ------------------------------------------------------------------ */

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Chamfer distance (px) from each "on" pixel to the nearest "off" pixel; image border counts as off.
function distanceField(on, w, h) {
  const INF = 1e9, d = new Float32Array(w * h), S = Math.SQRT2;
  for (let i = 0; i < w * h; i++) d[i] = on[i] ? INF : 0;
  const g = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!d[i]) continue;
    d[i] = Math.min(d[i], g(x - 1, y) + 1, g(x, y - 1) + 1, g(x - 1, y - 1) + S, g(x + 1, y - 1) + S);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!d[i]) continue;
    d[i] = Math.min(d[i], g(x + 1, y) + 1, g(x, y + 1) + 1, g(x + 1, y + 1) + S, g(x - 1, y + 1) + S);
  }
  return d;
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { let acc = 0, n = 0;
    for (let x = -r; x < w + r; x++) {
      if (x + r < w && x + r >= 0) { acc += src[y * w + x + r]; n++; }
      if (x - r - 1 >= 0) { acc -= src[y * w + x - r - 1]; n--; }
      if (x >= 0 && x < w) tmp[y * w + x] = acc / n;
    } }
  for (let x = 0; x < w; x++) { let acc = 0, n = 0;
    for (let y = -r; y < h + r; y++) {
      if (y + r < h && y + r >= 0) { acc += tmp[(y + r) * w + x]; n++; }
      if (y - r - 1 >= 0) { acc -= tmp[(y - r - 1) * w + x]; n--; }
      if (y >= 0 && y < h) out[y * w + x] = acc / n;
    } }
  return out;
}

/*
 * Reads the photo and returns a height field (world units above the front plane):
 *   - a large, dark, rectangular region is treated as a screen and set into a raised bezel;
 *   - small, compact, closed shapes (buttons, sticks, lenses, keys) rise as rounded caps,
 *     taller for larger features;
 *   - strong lines that aren't part of a feature become shallow seams.
 * Also returns cavity shading so feature bases and the screen lip pick up contact shadow.
 */
function analyzeRelief(prep, geoInfo, { strength = 1, maxRes = 720 } = {}) {
  const a = Math.min(1, maxRes / prep.w);
  const w = Math.max(8, Math.round(prep.w * a)), h = Math.max(8, Math.round(prep.h * a));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx2 = c.getContext('2d', { willReadFrequently: true }); cx2.imageSmoothingQuality = 'high';
  cx2.drawImage(prep.canvas, 0, 0, w, h);
  const px = cx2.getImageData(0, 0, w, h).data;
  const N = w * h;
  const mask = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    mask[y * w + x] = prep.mask[Math.min(prep.h - 1, Math.round(y / a)) * prep.w + Math.min(prep.w - 1, Math.round(x / a))];
  let A = 0; for (let i = 0; i < N; i++) A += mask[i];

  const kA = geoInfo.k / a;                 // world units per analysis pixel
  const D = geoInfo.D;
  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];

  // Edges: Sobel on a lightly blurred copy, max over RGB so colored rings register too.
  const ch = [0, 1, 2].map((k) => { const f = new Float32Array(N); for (let i = 0; i < N; i++) f[i] = px[i * 4 + k]; return boxBlur(f, w, h, 1); });
  const grad = new Float32Array(N);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; let m = 0;
    for (const f of ch) {
      const gx = f[i - w + 1] + 2 * f[i + 1] + f[i + w + 1] - f[i - w - 1] - 2 * f[i - 1] - f[i + w - 1];
      const gy = f[i + w - 1] + 2 * f[i + w] + f[i + w + 1] - f[i - w - 1] - 2 * f[i - w] - f[i - w + 1];
      m = Math.max(m, Math.hypot(gx, gy));
    }
    grad[i] = m;
  }
  // Low threshold closes the faint outlines of dark-on-dark buttons; seams use a stronger one.
  const T = 20, Tseam = 46;
  const edge = new Uint8Array(N);
  for (let i = 0; i < N; i++) edge[i] = mask[i] && grad[i] > T ? 1 : 0;

  // Regions: connected non-edge pixels inside the silhouette.
  const lab = new Int32Array(N); const regs = [null];
  for (let p0 = 0; p0 < N; p0++) {
    if (!mask[p0] || edge[p0] || lab[p0]) continue;
    const id = regs.length, st = [p0];
    const R = { id, area: 0, x0: w, y0: h, x1: 0, y1: 0, lum: 0, border: false, px: [] };
    lab[p0] = id;
    while (st.length) {
      const p = st.pop(), x = p % w, y = (p / w) | 0;
      R.area++; R.lum += lum[p]; R.px.push(p);
      if (x < R.x0) R.x0 = x; if (x > R.x1) R.x1 = x; if (y < R.y0) R.y0 = y; if (y > R.y1) R.y1 = y;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q < 0) { R.border = true; continue; }
        if (!mask[q]) { R.border = true; continue; }
        if (!edge[q] && !lab[q]) { lab[q] = id; st.push(q); }
      }
    }
    R.lum /= R.area; regs.push(R);
  }

  // Screen: biggest dark, rectangular region.
  let screen = null;
  for (const R of regs) {
    if (!R || R.area < A * 0.08) continue;
    const fill = R.area / ((R.x1 - R.x0 + 1) * (R.y1 - R.y0 + 1));
    if (R.lum < 48 && fill > 0.82 && (!screen || R.area > screen.area)) screen = R;
  }

  // Features: clusters of detail (outlines, glyphs, rings) away from the rim and screen frame.
  // Each cluster's filled footprint becomes one raised cap.
  const dMask = distanceField(mask, w, h);
  const insetPx = geoInfo.bevel / kA + 1;
  const rimPx = Math.max(3, w * 0.025);
  const scrOn = new Uint8Array(N);
  if (screen) for (const p of screen.px) scrOn[p] = 1;
  const dOutScr = screen ? distanceField(scrOn.map((v) => 1 - v), w, h) : null; // distance outside the screen
  const det = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!mask[i] || grad[i] <= 24 || dMask[i] < insetPx + rimPx * 0.6) continue;
    if (dOutScr && dOutScr[i] < Math.max(4, w * 0.012)) continue;
    det[i] = 1;
  }
  { // close small gaps (1px dilation)
    const d2 = det.slice();
    for (let i = w; i < N - w; i++) if (!det[i] && mask[i] && (det[i - 1] || det[i + 1] || det[i - w] || det[i + w])) d2[i] = 1;
    det.set(d2);
  }
  const cl = new Int32Array(N); const cands = [];
  for (let p0 = 0; p0 < N; p0++) {
    if (!det[p0] || cl[p0]) continue;
    const id = cands.length + 1, st = [p0]; cl[p0] = id;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    while (st.length) {
      const p = st.pop(), x = p % w, y = (p / w) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx; if (det[q] && !cl[q]) { cl[q] = id; st.push(q); }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const C = { id, x0, y0, bw, bh, n, filled: null, fa: 0 };
    cands.push(C);
    if (bw < 4 || bh < 4 || bw * bh > A * 0.06) continue;
    const X0 = x0 - 1, Y0 = y0 - 1, W = bw + 2, H = bh + 2;
    const out = new Uint8Array(W * H), q0 = [0]; out[0] = 1;
    const inC = (lx, ly) => { const x = lx + X0, y = ly + Y0; return x >= 0 && y >= 0 && x < w && y < h && cl[y * w + x] === id; };
    while (q0.length) {
      const q = q0.pop(), lx = q % W, ly = (q / W) | 0;
      for (const [nx, ny] of [[lx - 1, ly], [lx + 1, ly], [lx, ly - 1], [lx, ly + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nq = ny * W + nx; if (out[nq] || inC(nx, ny)) continue; out[nq] = 1; q0.push(nq);
      }
    }
    const filled = [];
    for (let ly = 1; ly < H - 1; ly++) for (let lx = 1; lx < W - 1; lx++) if (!out[ly * W + lx]) filled.push((ly + Y0) * w + lx + X0);
    C.filled = filled; C.fa = filled.length;
  }
  const isGood = (C) => C.filled && C.fa >= A * 0.0003 && C.fa <= A * 0.035 && C.fa / (C.bw * C.bh) >= 0.5
    && Math.max(C.bw, C.bh) / Math.min(C.bw, C.bh) <= 1.9;
  const good = [];
  for (const C of cands) {
    if (!C.filled) continue;
    if (isGood(C)) { good.push(C); continue; }
    // A cluster of touching buttons (a D-pad, a face-button diamond): split it by the holes its outlines enclose.
    const inHole = new Set(C.filled.filter((p) => cl[p] !== C.id));
    const seen = new Set();
    for (const h0 of inHole) {
      if (seen.has(h0)) continue;
      const comp = [h0], st = [h0]; seen.add(h0);
      while (st.length) {
        const p = st.pop(), x = p % w;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (inHole.has(q) && !seen.has(q)) { seen.add(q); comp.push(q); st.push(q); }
      }
      if (comp.length < A * 0.00008) continue;
      // grow back over the outline ring (~2px) that surrounds this hole
      let foot = new Set(comp);
      for (let g = 0; g < 2; g++) {
        const add = [];
        for (const p of foot) { const x = p % w; for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (q >= 0 && cl[q] === C.id && !foot.has(q)) add.push(q); }
        for (const q of add) foot.add(q);
      }
      const arr = [...foot];
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (const p of arr) { const x = p % w, y = (p / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const S = { filled: arr, fa: arr.length, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
      if (isGood(S)) good.push(S);
    }
  }
  good.sort((p, q) => q.fa - p.fa);
  const featId = new Int32Array(N); const feats = [null];
  for (const C of good) {
    if (C.filled.some((p) => featId[p])) continue;
    const id = feats.length;
    for (const p of C.filled) featId[p] = id;
    const diam = Math.sqrt((4 * C.fa) / Math.PI);
    feats.push({ diam, H: Math.min(diam * kA * 0.36, D * 0.7) * strength, rb: Math.max(1.2, diam * 0.16) });
  }

  // Regularize each feature: blur its footprint and re-threshold, so caps come out round and clean
  // instead of following JPEG-noisy outlines.
  const footprint = new Map();
  for (let i = 0; i < N; i++) if (featId[i]) { const f = featId[i]; if (!footprint.has(f)) footprint.set(f, []); footprint.get(f).push(i); }
  for (const [f, pxs] of footprint) {
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (const p of pxs) { const x = p % w, y = (p / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const r = Math.max(1, Math.round(feats[f].diam * 0.12)), m = r + 2;
    const X0 = Math.max(0, x0 - m), Y0 = Math.max(0, y0 - m), W = Math.min(w, x1 + m + 1) - X0, H = Math.min(h, y1 + m + 1) - Y0;
    const loc = new Float32Array(W * H);
    for (const p of pxs) loc[((p / w) | 0) * 0 + (((p / w) | 0) - Y0) * W + (p % w) - X0] = 1;
    const bl = boxBlur(boxBlur(loc, W, H, r), W, H, r);
    for (let ly = 0; ly < H; ly++) for (let lx = 0; lx < W; lx++) {
      const i = (ly + Y0) * w + lx + X0;
      if (bl[ly * W + lx] >= 0.5 && mask[i] && (!featId[i] || featId[i] === f)) featId[i] = f;
      else if (featId[i] === f) featId[i] = 0;
    }
  }

  // Height field.
  const raise = D * 0.14 * strength;          // bezel height around a recessed screen
  const dScr = screen ? distanceField(scrOn, w, h) : null;
  const fOn = new Uint8Array(N); for (let i = 0; i < N; i++) fOn[i] = featId[i] ? 1 : 0;
  const dFeat = distanceField(fOn, w, h);
  const scrRamp = Math.max(1.5, w * 0.004);

  let height = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (!mask[i]) continue;
    const rim = smooth(insetPx, insetPx + rimPx, dMask[i]);
    let z = screen ? raise * (1 - smooth(0, scrRamp, dScr[i])) : 0;
    const f = featId[i];
    if (!f && grad[i] > Tseam && !(dScr && dScr[i] > 0)) z -= raise * 0.35 * Math.min(1, (grad[i] - Tseam) / (2 * Tseam)); // seams
    z *= rim;
    if (f) z += feats[f].H * smooth(0, feats[f].rb, dFeat[i]) * smooth(insetPx, insetPx + 3, dMask[i]);
    height[i] = z;
  }
  height = boxBlur(height, w, h, 1);

  // Cavity shading: darker where the surroundings stand higher than the point.
  const wide = boxBlur(boxBlur(height, w, h, Math.round(w * 0.012) + 1), w, h, Math.round(w * 0.012) + 1);
  const ao = new Float32Array(N);
  const aoScale = Math.max(1e-5, D * 0.12);
  for (let i = 0; i < N; i++) ao[i] = 1 - 0.5 * Math.min(1, Math.max(0, wide[i] - height[i]) / aoScale);

  return { w, h, a, height, ao, dMask, insetPx, features: feats.length - 1, screen: !!screen };
}


/*
 * Relief from a spec: shapes measured off the image (in its own pixel units) with a profile each.
 *   { "size": [W, H], "shapes": [
 *       { "kind": "rect",   "x": 103, "y": 30, "w": 380, "h": 207, "r": 3, "profile": "recess", "height": 0.12 },
 *       { "kind": "circle", "cx": 65, "cy": 77, "r": 14, "profile": "stick", "height": 0.75 },
 *       { "kind": "pill",   "x": 79, "y": 46, "w": 12, "h": 3, "profile": "button", "height": 0.1 },
 *       { "kind": "line",   "x1": 98, "y1": 22, "x2": 98, "y2": 243, "width": 1.5, "profile": "groove", "height": 0.08 } ] }
 * height is a fraction of the object's thickness. Profiles: plateau, pillow, button, dome, stick, recess, groove.
 * Optional per shape: "edge" (px) — width of the shoulder.
 */
// Rasterize a relief spec into a height field (world units) of size w×h; spec coordinates are in
// source-image pixels of an image whose size is spec.size (or srcW×srcH).
function rasterizeSpec(spec, w, h, srcW, srcH, D, strength) {
  const [SW, SH] = spec.size || [srcW, srcH];
  const sx = w / SW, sy = h / SH, ss = (sx + sy) / 2;   // spec px → field px
  const height = new Float32Array(w * h);
  for (const S of spec.shapes || []) {
    const H = (S.height ?? 0.2) * D * strength * (S.profile === 'recess' || S.profile === 'groove' ? -1 : 1);
    let x0, y0, x1, y1, sdf, inr;
    if (S.kind === 'circle') {
      const cx = S.cx * sx, cy = S.cy * sy, r = S.r * ss; inr = r;
      x0 = cx - r; x1 = cx + r; y0 = cy - r; y1 = cy + r;
      sdf = (x, y) => r - Math.hypot(x - cx, y - cy);
    } else if (S.kind === 'line') {
      const ax = S.x1 * sx, ay = S.y1 * sy, bx = S.x2 * sx, by = S.y2 * sy, hw = (S.width ?? 1.5) * ss / 2; inr = hw;
      x0 = Math.min(ax, bx) - hw; x1 = Math.max(ax, bx) + hw; y0 = Math.min(ay, by) - hw; y1 = Math.max(ay, by) + hw;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      sdf = (x, y) => { const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)); return hw - Math.hypot(x - ax - t * dx, y - ay - t * dy); };
    } else { // rect / pill
      const cx = (S.x + S.w / 2) * sx, cy = (S.y + S.h / 2) * sy, hx = (S.w / 2) * sx, hy = (S.h / 2) * sy;
      const rr = S.kind === 'pill' ? Math.min(hx, hy) : Math.min(hx, hy, (S.r ?? 0) * ss); inr = Math.min(hx, hy);
      x0 = cx - hx; x1 = cx + hx; y0 = cy - hy; y1 = cy + hy;
      sdf = (x, y) => {
        const qx = Math.abs(x - cx) - (hx - rr), qy = Math.abs(y - cy) - (hy - rr);
        return -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr);
      };
    }
    const edge = S.edge != null ? S.edge * ss : null;
    const prof = S.profile || 'plateau';
    const X0 = Math.max(0, Math.floor(x0) - 1), X1 = Math.min(w - 1, Math.ceil(x1) + 1);
    const Y0 = Math.max(0, Math.floor(y0) - 1), Y1 = Math.min(h - 1, Math.ceil(y1) + 1);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const d = sdf(x + 0.5, y + 0.5);
      if (d <= -1) continue;
      const t = Math.min(1, Math.max(0, d / inr));            // 0 at the outline, 1 at the center
      let z;
      switch (prof) {
        case 'button': z = smooth(-0.6, edge ?? Math.max(1.2, inr * 0.32), d) * (0.88 + 0.12 * Math.sqrt(t)); break;
        case 'dome':   z = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))) * smooth(-0.6, 0.8, d); break;
        case 'stick':  z = smooth(-0.6, edge ?? Math.max(1.5, inr * 0.22), d) - 0.16 * t * t; break;
        case 'pillow': z = Math.sqrt(smooth(-0.6, edge ?? inr * 0.6, d)); break;
        case 'groove': z = smooth(-0.8, edge ?? inr, d); break;
        default:       z = smooth(-0.6, edge ?? Math.max(1.2, inr * 0.08), d);   // plateau, recess
      }
      height[y * w + x] += H * z;
    }
  }

  return height;
}

function fieldAO(height, w, h, D) {
  const r = Math.round(w * 0.01) + 1;
  const wide = boxBlur(boxBlur(height, w, h, r), w, h, r);
  const ao = new Float32Array(w * h), aoScale = Math.max(1e-5, D * 0.12);
  for (let i = 0; i < w * h; i++) ao[i] = 1 - 0.5 * Math.min(1, Math.max(0, Math.abs(wide[i]) - Math.abs(height[i])) / aoScale);
  return ao;
}

function reliefFromSpec(spec, prep, geoInfo, { strength = 1, maxRes = 720 } = {}) {
  const a = Math.min(1, maxRes / prep.w);
  const w = Math.max(8, Math.round(prep.w * a)), h = Math.max(8, Math.round(prep.h * a));
  const N = w * h;
  const mask = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    mask[y * w + x] = prep.mask[Math.min(prep.h - 1, Math.round(y / a)) * prep.w + Math.min(prep.w - 1, Math.round(x / a))];
  const D = geoInfo.D, kA = geoInfo.k / a;
  const dMask = distanceField(mask, w, h);
  const insetPx = geoInfo.bevel / kA + 1;
  let height = rasterizeSpec(spec, w, h, prep.srcW, prep.srcH, D, strength);

  // Ease to zero where the surface meets the rounded edge, so it joins the bevel without a step.
  for (let i = 0; i < N; i++) height[i] = mask[i] ? height[i] * smooth(insetPx, insetPx + 3, dMask[i]) : 0;
  height = boxBlur(height, w, h, 1);
  return { w, h, a, height, ao: fieldAO(height, w, h, D), dMask, insetPx, features: (spec.shapes || []).length, screen: true };
}

// Robust silhouette extents: left/right measured across the middle rows, top/bottom across the
// middle columns, so corner bumps (triggers, camera humps) don't skew the fit.
function silhouetteExtents(mask, w, h) {
  let X0 = w, X1 = 0, Y0 = h, Y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < X0) X0 = x; if (x > X1) X1 = x; if (y < Y0) Y0 = y; if (y > Y1) Y1 = y; }
  const med = (arr) => { arr.sort((p, q) => p - q); return arr.length ? arr[arr.length >> 1] : 0; };
  const ls = [], rs = [], ts = [], bs = [];
  for (let y = Math.round(Y0 + (Y1 - Y0) * 0.3); y <= Y0 + (Y1 - Y0) * 0.7; y++) {
    let l = -1, r = -1; for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (l < 0) l = x; r = x; }
    if (l >= 0) { ls.push(l); rs.push(r + 1); }
  }
  for (let x = Math.round(X0 + (X1 - X0) * 0.3); x <= X0 + (X1 - X0) * 0.7; x++) {
    let t = -1, b = -1; for (let y = 0; y < h; y++) if (mask[y * w + x]) { if (t < 0) t = y; b = y; }
    if (t >= 0) { ts.push(t); bs.push(b + 1); }
  }
  return { x0: med(ls), x1: med(rs), y0: med(ts), y1: med(bs) };
}

// Maps a point on the front image to the matching point on the back image (mirrored left–right),
// fitting the two silhouettes so a back shot with different framing or scale still lines up.
function makeBackMapper(prep, bp) {
  const f = silhouetteExtents(prep.mask, prep.w, prep.h), b = silhouetteExtents(bp.mask, bp.w, bp.h);
  const sx = (b.x1 - b.x0) / Math.max(1, f.x1 - f.x0), sy = (b.y1 - b.y0) / Math.max(1, f.y1 - f.y0);
  return (ix, iy) => [b.x1 - (ix - f.x0) * sx, b.y0 + (iy - f.y0) * sy];
}

// Dense displaced surface laid over a flat cap (which stays underneath to seal the rim).
// The grid and its boundary come from the front silhouette; heights, shading and UVs come from `src`,
// which can sample the front's own field or a back image's field through a mapper.
//   src = { height, ao, w, h, toField(ix, iy) → [fx, fy], uvOf(ix, iy) → [u, v], side: 'front' | 'back' }
function buildReliefGeometry(relief, prep, geoInfo, src) {
  const { w, h, a, dMask, insetPx } = relief;
  const { k, cx, cy, D } = geoInfo;
  src = src || {
    height: relief.height, ao: relief.ao, w, h, side: 'front',
    toField: (ix, iy) => [ix * a, iy * a], uvOf: (ix, iy) => [ix / prep.w, 1 - iy / prep.h],
  };
  const back = src.side === 'back';
  const step = Math.max(1, w / 460);
  const cols = Math.floor((w - 1) / step) + 1, rows = Math.floor((h - 1) / step) + 1;
  const sampler = (W, H) => (arr, x, y) => {
    x = Math.min(W - 1.001, Math.max(0, x)); y = Math.min(H - 1.001, Math.max(0, y));
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * W + x0;
    return (arr[i] * (1 - fx) + arr[i + 1] * fx) * (1 - fy) + (arr[i + W] * (1 - fx) + arr[i + W + 1] * fx) * fy;
  };
  const sample = sampler(w, h), sampleSrc = sampler(src.w, src.h);
  const pos = new Float32Array(cols * rows * 3), uv = new Float32Array(cols * rows * 2), col = new Float32Array(cols * rows * 3);
  const keep = new Uint8Array(cols * rows);
  const band = Math.max(0.6, insetPx - step * 2.5);
  let minZ = 0, maxZ = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = r * cols + c;
    let ax = c * step, ay = r * step;
    const dm = sample(dMask, ax, ay);
    keep[v] = dm > band ? 1 : 0;
    // Vertices between the band and the bevel slide inward onto the bevel's top edge.
    if (keep[v] && dm < insetPx) {
      for (let it = 0; it < 3; it++) {
        const e = 0.75, d0 = sample(dMask, ax, ay);
        const gx = sample(dMask, ax + e, ay) - sample(dMask, ax - e, ay);
        const gy = sample(dMask, ax, ay + e) - sample(dMask, ax, ay - e);
        const gl = Math.hypot(gx, gy) / (2 * e) || 1;
        const delta = (insetPx - d0) / gl;
        ax = Math.min(w - 1.01, Math.max(0, ax + (gx / (2 * e)) / gl * delta));
        ay = Math.min(h - 1.01, Math.max(0, ay + (gy / (2 * e)) / gl * delta));
      }
    }
    const ix = ax / a, iy = ay / a;
    const [fx, fy] = src.toField(ix, iy);
    const rim = smooth(insetPx, insetPx + 3, sample(dMask, ax, ay));
    const z = dm < insetPx ? 0 : sampleSrc(src.height, fx, fy) * rim;
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    pos[v * 3] = (ix - cx) * k; pos[v * 3 + 1] = (cy - iy) * k; pos[v * 3 + 2] = back ? -D / 2 - z : D / 2 + z;
    const [u, vv] = src.uvOf(ix, iy); uv[v * 2] = u; uv[v * 2 + 1] = vv;
    const o = sampleSrc(src.ao, fx, fy); col[v * 3] = col[v * 3 + 1] = col[v * 3 + 2] = o;
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const v = r * cols + c;
    if (!(keep[v] && keep[v + 1] && keep[v + cols] && keep[v + cols + 1])) continue;
    if (back) idx.push(v, v + 1, v + cols, v + 1, v + cols + 1, v + cols);
    else idx.push(v, v + cols, v + 1, v + 1, v + cols, v + cols + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.minZ = minZ; g.userData.maxZ = maxZ;
  return g;
}

/* ------------------------------------------------------------------ */
/* Studio environment (no external HDR needed)                         */
/* ------------------------------------------------------------------ */

function studioEnvironment(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x1b1c20, side: THREE.BackSide })));
  const panel = (w, h, i, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(7, 1.1, 7, [0, 5, 1.5]);     // overhead strip softbox
  panel(1.2, 6, 4, [-5, 0.6, 2.5]);  // left strip
  panel(1.2, 6, 2.2, [5, 0.4, -1]);  // right rim
  panel(5, 3, 0.9, [1.5, 0.5, 5.5]); // broad front fill
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.035).texture;
  pm.dispose();
  return tex;
}

/* ------------------------------------------------------------------ */
/* The element                                                          */
/* ------------------------------------------------------------------ */

const TEMPLATE = `
<style>
  :host { display:block; position:relative; aspect-ratio: 16 / 10; min-height: 220px; outline:none;
          touch-action: pan-y; -webkit-tap-highlight-color: transparent; cursor: pointer; user-select:none; }
  :host([data-mode="active"]) { cursor: grab; touch-action: none; }
  :host([data-dragging]) { cursor: grabbing; }
  canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
  .hint { position:absolute; left:50%; bottom:14px; transform:translateX(-50%); display:flex; align-items:center; gap:8px;
          padding:7px 12px 7px 10px; border-radius:999px; font: 500 12px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing:.02em;
          color: var(--iso-hint-fg, #f4f5f7); background: var(--iso-hint-bg, rgba(20,22,26,.72));
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); pointer-events:none; white-space:nowrap;
          transition: opacity .35s ease, transform .35s ease; }
  .hint svg { width:14px; height:14px; flex:none; }
  :host([data-dragging]) .hint, :host([no-hint]) .hint { opacity:0; transform:translate(-50%, 6px); }
  :host(:focus-visible) { box-shadow: 0 0 0 2px var(--iso-focus, #3bb3d6); border-radius: 12px; }
  .status { position:absolute; inset:0; display:grid; place-items:center; font:13px ui-sans-serif, system-ui; color: var(--iso-hint-bg, #888); }
</style>
<canvas aria-hidden="true"></canvas>
<div class="hint" part="hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg><span>Click to spin</span></div>
<div class="status" hidden></div>`;

class IsoObject extends HTMLElement {
  static get observedAttributes() { return ['src', 'back', 'depth', 'bevel', 'relief', 'relief-spec', 'back-relief-spec', 'tolerance', 'body', 'gloss', 'grid', 'no-shadow']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = TEMPLATE;
    this._canvas = this.shadowRoot.querySelector('canvas');
    this._hint = this.shadowRoot.querySelector('.hint span');
    this._status = this.shadowRoot.querySelector('.status');
    this._yaw = 0; this._pitch = 0; this._vel = 0;
    this._mode = 'idle';
    this._t = 0; this._lastInput = 0;
    this._visible = true;
    this._reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  num(name, fallback) { const v = parseFloat(this.getAttribute(name)); return Number.isFinite(v) ? v : fallback; }

  connectedCallback() {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    if (this.hasAttribute('hint-idle')) this._hint.textContent = this.getAttribute('hint-idle');
    this.setAttribute('role', 'img');
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Interactive 3D object. Press Enter to spin, arrow keys to rotate.');
    this._initRenderer();
    this._bindInput();
    this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(this);
    this._io = new IntersectionObserver(([e]) => { this._visible = e.isIntersecting; }, { rootMargin: '100px' }); this._io.observe(this);
    this._clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._frame());
    this._build();
  }

  disconnectedCallback() {
    this.renderer?.setAnimationLoop(null);
    this._ro?.disconnect(); this._io?.disconnect();
    this._disposeObject();
    this.renderer?.dispose();
    this.renderer = null;
  }

  attributeChangedCallback(name, oldV, newV) {
    if (!this.renderer || oldV === newV) return;
    if (name === 'grid') { if (this._grid) this._grid.visible = this.hasAttribute('grid'); return; }
    if (name === 'no-shadow') { if (this._floor) this._floor.visible = !this.hasAttribute('no-shadow'); return; }
    clearTimeout(this._rebuildTimer); this._rebuildTimer = setTimeout(() => this._build(), 30);
  }

  /* ---------- scene ---------- */

  _initRenderer() {
    const renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    scene.environmentIntensity = 0.9;
    this.scene = scene;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-1.2, 8, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 14; key.shadow.blurSamples = 20; key.shadow.bias = -0.0005;
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    scene.add(key);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404048, 0.35));
    const fill = new THREE.DirectionalLight(0xffffff, 0.9);   // soft fill from behind so the back reads when spun
    fill.position.set(1.5, 3, -4);
    scene.add(fill);

    this.pivot = new THREE.Group();   // yaw/pitch
    this.bob = new THREE.Group();     // idle float
    this.bob.add(this.pivot);
    scene.add(this.bob);

    // Floor: soft shadow catcher + optional isometric grid.
    this._floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.28, transparent: true }));
    this._floor.rotation.x = -Math.PI / 2; this._floor.receiveShadow = true;
    scene.add(this._floor);

    this._gridUniforms = { uColor: { value: new THREE.Color('#8a93a3') }, uOpacity: { value: 0.5 }, uCell: { value: 0.25 }, uRadius: { value: 3 } };
    this._grid = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this._gridUniforms,
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vP; uniform vec3 uColor; uniform float uOpacity; uniform float uCell; uniform float uRadius;
        void main(){
          vec2 c = vP / uCell; vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          vec2 C = vP / (uCell * 4.0); vec2 G = abs(fract(C - 0.5) - 0.5) / fwidth(C);
          float major = 1.0 - min(min(G.x, G.y), 1.0);
          float fade = 1.0 - smoothstep(uRadius * 0.35, uRadius, length(vP));
          float a = max(line * 0.45, major) * fade * uOpacity;
          if (a < 0.002) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    }));
    this._grid.rotation.x = -Math.PI / 2;
    this._grid.renderOrder = -1;
    this._grid.visible = this.hasAttribute('grid');
    scene.add(this._grid);
    this._floor.visible = !this.hasAttribute('no-shadow');
  }

  _disposeObject() {
    if (!this.mesh) return;
    this.pivot.remove(this.mesh);
    this.mesh.geometry.dispose();
    for (const m of this.mesh.material) { m.map?.dispose(); m.dispose(); }
    for (const c of this.mesh.children) { c.geometry.dispose(); c.material.dispose(); }
    this.mesh = null;
  }

  async _build() {
    const src = this.getAttribute('src');
    if (!src) return;
    const token = (this._buildToken = {});
    try {
      const img = await loadImage(src);
      const spec = await this._loadReliefSpec('front');
      const backImg = this.getAttribute('back') ? await loadImage(this.getAttribute('back')) : null;
      const backSpec = backImg ? await this._loadReliefSpec('back') : null;
      if (token !== this._buildToken || !this.renderer) return;

      const prep = prepareImage(img, { tolerance: this.num('tolerance', 28) });
      let outline = traceOutline(prep.mask, prep.w, prep.h);
      if (outline.length < 8) throw new Error('Could not find an object in the image.');
      outline = chaikin(simplify(outline, Math.max(1, prep.w / 480)), 3);

      const geo = buildGeometry(outline, prep.w, prep.h, {
        depthRatio: this.num('depth', 0.06),
        bevelRatio: Math.min(0.49, Math.max(0, this.num('bevel', 0.35))),
      });

      const aniso = this.renderer.capabilities.getMaxAnisotropy();
      const tex = new THREE.CanvasTexture(prep.canvas);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;

      const bodyAttr = this.getAttribute('body');
      const bodyColor = bodyAttr ? new THREE.Color(bodyAttr)
        : new THREE.Color().setRGB(prep.body[0] / 255, prep.body[1] / 255, prep.body[2] / 255, THREE.SRGBColorSpace);
      const gloss = Math.min(1, Math.max(0, this.num('gloss', 0.6)));

      const frontMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, metalness: 0, clearcoat: gloss, clearcoatRoughness: 0.06 });
      let backMat, bp = null, mapBack = null;
      if (backImg) {
        bp = prepareImage(backImg, { tolerance: this.num('tolerance', 28) });
        mapBack = makeBackMapper(prep, bp);
        // The back cap samples the back image through the silhouette fit (uv1).
        const gp = geo.attributes.position, gi = geo.userData, uvB = geo.attributes.uv1;
        for (let i = 0; i < gp.count; i++) {
          const [bx, by] = mapBack(gp.getX(i) / gi.k + gi.cx, gi.cy - gp.getY(i) / gi.k);
          uvB.setXY(i, bx / bp.w, 1 - by / bp.h);
        }
        uvB.needsUpdate = true;
        const bt = new THREE.CanvasTexture(bp.canvas);
        bt.colorSpace = THREE.SRGBColorSpace; bt.anisotropy = aniso; bt.channel = 1;
        backMat = new THREE.MeshPhysicalMaterial({ map: bt, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.2 });
      } else {
        backMat = new THREE.MeshPhysicalMaterial({ color: bodyColor, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.25, sheen: 0.4, sheenRoughness: 0.6, sheenColor: bodyColor.clone().offsetHSL(0, 0, 0.15) });
      }
      // Edges sample a softened copy of the photo so small front details don't streak across the rim.
      const soft = document.createElement('canvas');
      const sw = Math.max(8, Math.round(prep.w / 18)), sh = Math.max(8, Math.round(prep.h / 18));
      soft.width = sw; soft.height = sh;
      const sctx = soft.getContext('2d'); sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(prep.canvas, 0, 0, sw, sh);
      const sideTex = new THREE.CanvasTexture(soft);
      sideTex.colorSpace = THREE.SRGBColorSpace;
      const sideMat = new THREE.MeshPhysicalMaterial({ map: sideTex, roughness: 0.48, clearcoat: 0.45, clearcoatRoughness: 0.18 });

      this._disposeObject();
      this.mesh = new THREE.Mesh(geo, [frontMat, backMat, sideMat]);
      this.mesh.castShadow = true;
      this.pivot.add(this.mesh);
      // Start exactly at the resting pose (no spring-in), so a page can hand off from a
      // still render of this pose without a visible jump.
      if (!this._posed) {
        this._posed = true;
        this._yaw = this.num('yaw', 22) * DEG; this._pitch = 0; this._t = 0;
        this._clock?.getDelta();
      }

      // Relief: the front surface rises and recesses where the photo shows buttons, sticks and a screen.
      const reliefStrength = Math.max(0, this.num('relief', 1));
      if (reliefStrength > 0) {
        const relief = spec ? reliefFromSpec(spec, prep, geo.userData, { strength: reliefStrength })
                            : analyzeRelief(prep, geo.userData, { strength: reliefStrength });
        const rg = buildReliefGeometry(relief, prep, geo.userData);
        const reliefMat = frontMat.clone();
        reliefMat.vertexColors = true;
        const surf = new THREE.Mesh(rg, reliefMat);
        surf.castShadow = true;
        this.mesh.add(surf);
        // The flat cap stays underneath as a seal; push it behind the deepest recess so it never covers one.
        const capShift = rg.userData.minZ - geo.userData.D * 0.02;
        const gp = geo.attributes.position;
        const capIdx = geo.index.array, nFront = geo.groups[0].count, moved = new Set();
        for (let j = 0; j < nFront; j++) moved.add(capIdx[j]);
        for (const i of moved) gp.setZ(i, gp.getZ(i) + capShift);
        gp.needsUpdate = true;
        this._reliefInfo = { features: relief.features, screen: relief.screen, back: 0 };
        this._relief = relief;

        // Back relief: the same grid, sculpted from the back spec and textured with the back image.
        if (bp && backSpec) {
          const ab = Math.min(1, 720 / bp.w);
          const bw = Math.max(8, Math.round(bp.w * ab)), bh = Math.max(8, Math.round(bp.h * ab));
          const bh0 = boxBlur(rasterizeSpec(backSpec, bw, bh, bp.srcW, bp.srcH, geo.userData.D, reliefStrength), bw, bh, 1);
          const brg = buildReliefGeometry(relief, prep, geo.userData, {
            height: bh0, ao: fieldAO(bh0, bw, bh, geo.userData.D), w: bw, h: bh, side: 'back',
            toField: (ix, iy) => { const [x, y] = mapBack(ix, iy); return [x * ab, y * ab]; },
            uvOf: (ix, iy) => { const [x, y] = mapBack(ix, iy); return [x / bp.w, 1 - y / bp.h]; },
          });
          const backReliefMat = backMat.clone();
          backReliefMat.map = backMat.map; backReliefMat.map.channel = 0;
          backReliefMat.vertexColors = true;
          const bsurf = new THREE.Mesh(brg, backReliefMat);
          bsurf.castShadow = true;
          this.mesh.add(bsurf);
          // Keep the back texture on channel 1 for the flat back cap; the relief mesh uses its own uv.
          const capTex = backMat.map.clone(); capTex.channel = 1; capTex.needsUpdate = true; backMat.map = capTex;
          const shiftB = Math.max(0, -brg.userData.minZ) + geo.userData.D * 0.02;
          const gp2 = geo.attributes.position, idx2 = geo.index.array, g1 = geo.groups[1], movedB = new Set();
          for (let j = g1.start; j < g1.start + g1.count; j++) movedB.add(idx2[j]);
          for (const i of movedB) gp2.setZ(i, gp2.getZ(i) + shiftB);
          gp2.needsUpdate = true;
          this._reliefInfo.back = (backSpec.shapes || []).length;
        }
        this._sheenTargets = [frontMat, reliefMat];
      } else {
        this._sheenTargets = [frontMat];
        this._reliefInfo = null;
      }

      // Glass sheen: a soft diagonal highlight on the front face that sweeps as the object turns.
      // (A flat face under an orthographic camera reflects one direction only, so env reflections alone read flat.)
      this._sheenUniforms = { uShift: { value: 0.5 }, uSheen: { value: gloss } };
      const addSheen = (shader) => {
        Object.assign(shader.uniforms, this._sheenUniforms);
        shader.fragmentShader = 'uniform float uShift;\nuniform float uSheen;\n' + shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `{ float sx = vMapUv.x + (1.0 - vMapUv.y) * 0.42 - uShift;
             float sa = exp(-pow(sx / 0.16, 2.0)) * 0.07 + exp(-pow((sx - 0.21) / 0.035, 2.0)) * 0.045;
             gl_FragColor.rgb += vec3(sa * uSheen); }
           #include <dithering_fragment>`);
      };
      for (const m of this._sheenTargets) { m.onBeforeCompile = addSheen; m.customProgramCacheKey = () => 'iso-sheen'; m.needsUpdate = true; }

      // Layout: floor sits below the object; the camera frames object + shadow.
      const bb = geo.boundingBox;
      this._halfH = (bb.max.y - bb.min.y) / 2;
      this._radius = geo.boundingSphere.radius;
      const floorY = -(this._halfH + 0.22 * this._radius);
      this._floor.position.y = floorY;
      this._grid.position.y = floorY - 0.001;
      this._gridUniforms.uRadius.value = this._radius * 2.6;

      this._status.hidden = true;
      this._resize();
      this.dispatchEvent(new CustomEvent('iso-ready', { detail: { body: '#' + bodyColor.getHexString(THREE.SRGBColorSpace), reliefFeatures: this._reliefInfo?.features ?? 0, backFeatures: this._reliefInfo?.back ?? 0, hasBack: !!bp, reliefSource: spec ? 'spec' : 'auto' } }));
    } catch (err) {
      console.error('[iso-object]', err);
      this._status.hidden = false;
      this._status.textContent = 'Could not load this image.';
    }
  }

  // A relief spec comes from relief-spec / back-relief-spec="file.json", or a child
  // <script type="application/json" data-relief> (front) / data-relief="back".
  async _loadReliefSpec(side = 'front') {
    const inline = side === 'back'
      ? this.querySelector('script[type="application/json"][data-relief="back"]')
      : this.querySelector('script[type="application/json"][data-relief]:not([data-relief="back"])');
    try {
      if (inline) return JSON.parse(inline.textContent);
      const url = this.getAttribute(side === 'back' ? 'back-relief-spec' : 'relief-spec');
      if (url) return await (await fetch(url)).json();
    } catch (err) { console.warn('[iso-object] relief spec ignored:', err); }
    return null;
  }

  _resize() {
    if (!this.renderer) return;
    const w = this.clientWidth || 1, h = this.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this._frameCamera(w, h);
    this.renderer.toneMappingExposure = this.num('exposure', 1.05);
    const css = getComputedStyle(this);
    const gc = css.getPropertyValue('--iso-grid-color').trim();
    if (gc) this._gridUniforms.uColor.value.set(gc);
    const so = parseFloat(css.getPropertyValue('--iso-shadow-opacity'));
    if (Number.isFinite(so)) this._floor.material.opacity = so;
  }

  _frameCamera(w, h) {
    const r = this._radius || 1.2;
    const aspect = w / h;
    const half = Math.max(r * 1.0, (r * 1.28) / aspect) / Math.max(0.3, this.num('fit', 1));
    const cam = this.camera;
    cam.left = -half * aspect; cam.right = half * aspect; cam.top = half; cam.bottom = -half;
    const el = this.num('elevation', 30) * DEG, az = this.num('azimuth', 45) * DEG;
    const target = new THREE.Vector3(0, -(this._halfH || 0.5) * 0.28, 0);
    cam.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(20).add(target);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }

  /* ---------- pose + export ---------- */

  /** Hold the object at a yaw/pitch (degrees) until the viewer moves it or it is reset. */
  setPose(yawDeg, pitchDeg = 0) {
    this._vel = 0;
    this._yaw = yawDeg * DEG;
    this._pitch = Math.max(-0.6, Math.min(0.6, pitchDeg * DEG));
    this._hold = true;
    this._setMode('active');
  }

  /** Current pose in degrees: yaw 0–360, pitch (positive tilts the top toward the viewer). */
  getPose() {
    return { yaw: ((this._yaw / DEG) % 360 + 360) % 360, pitch: this._pitch / DEG };
  }

  /**
   * Render the object at a pose to a PNG with a transparent background.
   *   exportPNG({ yaw, pitch, width = 2400, height = 1500, shadow = true, grid = false }) → Promise<Blob>
   * yaw/pitch default to the current pose. Size is in pixels (capped at 4096 per side); the
   * framing matches what the element shows at that aspect ratio. The on-screen view is untouched.
   */
  async exportPNG({ yaw, pitch, width = 2400, height = 1500, shadow = true, grid = false } = {}) {
    if (!this.mesh) await new Promise((ok) => this.addEventListener('iso-ready', ok, { once: true }));
    const R = this.renderer, cap = Math.min(4096, R.capabilities.maxTextureSize || 4096);
    const W = Math.max(16, Math.min(cap, Math.round(width))), H = Math.max(16, Math.min(cap, Math.round(height)));
    const pose = this.getPose();
    const y = (yaw ?? pose.yaw) * DEG, p = Math.max(-0.6, Math.min(0.6, (pitch ?? pose.pitch) * DEG));
    const saved = {
      ratio: R.getPixelRatio(), rot: this.pivot.rotation.clone(), bob: this.bob.position.y,
      floor: this._floor.visible, grid: this._grid.visible, shift: this._sheenUniforms?.uShift.value,
    };
    try {
      R.setPixelRatio(1);
      R.setSize(W, H, false);
      this._frameCamera(W, H);
      this.pivot.rotation.set(p, y, 0, 'YXZ');
      this.bob.position.y = 0;
      this._floor.visible = shadow;
      this._grid.visible = grid;
      if (this._sheenUniforms) this._sheenUniforms.uShift.value = 0.18 + (y - this.num('yaw', 22) * DEG) * 0.55 + p * 0.3;
      R.render(this.scene, this.camera);
      // toBlob snapshots the drawing buffer synchronously, before the browser can clear it.
      const blob = await new Promise((ok, no) => R.domElement.toBlob((b) => (b ? ok(b) : no(new Error('PNG encoding failed'))), 'image/png'));
      return blob;
    } finally {
      R.setPixelRatio(saved.ratio);
      this.pivot.rotation.copy(saved.rot);
      this.bob.position.y = saved.bob;
      this._floor.visible = saved.floor;
      this._grid.visible = saved.grid;
      if (this._sheenUniforms) this._sheenUniforms.uShift.value = saved.shift;
      this._resize();
      R.render(this.scene, this.camera);
    }
  }

  /* ---------- interaction ---------- */

  _setMode(mode) {
    if (this._mode === mode) return;
    this._mode = mode;
    this.dataset.mode = mode;
    this._hint.textContent = mode === 'idle'
      ? (this.getAttribute('hint-idle') || 'Click to spin')
      : (this.getAttribute('hint-active') || 'Drag to rotate · Esc to reset');
    this.dispatchEvent(new CustomEvent('iso-mode', { detail: { mode } }));
  }

  spin() {
    this._spinFrom = this._yaw; this._spinT = 0; this._vel = 0;
    this._hold = false;
    this._lastInput = this._t;
    if (this._reduced) { this._setMode('active'); return; }
    this._setMode('spin');
  }

  reset() { this._vel = 0; this._hold = false; this._setMode('idle'); }

  _bindInput() {
    let down = null, last = null;
    this.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, type: e.pointerType };
      last = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    this.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      if (!down.moved) {
        const tx = e.clientX - down.x, ty = e.clientY - down.y;
        if (Math.hypot(tx, ty) < 5) return;
        // On touch in idle mode, let vertical swipes scroll the page.
        if (down.type === 'touch' && this._mode === 'idle' && Math.abs(ty) > Math.abs(tx)) { down = null; return; }
        down.moved = true;
        this.setPointerCapture(e.pointerId);
        this.dataset.dragging = '';
        if (this._mode !== 'active') { this._setMode('active'); }
      }
      const now = performance.now(), dt = Math.max(1, now - last.t) / 1000;
      const s = 4.2 / Math.max(240, this.clientWidth);
      this._yaw += dx * s;
      this._pitch = Math.max(-0.6, Math.min(0.6, this._pitch + dy * s * 0.7));
      this._vel = this._vel * 0.6 + ((dx * s) / dt) * 0.4;
      last = { x: e.clientX, y: e.clientY, t: now };
      this._lastInput = this._t;
      this._hold = false;
    });
    const end = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const wasDrag = down.moved;
      delete this.dataset.dragging;
      if (performance.now() - last.t > 80) this._vel = 0;
      down = null;
      if (!wasDrag && e.type === 'pointerup') { if (this._mode === 'idle') this.spin(); else this._lastInput = this._t; }
    };
    this.addEventListener('pointerup', end);
    this.addEventListener('pointercancel', end);
    this.addEventListener('dblclick', () => this.reset());
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.spin(); }
      else if (e.key === 'Escape') this.reset();
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        if (this._mode !== 'active') this._setMode('active');
        if (e.key === 'ArrowLeft') this._vel -= 2.2;
        if (e.key === 'ArrowRight') this._vel += 2.2;
        if (e.key === 'ArrowUp') this._pitch = Math.max(-0.6, this._pitch - 0.12);
        if (e.key === 'ArrowDown') this._pitch = Math.min(0.6, this._pitch + 0.12);
        this._lastInput = this._t;
      }
    });
  }

  /* ---------- loop ---------- */

  _frame() {
    if (!this._visible || !this.mesh) return;
    const dt = Math.min(0.05, this._clock.getDelta());
    this._t += dt;
    const t = this._t;
    const base = this.num('yaw', 22) * DEG;
    const still = this._reduced;

    if (this._mode === 'idle') {
      const target = base + (still ? 0 : Math.sin(t * 0.5) * 0.16);
      this._yaw -= TAU * Math.round((this._yaw - target) / TAU);
      const k = 1 - Math.exp(-dt * 3.2);
      this._yaw += (target - this._yaw) * k;
      this._pitch += ((still ? 0 : Math.sin(t * 0.37) * 0.035) - this._pitch) * k;
    } else if (this._mode === 'spin') {
      this._spinT += dt / 1.5;
      const e = easeInOut(Math.min(1, this._spinT));
      this._yaw = this._spinFrom + TAU * e;
      this._pitch *= 1 - Math.exp(-dt * 4);
      if (this._spinT >= 1) { this._setMode('active'); this._lastInput = t; }
    } else {
      if (!('dragging' in this.dataset)) {
        this._yaw += this._vel * dt;
        this._vel *= Math.exp(-dt * 2.2);
      }
      if (!this._hold && t - this._lastInput > 7 && Math.abs(this._vel) < 0.05) this.reset();
    }

    this.pivot.rotation.set(this._pitch, this._yaw, 0, 'YXZ');
    if (this._sheenUniforms) this._sheenUniforms.uShift.value = 0.18 + (this._yaw - base) * 0.55 + this._pitch * 0.3;
    this.bob.position.y = still ? 0 : Math.sin(t * 1.1) * 0.025 * (this._radius || 1);

    if ((this._evtT = (this._evtT || 0) + dt) > 0.05) {
      this._evtT = 0;
      const y = ((this._yaw / DEG) % 360 + 360) % 360;
      this.dispatchEvent(new CustomEvent('iso-rotate', { detail: { yaw: y, pitch: this._pitch / DEG } }));
    }
    this.renderer.render(this.scene, this.camera);
  }
}

if (!customElements.get('iso-object')) customElements.define('iso-object', IsoObject);
export { IsoObject };
