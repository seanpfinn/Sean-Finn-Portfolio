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
