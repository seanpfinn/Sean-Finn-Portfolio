// ── Career timeline ───────────────────────────────────────────────────────
// Two views over the same dates: a vertical chart reading newest-first, and a
// horizontal one reading left-to-right chronologically. Both are positioned
// from a single linear time scale, so the chart stays truthful as dates change
// and "Present" roles keep growing. Nothing here is hand-placed.

(function () {
  const chart   = document.getElementById('tl-chart');
  const list    = document.getElementById('tl-list');
  const axis    = document.getElementById('tl-axis');
  const buttons = Array.from(document.querySelectorAll('.tl-orient-btn'));
  if (!chart || !list || !axis) return;

  const STORE_KEY = 'timeline-orient';
  const ORIENTS = ['vertical', 'horizontal'];

  // Vertical scale
  const V_PX_YEAR = 80;    // matches the design's year spacing
  const V_MIN     = 76;    // a short role still needs room for its text
  const V_GAP     = 12;    // air below each card
  const V_LANE    = 12;    // between side-by-side lanes

  // Horizontal scale — wider per year, since cards read across
  const H_PX_YEAR = 260;
  const H_MIN     = 200;
  const H_GAP     = 14;
  const H_ROW     = 104;   // row height
  const H_ROWGAP  = 12;
  const H_AXIS    = 44;    // headroom for the axis line and its year labels

  const MS_YEAR = 365.2425 * 24 * 60 * 60 * 1000;
  const now = new Date();

  // Below this the vertical chart can't hold parallel lanes legibly.
  const narrow = () => window.matchMedia('(max-width: 50.5625rem)').matches;

  // "YYYY-MM" -> Date at the first of that month. Empty means "still going".
  function parse(v) {
    if (!v) return now;
    const [y, m] = v.split('-').map(Number);
    return new Date(y, (m || 1) - 1, 1);
  }

  const items = Array.from(list.querySelectorAll('.tl-item')).map((el) => ({
    el,
    start: parse(el.dataset.start),
    end: parse(el.dataset.end),
    current: !el.dataset.end,
  }));
  if (!items.length) return;

  const earliest = items.reduce((a, i) => (i.start < a ? i.start : a), items[0].start);
  const rangeStart = new Date(earliest.getFullYear(), 0, 1);
  const spanYears = (now - rangeStart) / MS_YEAR;

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const label = (d) => MONTHS[d.getMonth()] + ' ' + d.getFullYear();

  // Fill the date line once; it doesn't depend on orientation.
  items.forEach((it) => {
    const el = it.el.querySelector('.tl-dates');
    if (!el) return;
    el.textContent = it.el.classList.contains('tl-item--point')
      ? label(it.start)
      : label(it.start) + ' — ' + (it.current ? 'Present' : label(it.end));
  });

  // Pack items into lanes so overlapping roles never collide. Worked out per
  // cluster of transitively overlapping roles, so a role that overlaps nothing
  // still gets the full track to itself.
  function assignLanes(measured) {
    measured.sort((a, b) => a.a - b.a);
    let cluster = null;
    const clusters = [];
    for (const it of measured) {
      if (cluster && it.a < cluster.end) {
        cluster.items.push(it);
        cluster.end = Math.max(cluster.end, it.b);
      } else {
        cluster = { items: [it], end: it.b };
        clusters.push(cluster);
      }
    }
    for (const c of clusters) {
      const ends = [];
      for (const it of c.items) {
        let lane = ends.findIndex((e) => it.a >= e);
        if (lane === -1) { lane = ends.length; ends.push(0); }
        ends[lane] = it.b;
        it.lane = lane;
      }
      for (const it of c.items) it.lanes = ends.length;
    }
  }

  function addTick(pos, text, cls, horizontal) {
    const d = document.createElement('div');
    d.className = 'tl-tick' + (cls ? ' ' + cls : '');
    if (horizontal) d.style.left = pos + 'px'; else d.style.top = pos + 'px';
    const s = document.createElement('span');
    s.textContent = text;
    d.appendChild(s);
    axis.appendChild(d);
  }

  function clearStyles() {
    axis.querySelectorAll('.tl-tick').forEach((t) => t.remove());
    items.forEach((it) => { it.el.style.cssText = ''; });
    list.style.cssText = '';
    chart.style.cssText = '';
    axis.style.cssText = '';
  }

  // ── Vertical: newest at the top, time running downward into the past ─────
  function renderVertical() {
    // On a phone the chart degrades to a chronological list: no absolute
    // positioning, no axis, full-width cards. Their printed date ranges carry
    // the timing instead of the geometry.
    if (narrow()) {
      chart.classList.add('is-list');
      items.slice()
        .sort((a, b) => b.end - a.end || b.start - a.start)
        .forEach((it) => list.appendChild(it.el));
      return;
    }
    chart.classList.remove('is-list');

    const y = (d) => ((now - d) / MS_YEAR) * V_PX_YEAR;
    const total = spanYears * V_PX_YEAR;

    addTick(0, 'Now', 'tl-tick--now', false);
    for (let yr = now.getFullYear(); yr >= rangeStart.getFullYear(); yr--) {
      const top = y(new Date(yr, 0, 1));
      if (top > 14 && top <= total) addTick(top, String(yr), '', false);
    }

    const measured = items.map((it) => {
      const a = y(it.end);
      const size = Math.max(V_MIN, y(it.start) - a - V_GAP);
      return { it, a, size, b: a + size + V_GAP };
    });
    assignLanes(measured);

    for (const m of measured) {
      const pct = 100 / m.lanes;
      const s = m.it.el.style;
      s.top = m.a + 'px';
      s.height = m.size + 'px';
      s.left = `calc(${m.lane * pct}% + ${m.lane ? V_LANE / 2 : 0}px)`;
      s.width = m.lanes > 1 ? `calc(${pct}% - ${V_LANE / 2}px)` : '100%';
    }
    list.style.height = total + 'px';
    chart.style.height = total + 'px';
  }

  // ── Horizontal: oldest at the left, reading forward in time ──────────────
  function renderHorizontal() {
    const x = (d) => ((d - rangeStart) / MS_YEAR) * H_PX_YEAR;
    const total = spanYears * H_PX_YEAR;

    for (let yr = rangeStart.getFullYear(); yr <= now.getFullYear(); yr++) {
      const left = x(new Date(yr, 0, 1));
      if (left >= 0 && left <= total - 28) addTick(left, String(yr), '', true);
    }
    addTick(total, 'Now', 'tl-tick--now', true);

    const measured = items.map((it) => {
      const a = x(it.start);
      const size = Math.max(H_MIN, x(it.end) - a - H_GAP);
      return { it, a, size, b: a + size + H_GAP };
    });
    assignLanes(measured);

    let rows = 1;
    for (const m of measured) rows = Math.max(rows, m.lane + 1);

    for (const m of measured) {
      const s = m.it.el.style;
      s.left = m.a + 'px';
      s.width = m.size + 'px';
      s.top = (H_AXIS + m.lane * (H_ROW + H_ROWGAP)) + 'px';
      s.height = H_ROW + 'px';
    }

    const height = H_AXIS + rows * (H_ROW + H_ROWGAP);
    // The scroll surface has to be as wide as the whole span, plus a little
    // run-off so the last card clears the fade at the right edge.
    list.style.width = (total + H_MIN) + 'px';
    list.style.height = height + 'px';
    axis.style.width = (total + H_MIN) + 'px';
    chart.style.height = height + 'px';
  }

  function render() {
    clearStyles();
    chart.classList.remove('is-list');
    const horizontal = chart.classList.contains('is-horizontal');
    if (horizontal) renderHorizontal(); else renderVertical();
  }

  function apply(next, persist) {
    const target = ORIENTS.includes(next) ? next : 'vertical';
    chart.classList.toggle('is-horizontal', target === 'horizontal');
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === target)));
    render();
    if (target === 'horizontal') chart.scrollLeft = chart.scrollWidth;  // start at Now
    if (persist) { try { localStorage.setItem(STORE_KEY, target); } catch (e) {} }
  }

  buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.orient, true)));

  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
  apply(ORIENTS.includes(saved) ? saved : 'vertical', false);

  // Lane widths in the vertical view are percentage-based, so a resize only
  // needs a re-render when the row packing could change.
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });
})();


