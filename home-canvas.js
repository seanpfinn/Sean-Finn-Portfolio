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
// ── Cursor tag ──────────────────────────────────────────────────────────────
// A small label that rides along with the cursor and names the project under
// it. Shared by the canvas (below) and the globe (home-layout.js), through
// window.cursorTag. It trails the pointer slightly on a spring, so it feels
// attached rather than pinned, and pops in and out on a little scale.
// Mouse and pen only — there's no cursor to follow on a touch screen.
window.cursorTag = window.cursorTag || (function () {
  var el = document.createElement('div');
  el.className = 'cursor-tag';
  el.setAttribute('aria-hidden', 'true');
  var label = document.createElement('span');
  el.appendChild(label);
  var x = 0, y = 0, tx = 0, ty = 0, raf = 0, shown = false, placed = false;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function step() {
    var k = still ? 1 : 0.28;
    x += (tx - x) * k; y += (ty - y) * k;
    el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.2 ? requestAnimationFrame(step) : 0;
  }
  function attach() { if (!el.isConnected) document.body.appendChild(el); }
  return {
    show: function (name, cx, cy) {
      if (!name) return this.hide();
      attach();
      tx = cx; ty = cy;
      if (!placed || !shown) { x = tx; y = ty; placed = true; }
      if (label.textContent !== name) label.textContent = name;
      if (!shown) { shown = true; el.classList.add('is-on'); }
      if (!raf) raf = requestAnimationFrame(step);
    },
    move: function (cx, cy) { tx = cx; ty = cy; if (shown && !raf) raf = requestAnimationFrame(step); },
    hide: function () {
      if (!shown) return;
      shown = false;
      el.classList.remove('is-on');
    },
  };
})();

