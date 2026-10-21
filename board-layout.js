// ── Case-study layout: the Board ───────────────────────────────────────────
// On a desktop-sized screen the case study becomes a board, like the
// project's working file: the header card first, then each chapter as a note
// pinned beside its frames, laid out left to right with a little stagger. It
// pans by dragging or scrolling, zooms with a pinch (or ctrl + scroll), and
// clicking a frame brings it up to fill the window. A pill at the bottom steps
// through the chapters (so do the arrow keys) and a map in the corner shows
// where you are.
//
// The page's HTML stays as written (a header, then captions each followed by
// their panels); this script, placed right after <main>, moves those same
// elements onto the board before the first frame. They're moved, not copied,
// so the live demos inside them keep working, and #proj-hero is still the
// header visual the homepage window grows into (page-transition.js).
//
// Phones keep the scrolling layout: this bows out, and case-layout.js (loaded
// next) runs as on every other project.
(function () {
  if (!matchMedia('(min-width: 50.625rem)').matches) return;
  var col = document.querySelector('body.proj-page .proj-col');
  if (!col || !col.querySelector('.proj-panel-new')) return;
  window.BOARD_ACTIVE = true;
  var root = document.documentElement;
  root.classList.add('bd-on');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Read the page into chapters ────────────────────────────────────────
  var header = col.querySelector('.proj-header-group');
  var chapters = [];
  var cur = null;
  Array.prototype.slice.call(col.children).forEach(function (el) {
    if (el === header) return;
    if (el.classList.contains('proj-caption')) {
      var l = el.querySelector('.proj-caption-label');
      cur = { caption: el, label: l ? l.textContent.trim() : '', media: [] };
      chapters.push(cur);
    } else if (cur && (el.classList.contains('proj-panel-group') || el.classList.contains('proj-panel-new'))) {
      cur.media.push(el);
    }
  });

  // ── Build the board ────────────────────────────────────────────────────
  var stage = document.createElement('div');
  stage.className = 'bd-stage';
  var world = document.createElement('div');
  world.className = 'bd-world';
  stage.appendChild(world);
  col.parentNode.insertBefore(stage, col);
  col.hidden = true;

  var title = (document.querySelector('.proj-title-new') || {}).textContent || document.title;
  var bar = document.createElement('div');
  bar.className = 'bd-title';
  bar.textContent = title.trim();
  document.body.appendChild(bar);

  function card(cls, children) {
    var d = document.createElement('div');
    d.className = 'bd-item ' + cls;
    children.forEach(function (c) { d.appendChild(c); });
    world.appendChild(d);
    return d;
  }
  function place(el, x, y) { el.style.left = x + 'px'; el.style.top = y + 'px'; el._x = x; el._y = y; }
  function box(el) { return { x: el._x, y: el._y, w: el.offsetWidth, h: el.offsetHeight }; }
  function union(a, b) {
    if (!a) return b;
    var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x: x, y: y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  }

  var NOTE_W = 340, FRAME_W = 780, GAP = 64, ZONE_GAP = 220, ROW_GAP = 260;
  var ROW_MAX = 4600;                       // wrap to a new row past this, like a board
  var zones = [];
  var x = 0, k = 0, rowY = 0, rowBottom = 0;
  // Start a new row when the next zone would run past ROW_MAX.
  function room(w) {
    if (x > 0 && x + w > ROW_MAX) { x = 0; rowY = rowBottom + ROW_GAP; }
  }
  function grow(el) { rowBottom = Math.max(rowBottom, el._y + el.offsetHeight); }

  // The header, as the first card.
  if (header) {
    var head = card('bd-head', [header]);
    place(head, x, 40);
    grow(head);
    zones.push({ label: title.trim(), el: [head], num: '' });
    x += 460 + ZONE_GAP * 0.6;
  }

  chapters.forEach(function (ch, i) {
    var num = String(i + 1).padStart(2, '0');
    var tag = document.createElement('span');
    tag.className = 'bd-num';
    tag.textContent = num;
    var note = card('bd-note', [tag, ch.caption]);
    var w = ch.media.length ? NOTE_W + (FRAME_W + GAP) * ch.media.length : NOTE_W;
    room(w);
    var y0 = rowY + ((k++ % 2) ? 150 : 0);  // a gentle stagger, zone to zone
    var els = [note];
    if (ch.media.length) {
      place(note, x, y0 + 56);
      grow(note);
      var fx = x + NOTE_W + GAP;
      ch.media.forEach(function (m, j) {
        var f = card('bd-frame', [m]);
        if (m.querySelector('.proj-panel--embed')) f.classList.add('is-live');
        place(f, fx, y0 + j * 40);
        grow(f);
        fx += FRAME_W + GAP;
        els.push(f);
      });
      x = fx - GAP + ZONE_GAP;
    } else {
      place(note, x, y0 + 120);
      grow(note);
      x += NOTE_W + ZONE_GAP;
    }
    zones.push({ label: ch.label, el: els, num: num });
  });

  // Entrance: everything but the landing window settles in, nearest first.
  if (!reduce) {
    world.querySelectorAll('.bd-item').forEach(function (el, n) {
      if (el.querySelector('#proj-hero')) return;
      el.style.animationDelay = (0.12 + Math.min(n, 8) * 0.05) + 's';
      el.classList.add('bd-enter');
    });
  }

  function zoneRect(z) { var r = null; z.el.forEach(function (e) { r = union(r, box(e)); }); return r; }
  function allRect() { var r = null; zones.forEach(function (z) { r = union(r, zoneRect(z)); }); return r; }

  // ── Camera ─────────────────────────────────────────────────────────────
  var cam = { x: 0, y: 0, s: 1 }, goal = null, raf = 0;
  var TOP = 64, BOTTOM = 120;               // room for the bar and the pill
  function apply() {
    world.style.transform = 'translate(' + cam.x.toFixed(2) + 'px,' + cam.y.toFixed(2) + 'px) scale(' + cam.s.toFixed(4) + ')';
    var g = 28 * cam.s;
    while (g < 12) g *= 4;                  // coarser dots when zoomed far out
    stage.style.backgroundSize = g + 'px ' + g + 'px';
    stage.style.backgroundPosition = cam.x + 'px ' + cam.y + 'px';
    drawMap();
    syncPill();
  }
  function fit(r, pad, maxS) {
    var vw = innerWidth, vh = innerHeight;
    var aw = vw - pad * 2, ah = vh - TOP - BOTTOM - pad;
    var s = Math.max(0.12, Math.min(maxS || 1.15, aw / r.w, ah / r.h));
    return { s: s, x: vw / 2 - (r.x + r.w / 2) * s, y: TOP + (vh - TOP - BOTTOM) / 2 - (r.y + r.h / 2) * s };
  }
  function go(t, instant) {
    goal = t;
    if (instant || reduce) { cam = { x: t.x, y: t.y, s: t.s }; goal = null; apply(); return; }
    if (!raf) raf = requestAnimationFrame(step);
  }
  var last = 0;
  function step(now) {
    raf = 0;
    if (!goal) return;
    var dt = Math.min(0.05, (now - (last || now)) / 1000) || 0.016;
    last = now;
    var e = 1 - Math.exp(-dt * 7);
    // Zoom moves in log space so it feels even at every scale.
    var ls = Math.log(cam.s) + (Math.log(goal.s) - Math.log(cam.s)) * e;
    cam.s = Math.exp(ls);
    cam.x += (goal.x - cam.x) * e;
    cam.y += (goal.y - cam.y) * e;
    if (Math.abs(goal.x - cam.x) + Math.abs(goal.y - cam.y) < 0.5 && Math.abs(goal.s - cam.s) < 0.0005) {
      cam = { x: goal.x, y: goal.y, s: goal.s }; goal = null; last = 0;
    } else raf = requestAnimationFrame(step);
    apply();
  }
  function stop() { goal = null; if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }

  // ── Where you are ──────────────────────────────────────────────────────
  var focusFrame = null;
  function centerWorld() {
    return { x: (innerWidth / 2 - cam.x) / cam.s, y: (TOP + (innerHeight - TOP - BOTTOM) / 2 - cam.y) / cam.s };
  }
  function nearest() {
    var c = centerWorld(), best = 0, bd = Infinity;
    zones.forEach(function (z, i) {
      var r = zoneRect(z);
      var d = Math.abs(c.x - (r.x + r.w / 2)) + 0.3 * Math.abs(c.y - (r.y + r.h / 2));
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function toZone(i, instant) {
    i = Math.max(0, Math.min(zones.length - 1, i));
    focusFrame = null;
    go(fit(zoneRect(zones[i]), 72), instant);
  }

  // ── Chapter pill ───────────────────────────────────────────────────────
  var pill = document.createElement('div');
  pill.className = 'bd-pill';
  pill.innerHTML =
    '<button type="button" class="bd-step" data-d="-1" aria-label="Previous chapter">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button>' +
    '<button type="button" class="bd-where" aria-label="Show the whole board"><span class="bd-where-num"></span><span class="bd-where-label"></span></button>' +
    '<button type="button" class="bd-step" data-d="1" aria-label="Next chapter">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button>';
  document.body.appendChild(pill);
  var pillNum = pill.querySelector('.bd-where-num'), pillLabel = pill.querySelector('.bd-where-label');
  var shown = -1;
  function syncPill() {
    var i = nearest();
    if (i === shown) return;
    shown = i;
    pillNum.textContent = zones[i].num;
    pillLabel.textContent = zones[i].label;
    pill.querySelector('[data-d="-1"]').disabled = i === 0;
    pill.querySelector('[data-d="1"]').disabled = i === zones.length - 1;
  }
  pill.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('bd-where')) { overview(); return; }
    toZone(nearest() + Number(b.dataset.d));
  });
  function overview() { focusFrame = null; go(fit(allRect(), 64, 1)); }

  // ── Map ────────────────────────────────────────────────────────────────
  var map = document.createElement('canvas');
  map.className = 'bd-map';
  map.setAttribute('aria-hidden', 'true');
  document.body.appendChild(map);
  var MW = 184, MH = 76, dpr = Math.min(2, devicePixelRatio || 1);
  map.width = MW * dpr; map.height = MH * dpr;
  var mctx = map.getContext('2d');
  var mapFit = null;
  function mapScale() {
    var r = allRect(), pad = 8;
    var s = Math.min((MW - pad * 2) / r.w, (MH - pad * 2) / r.h);
    return { r: r, s: s, ox: (MW - r.w * s) / 2 - r.x * s, oy: (MH - r.h * s) / 2 - r.y * s };
  }
  function drawMap() {
    if (!mapFit) mapFit = mapScale();
    var m = mapFit, cs = getComputedStyle(map);
    var ink = cs.getPropertyValue('--map-ink').trim() || 'rgba(0,0,0,.18)';
    var view = cs.getPropertyValue('--map-view').trim() || '#FF401A';
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, MW, MH);
    mctx.fillStyle = ink;
    world.querySelectorAll('.bd-item').forEach(function (el) {
      var b = box(el);
      mctx.fillRect(m.ox + b.x * m.s, m.oy + b.y * m.s, Math.max(1.5, b.w * m.s), Math.max(1.5, b.h * m.s));
    });
    var vx = (-cam.x) / cam.s, vy = (-cam.y) / cam.s;
    mctx.strokeStyle = view;
    mctx.lineWidth = 1.25;
    mctx.strokeRect(m.ox + vx * m.s, m.oy + vy * m.s, innerWidth / cam.s * m.s, innerHeight / cam.s * m.s);
  }
  map.addEventListener('click', function (e) {
    var m = mapFit, r = map.getBoundingClientRect();
    var wx = (e.clientX - r.left - m.ox) / m.s, wy = (e.clientY - r.top - m.oy) / m.s;
    focusFrame = null;
    go({ s: cam.s, x: innerWidth / 2 - wx * cam.s, y: innerHeight / 2 - wy * cam.s });
  });

  // ── Drag, scroll, pinch, click ─────────────────────────────────────────
  var NOGRAB = 'button, a, input, select, textarea, .is-live, .bd-pill, .bd-map, .splash-nav, .splash-footer';
  var drag = null;
  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || (e.target.closest && e.target.closest(NOGRAB))) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: cam.x, sy: cam.y, moved: false };
  });
  addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!drag.moved) { drag.moved = true; stop(); stage.classList.add('is-dragging'); }
    cam.x = drag.sx + dx; cam.y = drag.sy + dy;
    focusFrame = null;
    apply();
  });
  addEventListener('pointerup', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var was = drag; drag = null;
    stage.classList.remove('is-dragging');
    if (was.moved) return;
    // A plain click on a frame brings it up; clicking it again steps back.
    var f = e.target.closest && e.target.closest('.bd-frame');
    if (!f || f.classList.contains('is-live')) return;
    if (focusFrame === f) { toZone(nearest()); return; }
    focusFrame = f;
    go(fit(box(f), 56, 2));
  });
  stage.addEventListener('mousedown', function (e) { if (!(e.target.closest && e.target.closest(NOGRAB))) e.preventDefault(); });

  addEventListener('wheel', function (e) {
    if (e.target.closest && e.target.closest('.splash-nav-links, .bd-map, [class*="miniplayer"]')) return;
    e.preventDefault();
    stop();
    focusFrame = null;
    if (e.ctrlKey || e.metaKey) {
      // Pinch on a trackpad (or ctrl + wheel): zoom about the pointer.
      var ns = Math.max(0.12, Math.min(2.5, cam.s * Math.exp(-e.deltaY * 0.01)));
      cam.x = e.clientX - (e.clientX - cam.x) * (ns / cam.s);
      cam.y = e.clientY - (e.clientY - cam.y) * (ns / cam.s);
      cam.s = ns;
    } else {
      var k2 = e.deltaMode === 1 ? 16 : 1;
      // A plain mouse wheel moves along the board; trackpads pan freely.
      if (Math.abs(e.deltaX) < 1 && !e.shiftKey) cam.x -= e.deltaY * k2;
      else { cam.x -= e.deltaX * k2; cam.y -= e.deltaY * k2; }
    }
    apply();
  }, { passive: false });

  addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    var n = nearest();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); toZone(n + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); toZone(n - 1); }
    else if (e.key === 'Escape') toZone(n);
    else if (e.key === '0') overview();
    else if (e.key === '=' || e.key === '+') go({ s: cam.s * 1.25, x: innerWidth / 2 - (innerWidth / 2 - cam.x) * 1.25, y: innerHeight / 2 - (innerHeight / 2 - cam.y) * 1.25 });
    else if (e.key === '-') go({ s: cam.s / 1.25, x: innerWidth / 2 - (innerWidth / 2 - cam.x) / 1.25, y: innerHeight / 2 - (innerHeight / 2 - cam.y) / 1.25 });
  });

  addEventListener('resize', function () { mapFit = null; toZone(nearest(), true); });

  // "More case studies" is added by main.js once the page has loaded; it
  // becomes the last stop on the board.
  document.addEventListener('DOMContentLoaded', function () {
    var more = col.querySelector('.proj-more');
    if (!more) return;
    var c = card('bd-more', [more]);
    var lastR = zoneRect(zones[zones.length - 1]);
    if (lastR.x + lastR.w + ZONE_GAP + 900 > ROW_MAX) place(c, 0, rowBottom + ROW_GAP);
    else place(c, lastR.x + lastR.w + ZONE_GAP, lastR.y);
    zones.push({ label: 'More case studies', el: [c], num: '' });
    mapFit = null;
    shown = -1;
    apply();
  });

  // Land on the opening: the header and the first chapter's window together.
  var open = zoneRect(zones[0]);
  if (zones[1]) open = union(open, zoneRect(zones[1]));
  go(fit(open, 72), true);
})();