// ── Locked header + rolling year ──────────────────────────────────────────
// Self-contained: it reads the same data-start/data-end attributes the chart
// is built from, so it stays right without being wired into the renderer.
(function () {
  const head  = document.getElementById('tl-head');
  const yearEl = document.getElementById('tl-year');
  const chart = document.getElementById('tl-chart');
  const sentinel = document.querySelector('.tl-head-sentinel');
  if (!head || !yearEl || !chart) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = new Date();

  // Fractional years, so a role that ran to June reads as 2024.5 and the
  // odometer lands on the right year rather than the one it started in.
  function fy(v, fallback) {
    if (!v) return fallback;
    const [y, m] = v.split('-').map(Number);
    return y + ((m || 1) - 1) / 12;
  }
  const nowFy = now.getFullYear() + now.getMonth() / 12;

  const items = Array.from(chart.querySelectorAll('.tl-item')).map((el) => ({
    el,
    sy: fy(el.dataset.start, nowFy),
    ey: fy(el.dataset.end, nowFy),
  }));
  if (!items.length) return;

  // ── stuck state ─────────────────────────────────────────────────────────
  // Measured against the header's own resolved `top`, so it flips at the exact
  // moment the header actually pins — and keeps flipping at the right moment
  // when that value changes at the narrow breakpoint.
  function stuckCheck() {
    if (!sentinel) return;
    const top = parseFloat(getComputedStyle(head).top) || 0;
    head.classList.toggle('is-stuck', sentinel.getBoundingClientRect().top <= top);
  }

  // ── odometer ────────────────────────────────────────────────────────────
  const COLS = 4;
  const cols = [];
  for (let i = 0; i < COLS; i++) {
    const col = document.createElement('span');
    col.className = 'tl-dig';
    const strip = document.createElement('span');
    strip.className = 'tl-dig-strip';
    for (let copy = 0; copy < 3; copy++) {
      for (let d = 0; d < 10; d++) {
        const s = document.createElement('span');
        s.textContent = String(d);
        strip.appendChild(s);
      }
    }
    col.appendChild(strip);
    yearEl.appendChild(col);
    // pos indexes the 30-digit strip; rest state is always the middle copy.
    cols.push({ strip, pos: 10 });
    strip.style.transform = 'translateY(-10em)';
  }

  function roll(col, digit, dir) {
    let target;
    if (dir > 0)      target = digit + 10 > col.pos ? digit + 10 : digit + 20;
    else if (dir < 0) target = digit + 10 < col.pos ? digit + 10 : digit;
    else              target = digit + 10;
    if (target === col.pos) return;
    col.pos = target;
    const rest = digit + 10;
    if (reduce) {
      col.strip.style.transition = 'none';
      col.strip.style.transform = 'translateY(-' + rest + 'em)';
      col.pos = rest;
      return;
    }
    col.strip.style.transition = 'transform .42s cubic-bezier(.22,1,.36,1)';
    col.strip.style.transform = 'translateY(-' + target + 'em)';
    // Slide back to the middle copy with the transition off, so the next roll
    // always has a full copy of the strip in either direction.
    const settle = () => {
      col.strip.removeEventListener('transitionend', settle);
      if (col.pos !== target) return;      // a newer roll already took over
      col.strip.style.transition = 'none';
      col.strip.style.transform = 'translateY(-' + rest + 'em)';
      col.pos = rest;
      void col.strip.offsetHeight;         // commit before the next transition
    };
    col.strip.addEventListener('transitionend', settle);
  }

  let shown = null;
  function show(year) {
    if (year === shown) return;
    const dir = shown === null ? 0 : Math.sign(year - shown);
    const s = String(year).padStart(COLS, '0');
    for (let i = 0; i < COLS; i++) roll(cols[i], Number(s[i]), dir);
    shown = year;
  }

  // ── what am I looking at ────────────────────────────────────────────────
  // The card nearest the reading line, then the date at the point the line
  // crosses it. Vertical charts run newest-at-top, so the top edge is the
  // later date; horizontal ones read left to right, so it is the earlier one.
  // The chart's own year ticks are the source of truth wherever they exist:
  // reading between them means the number always agrees with the axis sitting
  // right beside it, including across the empty stretches where no card is
  // near the line but time is still passing.
  function scaleFromTicks(horizontal) {
    const pts = [];
    chart.querySelectorAll('.tl-tick').forEach((t) => {
      const year = parseInt(t.textContent, 10);
      if (!isFinite(year)) return;                 // the "Now" tick has no year
      const b = t.getBoundingClientRect();
      if (!b.width && !b.height) return;           // hidden in list mode
      pts.push({ year, at: horizontal ? b.left + b.width / 2 : b.top });
    });
    pts.sort((a, b) => a.at - b.at);
    return pts.length >= 2 ? pts : null;
  }

  function alongScale(pts, ref) {
    let lo = pts[0], hi = pts[pts.length - 1];
    for (let i = 0; i < pts.length - 1; i++) {
      if (ref >= pts[i].at && ref <= pts[i + 1].at) { lo = pts[i]; hi = pts[i + 1]; break; }
    }
    // Past either end, the nearest pair's slope carries on rather than clamping,
    // then the result is held inside the real span.
    if (ref < pts[0].at)                    { lo = pts[0]; hi = pts[1]; }
    else if (ref > pts[pts.length - 1].at)  { lo = pts[pts.length - 2]; hi = pts[pts.length - 1]; }
    const d = hi.at - lo.at;
    const t = d === 0 ? 0 : (ref - lo.at) / d;
    const y = lo.year + (hi.year - lo.year) * t;
    const first = pts[0].year, last = pts[pts.length - 1].year;
    return Math.min(Math.max(y, Math.min(first, last)), Math.max(first, last));
  }

  // Without ticks — the undated mobile list — fall back to the card nearest the
  // line, and read the point the line crosses it between its own two dates.
  function fromNearestCard(horizontal, ref, span) {
    let best = null, bestDist = Infinity;
    for (const it of items) {
      const [a, b] = span(it.el);
      const dist = Math.abs((a + b) / 2 - ref);
      if (dist < bestDist) { bestDist = dist; best = { it, a, b }; }
    }
    if (!best) return null;
    const { it, a, b } = best;
    const t = b === a ? 0 : Math.min(1, Math.max(0, (ref - a) / (b - a)));
    const from = horizontal ? it.sy : it.ey;
    const to   = horizontal ? it.ey : it.sy;
    return from + (to - from) * t;
  }

  function readYear() {
    const horizontal = chart.classList.contains('is-horizontal');
    let ref, span;
    if (horizontal) {
      const r = chart.getBoundingClientRect();
      ref = r.left + r.width / 2;
      span = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.right]; };
    } else {
      ref = window.innerHeight * 0.45;
      span = (el) => { const b = el.getBoundingClientRect(); return [b.top, b.bottom]; };
    }
    const pts = scaleFromTicks(horizontal);
    const y = pts ? alongScale(pts, ref) : fromNearestCard(horizontal, ref, span);
    return y == null ? null : Math.round(y);
  }

  let queued = false;
  function update() {
    queued = false;
    stuckCheck();
    const y = readYear();
    if (y != null && isFinite(y)) show(y);
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  chart.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  // The orientation toggle relays out the whole chart, so re-read after it.
  document.querySelectorAll('.tl-orient-btn').forEach((b) => {
    b.addEventListener('click', () => setTimeout(update, 60));
  });

  update();
})();