(function () {
  var tag = window.cursorTag;
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
  // Shuffled on every load, so the field is arranged differently each visit:
  // which project sits where (a random order around the same no-neighbors
  // pattern), how the columns are staggered, and which one starts in the
  // middle. Projects still never touch a copy of themselves.
  var order = cards.map(function (_, k) { return k; });
  for (var k = N - 1; k > 0; k--) {
    var r = Math.floor(Math.random() * (k + 1)), t = order[k];
    order[k] = order[r]; order[r] = t;
  }
  var SEED = Math.random() * 1000;
  function project(j, i) { return order[mod(j + i * STEP, N)]; }
  // The column for project p in row 0.
  function columnOf(p) { return order.indexOf(p); }
  // Columns are staggered by the golden ratio, which never lines up into
  // rows however far the field is dragged.
  function lift(j) { var f = (j + SEED) * 0.6180339887; return f - Math.floor(f); }

  function page(u) {
    try {
      var p = new URL(u, location.href).pathname.split('/').pop().replace(/\.html$/, '');
      return p === '' || p === 'index' ? '/' : '/' + p;
    } catch (e) { return ''; }
  }

  // ── Geometry ──────────────────────────────────────────────────────────────
  // The stage fills the window behind the page. The intro (and nav) above
  // and the footer below sit on its frosted frame; the clear area between
  // them is where the lens is centered and where a returning project lands.
  var W = 0, H = 0, tw = 0, th = 0, cw = 0, ch = 0, CX = 0, CY = 0;
  var pan = { x: 0, y: 0 };
  var hero = document.querySelector('.splash-hero');
  var nav = document.querySelector('.splash-nav');
  var foot = document.querySelector('.splash-footer');
  function clearArea() {
    var top = 0, bottom = 0;
    // Layout boxes, not painted ones: both are mid-entrance (blurIn slides
    // them up 10px) the first time this runs.
    // On the canvas the top bar (nav, intro line, toggle) is all that sits
    // over the field; they're fixed, so offsetTop is from the window's top.
    [nav, document.querySelector('.hero-line'), document.querySelector('.layout-toggle')].forEach(function (el) {
      if (el && el.offsetParent === null && el.offsetHeight) top = Math.max(top, el.offsetTop + el.offsetHeight);
    });
    if (!top && hero && hero.offsetParent) top = hero.offsetParent.getBoundingClientRect().top + hero.offsetTop + hero.offsetHeight;
    if (foot) { var fr = foot.getBoundingClientRect(); if (fr.height) bottom = Math.max(0, H - fr.top); }
    top = Math.min(top, H * 0.45); bottom = Math.min(bottom, H * 0.3);
    stage.style.setProperty('--clear-top', Math.round(top) + 'px');
    stage.style.setProperty('--clear-bottom', Math.round(bottom) + 'px');
    CX = W / 2;
    CY = (top + (H - bottom)) / 2;
  }
  function measure() {
    var r = stage.getBoundingClientRect();
    var fx = cw ? (CX - pan.x) / cw : 0, fy = ch ? (CY - pan.y) / ch : 0;
    W = r.width; H = r.height;
    clearArea();
    // Big windows: about a third of a wide screen, most of a phone's width.
    tw = Math.round(W < 810 ? W * 0.66 : Math.max(300, Math.min(520, W * 0.3)));
    th = tw * 9 / 16;
    cw = tw * 1.16;                    // air between columns
    ch = th + tw * 0.16;               // visual and gap; no captions on the canvas
    field.style.setProperty('--tile-w', tw + 'px');
    if (fx || fy) { pan.x = CX - fx * cw; pan.y = CY - fy * ch; }
  }
  // Put slot (column j, row 0) dead center.
  function centerOn(j) {
    pan.x = CX - (j * cw + tw / 2);
    pan.y = CY - (lift(j) * ch + th / 2);
  }

  // ── Tiles ─────────────────────────────────────────────────────────────────
  // The frosted frame: three layers of increasing blur (styles.css).
  var frost = document.createElement('div');
  frost.className = 'canvas-frame';
  frost.setAttribute('aria-hidden', 'true');
  for (var f = 0; f < 3; f++) {
    var layer = frost.appendChild(document.createElement('div'));
    layer.className = 'canvas-frost';
    ['t', 'b', 'l', 'r'].forEach(function (side) {
      layer.appendChild(document.createElement('div')).className = 'frost-edge ' + side;
    });
  }
  stage.appendChild(frost);
  // Refraction for browsers that take an SVG filter in backdrop-filter
  // (Chromium). A slow, low-frequency displacement bends the tiles seen
  // through the frame like poured glass. Safari and Firefox keep the frost.
  if (/Chrome\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent)) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = '<filter id="frost-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="7" result="n"/>' +
      '<feGaussianBlur in="n" stdDeviation="6" result="s"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="s" scale="46" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.appendChild(svg);
    document.documentElement.classList.add('glass-refract');
  }

  var live = new Map();                 // "j,i" -> tile on the field
  var spare = cards.map(function () { return []; });   // off-field, per project

  function make(p) {
    var src = cards[p];
    var a = document.createElement('a');
    a.className = 'canvas-tile';
    a.href = src.getAttribute('href');
    a.draggable = false;
    var vis = src.querySelector('.gallery-card-visual').cloneNode(true);
    vis.querySelectorAll('video').forEach(function (v) {
      v.removeAttribute('data-play-in-view');   // this script decides what plays
      v.preload = 'none';
      v.muted = true;
    });
    a.appendChild(vis);
    a.setAttribute('aria-label', title(p));    // the visible name lives in the cursor tag
    a.querySelectorAll('img').forEach(function (im) { im.draggable = false; });
    a._p = p;
    a._v = vis.querySelector('video');
    return a;
  }
  function title(p) {
    var t = cards[p].querySelector('.gallery-card-title');
    return t ? t.textContent.trim() : '';
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
    var cx = CX, cy = CY, R2 = (W * W + H * H) / 4;
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
    var dt = Math.min(0.1, (now - last) / 1000 || 0);
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
    hitTest(now);
    playNearest(now);
  }

  // Drag with the mouse, or swipe with a finger. Nothing is captured until
  // the gesture is clearly a drag, so a plain click or tap still lands on
  // the tile's link.
  var suppressUntil = 0;
  function begin(id, x, y) {
    drag = { id: id, x: x, y: y, moved: false, samples: [] };
    glide = null;
  }
  function move(x, y) {
    var dx = x - drag.x, dy = y - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) + Math.abs(dy) < 6) return false;
      drag.moved = true;
      stage.classList.add('is-dragging');
      tag.hide();
    }
    pan.x += dx; pan.y += dy;
    drag.x = x; drag.y = y;
    var now = performance.now();
    drag.samples.push({ t: now, x: dx, y: dy });
    while (drag.samples.length && now - drag.samples[0].t > 90) drag.samples.shift();
    return true;
  }
  function finish() {
    if (drag && drag.moved) {
      suppressUntil = performance.now() + 400;
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

  // Mouse and pen. Touch has its own handlers below: iOS hands a finger on a
  // link to its own gestures, and pointer events alone don't reliably keep it.
  // A drag can start anywhere over the canvas that isn't a control of the
  // page's own (the nav, the toggle, the footer's links), and is followed on
  // the whole document so it never drops when the pointer crosses the
  // frosted frame or leaves the window.
  var CONTROLS = 'button, input, .splash-nav, .layout-toggle, .splash-footer a, .music-box, [class*="miniplayer"]';
  document.addEventListener('pointerdown', function (e) {
    if (!on || e.pointerType === 'touch' || e.button !== 0) return;
    if (e.target.closest && e.target.closest(CONTROLS)) return;
    begin(e.pointerId, e.clientX, e.clientY);
  });
  // Stop the browser's own drag of a link or image, and text selection, so
  // the first few pixels of a drag pan the field instead.
  stage.addEventListener('mousedown', function (e) { if (e.button === 0) e.preventDefault(); });
  document.addEventListener('pointermove', function (e) {
    if (!on || e.pointerType === 'touch') return;
    pointer = stage.contains(e.target) || (drag && drag.moved) ? { x: e.clientX, y: e.clientY } : null;
    if (pointer) tag.move(e.clientX, e.clientY);
    if (!drag || e.pointerId !== drag.id) return;
    move(e.clientX, e.clientY);
  });
  function endPointer(e) { if (drag && e.pointerId === drag.id) finish(); }
  document.addEventListener('pointerup', endPointer);
  document.addEventListener('pointercancel', endPointer);
  addEventListener('blur', function () { if (drag && drag.id !== 'touch') finish(); });

  stage.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { if (drag) finish(); return; }
    var t = e.touches[0];
    begin('touch', t.clientX, t.clientY);
  }, { passive: true });
  stage.addEventListener('touchmove', function (e) {
    if (!drag || drag.id !== 'touch') return;
    e.preventDefault();
    var t = e.touches[0];
    if (t) move(t.clientX, t.clientY);
  }, { passive: false });
  stage.addEventListener('touchend', function () { if (drag && drag.id === 'touch') finish(); });
  stage.addEventListener('touchcancel', function () { if (drag && drag.id === 'touch') finish(); });

  stage.addEventListener('click', function (e) {
    if (performance.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  stage.addEventListener('dragstart', function (e) { e.preventDefault(); });

  // The page doesn't scroll while the canvas is up, so the wheel and
  // two-finger trackpad swipes pan the field in both directions.
  addEventListener('wheel', function (e) {
    if (!on || e.ctrlKey) return;               // ctrl + wheel is pinch-zoom
    if (e.target.closest && e.target.closest('.nav-dropdown, .splash-nav-links, .music-box, [class*="miniplayer"]')) return;
    e.preventDefault();
    var k = e.deltaMode === 1 ? 16 : 1;
    pan.x -= e.deltaX * k;
    pan.y -= e.deltaY * k;
    glide = null;
  }, { passive: false });
  // Nor does it scroll by touch: iOS will rubber-band a page whose body
  // can't scroll unless the move itself is cancelled. The menu is exempt.
  document.addEventListener('touchmove', function (e) {
    if (!on || (e.target.closest && e.target.closest('.splash-nav'))) return;
    e.preventDefault();
  }, { passive: false });

  // Hover: the drift slows over the field and stops over a tile, and the
  // cursor tag names the tile. Tiles drift under a still cursor, so this is
  // checked every few frames rather than only when the mouse moves.
  var pointer = null, lastHit = 0;
  stage.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'touch') return;
    pointer = null; hover = 0; tag.hide();
  });
  function hitTest(now) {
    if (!pointer || now - lastHit < 80) return;
    lastHit = now;
    if (drag && drag.moved) return;
    var el = document.elementFromPoint(pointer.x, pointer.y);
    var a = el && el.closest && el.closest('.canvas-tile');
    if (a && stage.contains(a)) { hover = 2; tag.show(title(a._p), pointer.x, pointer.y); }
    else { hover = stage.contains(el) ? 1 : 0; tag.hide(); }
  }

  // Tabbing onto a tile glides it to the middle.
  stage.addEventListener('focusin', function (e) {
    var a = e.target.closest && e.target.closest('.canvas-tile');
    if (!a || !a.matches(':focus-visible')) return;
    var r = a.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    glide = {
      x: pan.x + (sr.left + CX) - (r.left + r.width / 2),
      y: pan.y + (sr.top + CY) - (r.top + r.height / 2),
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
    document.documentElement.classList.add('is-canvas');
    on = true;
    measure();
    if (!placed) { centerOn(Math.floor(Math.random() * N)); placed = true; }
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
    tag.hide();
    stage.hidden = true;
    document.documentElement.classList.remove('is-canvas');
  }
  window.homeCanvas = { start: start, stop: stop };

  // ── First paint ───────────────────────────────────────────────────────────
  var mode;
  mode = 'canvas';                       // the only homepage layout now (see index.html)
  if (MODES.indexOf(mode) === -1) mode = 'canvas';
  if (mode !== 'canvas') return;

  grid.hidden = true;
  // Coming back from a project through its window: open with that project's
  // tile waiting in the middle, at full size, and hold still while the
  // header shrinks into it (page-transition.js finds it there).
  var back = null;
  try { back = (JSON.parse(sessionStorage.getItem('project-window') || 'null') || {}).back; } catch (e) {}
  var home = back && cards.findIndex(function (c) { return page(c.getAttribute('href')) === back; });
  stage.hidden = false;                  // measured visible, or it reads as zero size
  measure();
  if (back && home >= 0) {
    centerOn(columnOf(home));
    placed = true;
    holdUntil = performance.now() + 900;
    start(false);
  } else {
    start(true);
  }
})();
