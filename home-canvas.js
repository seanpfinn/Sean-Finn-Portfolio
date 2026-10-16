// ── Canvas ──────────────────────────────────────────────────────────────────
// The homepage's default layout: every project laid out on an endless field
// that drifts slowly on its own and can be dragged (or swiped, or scrolled
// sideways) in any direction. The field is a lens: the tile at the middle
// sits at full size and the ones around it ease smaller toward the edges,
// where they fade out, so there is always a project in focus.
//
// The tiles are real links with real .gallery-card-visual elements, which is
// what makes the canvas the seamless way in: page-transition.js grows the
// clicked tile straight into its project's header, and on the way back the
// field opens with that project's tile already waiting in the middle.
//
// A classic (not module) script, placed right after the stage and before
// #home-ready, which the page holds its first frame for (<link rel="expect">
// in the head). So the field exists, centered on the right tile, by the time
// the page is revealed and the transition looks for somewhere to land.
// home-layout.js switches between this and the other layouts through
// window.homeCanvas.
(function () {
  var grid  = document.getElementById('project-grid');
  var stage = document.getElementById('canvas-stage');
  var field = document.getElementById('canvas-field');
  if (!grid || !stage || !field) return;

  var cards = [].slice.call(grid.querySelectorAll('a.gallery-card'));
  var N = cards.length;
  if (!N) return;

  var MODES  = ['canvas', 'globe', 'cols3'];
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = matchMedia('(pointer: coarse)').matches;

  // Which project sits in slot (column j, row i). Neighbors in a column are
  // STEP apart and neighbors across are 1 apart, so no project ever touches
  // a copy of itself, and every column cycles through all of them.
  var STEP = N > 4 ? Math.max(2, Math.round(N * 0.38)) : 1;
  function mod(a, n) { return ((a % n) + n) % n; }
  function project(j, i) { return mod(j + i * STEP, N); }
  // Columns are staggered by the golden ratio, which never lines up into
  // rows however far the field is dragged.
  function lift(j) { var f = j * 0.6180339887; return f - Math.floor(f); }

  function page(u) {
    try {
      var p = new URL(u, location.href).pathname.split('/').pop().replace(/\.html$/, '');
      return p === '' || p === 'index' ? '/' : '/' + p;
    } catch (e) { return ''; }
  }

  // ── Geometry ──────────────────────────────────────────────────────────────
  var W = 0, H = 0, tw = 0, th = 0, cw = 0, ch = 0;
  var pan = { x: 0, y: 0 };
  function measure() {
    var r = stage.getBoundingClientRect();
    var fx = cw ? (W / 2 - pan.x) / cw : 0, fy = ch ? (H / 2 - pan.y) / ch : 0;
    W = r.width; H = r.height;
    tw = Math.round(Math.max(168, Math.min(320, W * 0.2)));
    th = tw * 9 / 16;
    cw = tw * 1.75;                    // generous air between columns
    ch = th + 30 + tw * 0.6;           // visual, caption, gap
    field.style.setProperty('--tile-w', tw + 'px');
    if (fx || fy) { pan.x = W / 2 - fx * cw; pan.y = H / 2 - fy * ch; }
  }
  // Put slot (j, 0) — project j — dead center.
  function centerOn(j) {
    pan.x = W / 2 - (j * cw + tw / 2);
    pan.y = H / 2 - (lift(j) * ch + th / 2);
  }

  // ── Tiles ─────────────────────────────────────────────────────────────────
  var live = new Map();                 // "j,i" -> tile on the field
  var spare = cards.map(function () { return []; });   // off-field, per project

  function make(p) {
    var src = cards[p];
    var a = document.createElement('a');
    a.className = 'canvas-tile';
    a.href = src.getAttribute('href');
    a.draggable = false;
    var vis = src.querySelector('.gallery-card-visual').cloneNode(true);
    var info = src.querySelector('.gallery-card-info');
    vis.querySelectorAll('video').forEach(function (v) {
      v.removeAttribute('data-play-in-view');   // this script decides what plays
      v.preload = 'none';
      v.muted = true;
    });
    a.appendChild(vis);
    if (info) a.appendChild(info.cloneNode(true));
    a.querySelectorAll('img').forEach(function (im) { im.draggable = false; });
    a._p = p;
    a._v = vis.querySelector('video');
    return a;
  }
  function take(p) { return spare[p].pop() || make(p); }
  function drop(key, el) {
    if (el.contains(document.activeElement)) return;   // a focused tile stays put
    live.delete(key);
    if (el._v && !el._v.paused) el._v.pause();
    el.remove();
    el.classList.remove('is-entering');
    spare[el._p].push(el);
    return true;
  }

  var entering = false;
  function layout() {
    var cx = W / 2, cy = H / 2, R2 = (W * W + H * H) / 4;
    var seen = new Set();
    var j0 = Math.floor((-pan.x - cw) / cw), j1 = Math.ceil((W - pan.x) / cw);
    for (var j = j0; j <= j1; j++) {
      var oy = lift(j) * ch + pan.y;
      var i0 = Math.floor((-oy - ch) / ch), i1 = Math.ceil((H - oy) / ch);
      for (var i = i0; i <= i1; i++) {
        var key = j + ',' + i;
        var el = live.get(key);
        if (!el) {
          el = take(project(j, i));
          live.set(key, el);
          if (entering) el.classList.add('is-entering');
          field.appendChild(el);
        }
        seen.add(key);
        // The lens: pull each tile toward the middle and shrink it, by how far
        // out it sits.
        var x = j * cw + pan.x + tw / 2, y = i * ch + oy + th / 2;
        var dx = x - cx, dy = y - cy;
        var q = Math.min(1, (dx * dx + dy * dy) / R2);
        var k = 1 - 0.1 * q, s = 1 - 0.2 * q;
        el._d = q;
        el.style.transform = 'translate3d(' + (cx + dx * k - tw / 2).toFixed(1) + 'px,' +
          (cy + dy * k - th / 2).toFixed(1) + 'px,0) scale(' + s.toFixed(4) + ')';
        if (entering) el.style.setProperty('--enter-delay', (Math.sqrt(q) * 0.55).toFixed(3) + 's');
      }
    }
    live.forEach(function (el, key) { if (!seen.has(key)) drop(key, el); });
  }

  // Only the few tiles nearest the middle play; the rest hold their poster.
  // Keeps the decoder count small however many copies are on the field.
  var lastPlay = 0;
  function playNearest(now) {
    if (now - lastPlay < 300) return;
    lastPlay = now;
    var tiles = [];
    live.forEach(function (el) { if (el._v) tiles.push(el); });
    tiles.sort(function (a, b) { return a._d - b._d; });
    var K = coarse ? 3 : 6;
    tiles.forEach(function (el, n) {
      var v = el._v;
      if (n < K && el._d < 0.5) { if (v.paused) v.play().catch(function () {}); }
      else if (!v.paused) v.pause();
    });
  }

  // ── Motion ────────────────────────────────────────────────────────────────
  var vel = { x: 0, y: 0 };
  var DRIFT = reduce ? 0 : (coarse ? 30 : 42);    // px per second
  var hover = 0;          // 0 outside, 1 over the field, 2 over a tile
  var holdUntil = 0;      // after arriving back, keep still for a moment
  var glide = null;       // a tile brought to the middle by keyboard focus
  var drag = null;
  var raf = 0, last = 0, t0 = performance.now();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;

    if (!drag) {
      // The drift wanders slowly through a range of diagonals.
      var a = 0.55 + 0.5 * Math.sin((now - t0) / 23000);
      var gain = hover === 2 || glide ? 0 : hover === 1 ? 0.3 : 1;
      if (now < holdUntil) gain = 0;
      else if (now < holdUntil + 1500) gain *= (now - holdUntil) / 1500;
      var ax = Math.cos(a) * DRIFT * gain, ay = Math.sin(a) * DRIFT * gain;
      // A fling coasts down into the drift rather than stopping dead.
      var ease = 1 - Math.exp(-dt * 1.8);
      vel.x += (ax - vel.x) * ease;
      vel.y += (ay - vel.y) * ease;
      pan.x -= vel.x * dt;
      pan.y -= vel.y * dt;
      if (glide) {
        var g = 1 - Math.exp(-dt * 7);
        pan.x += (glide.x - pan.x) * g;
        pan.y += (glide.y - pan.y) * g;
        if (Math.abs(glide.x - pan.x) + Math.abs(glide.y - pan.y) < 0.5) glide = null;
      }
    }
    layout();
    playNearest(now);
  }

  // Drag with a finger or the mouse. Pointer capture waits until the gesture
  // is clearly a drag, so a plain click still lands on the tile's link.
  var suppressClick = false;
  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, samples: [] };
    glide = null;
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) + Math.abs(dy) < 6) return;
      drag.moved = true;
      stage.classList.add('is-dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    }
    pan.x += dx; pan.y += dy;
    drag.x = e.clientX; drag.y = e.clientY;
    var now = performance.now();
    drag.samples.push({ t: now, x: dx, y: dy });
    while (drag.samples.length && now - drag.samples[0].t > 90) drag.samples.shift();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);
      var s = drag.samples, sx = 0, sy = 0;
      s.forEach(function (p) { sx += p.x; sy += p.y; });
      var span = s.length ? Math.max(16, performance.now() - s[0].t) / 1000 : 1;
      // Velocity is "how fast the field moves"; pan moves opposite to drift.
      vel.x = Math.max(-2400, Math.min(2400, -sx / span));
      vel.y = Math.max(-2400, Math.min(2400, -sy / span));
      stage.classList.remove('is-dragging');
    }
    drag = null;
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('click', function (e) {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  stage.addEventListener('dragstart', function (e) { e.preventDefault(); });

  // Sideways scrolling (trackpads, shift+wheel) pans; plain vertical scrolling
  // is left to the page.
  stage.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    pan.x -= e.deltaX;
    glide = null;
  }, { passive: false });

  stage.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    hover = e.target.closest && e.target.closest('.canvas-tile') ? 2 : 1;
  });
  stage.addEventListener('pointerleave', function () { hover = 0; });

  // Tabbing onto a tile glides it to the middle.
  stage.addEventListener('focusin', function (e) {
    var a = e.target.closest && e.target.closest('.canvas-tile');
    if (!a || !a.matches(':focus-visible')) return;
    var r = a.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    glide = {
      x: pan.x + (sr.left + W / 2) - (r.left + r.width / 2),
      y: pan.y + (sr.top + H / 2) - (r.top + r.height / 2),
    };
  });

  // ── Running ───────────────────────────────────────────────────────────────
  var on = false, visible = true;
  function run() {
    if (raf || !on || !visible || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function halt() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    live.forEach(function (el) { if (el._v && !el._v.paused) el._v.pause(); });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      visible = es[es.length - 1].isIntersecting;
      if (visible) run(); else halt();
    }).observe(stage);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) halt(); else run(); });
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { if (on) { measure(); layout(); } }).observe(stage);
  }

  var placed = false;
  function start(animate) {
    stage.hidden = false;
    on = true;
    measure();
    if (!placed) { centerOn(0); placed = true; }
    entering = !!animate && !reduce;
    if (entering) {
      live.forEach(function (el, key) { drop(key, el); });
      field.classList.add('is-entering');
    }
    layout();
    entering = false;
    // Entrance classes come off once the last tile has settled.
    setTimeout(function () {
      field.classList.remove('is-entering');
      field.querySelectorAll('.is-entering').forEach(function (el) { el.classList.remove('is-entering'); });
    }, 1400);
    run();
  }
  function stop() {
    on = false;
    halt();
    stage.hidden = true;
  }
  window.homeCanvas = { start: start, stop: stop };

  // ── First paint ───────────────────────────────────────────────────────────
  var mode;
  try { mode = localStorage.getItem('home-layout'); } catch (e) {}
  if (mode === 'cols2') mode = 'cols3';
  if (MODES.indexOf(mode) === -1) mode = 'canvas';
  if (mode !== 'canvas') return;

  grid.hidden = true;
  // Coming back from a project through its window: open with that project's
  // tile waiting in the middle, at full size, and hold still while the
  // header shrinks into it (page-transition.js finds it there).
  var back = null;
  try { back = (JSON.parse(sessionStorage.getItem('project-window') || 'null') || {}).back; } catch (e) {}
  var home = back && cards.findIndex(function (c) { return page(c.getAttribute('href')) === back; });
  measure();
  if (back && home >= 0) {
    centerOn(home);
    placed = true;
    holdUntil = performance.now() + 900;
    start(false);
  } else {
    start(true);
  }
})();
