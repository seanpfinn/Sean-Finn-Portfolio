// ── Career timeline ───────────────────────────────────────────────────────
// Every card and year rule is positioned from a single linear time scale, so
// the chart stays truthful as dates change and "Present" roles keep growing.
// Nothing here is hand-placed.

(function () {
  const chart = document.getElementById('tl-chart');
  const list  = document.getElementById('tl-list');
  const axis  = document.getElementById('tl-axis');
  if (!chart || !list || !axis) return;

  const PX_PER_YEAR = 80;    // matches the design's year spacing
  const MIN_H       = 76;    // a short role still needs room for its text
  const LANE_GAP    = 10;    // px between side-by-side lanes
  const MS_YEAR     = 365.2425 * 24 * 60 * 60 * 1000;

  const now = new Date();

  // "YYYY-MM" -> Date at the first of that month. Empty means "still going".
  function parse(v) {
    if (!v) return now;
    const [y, m] = v.split('-').map(Number);
    return new Date(y, (m || 1) - 1, 1);
  }

  const items = Array.from(list.querySelectorAll('.tl-item')).map((el) => {
    const start = parse(el.dataset.start);
    const end   = parse(el.dataset.end);
    return { el, start, end, current: !el.dataset.end };
  });
  if (!items.length) return;

  // The scale runs from January of the earliest year up to today.
  const earliest = items.reduce((a, i) => (i.start < a ? i.start : a), items[0].start);
  const rangeStart = new Date(earliest.getFullYear(), 0, 1);
  const total = ((now - rangeStart) / MS_YEAR) * PX_PER_YEAR;

  // y grows downward into the past: 0 is now, `total` is the range start.
  const y = (date) => ((now - date) / MS_YEAR) * PX_PER_YEAR;

  // ── Year rules ──────────────────────────────────────────────────────────
  const frag = document.createDocumentFragment();
  function tick(top, label, cls) {
    const d = document.createElement('div');
    d.className = 'tl-tick' + (cls ? ' ' + cls : '');
    d.style.top = top + 'px';
    const s = document.createElement('span');
    s.textContent = label;
    d.appendChild(s);
    frag.appendChild(d);
  }
  tick(0, 'Now', 'tl-tick--now');
  for (let yr = now.getFullYear(); yr >= rangeStart.getFullYear(); yr--) {
    const top = y(new Date(yr, 0, 1));
    // Skip a year rule that would collide with the "Now" label.
    if (top > 14 && top <= total) tick(top, String(yr));
  }
  axis.appendChild(frag);

  // ── Lanes ───────────────────────────────────────────────────────────────
  // Roles overlap (freelance runs alongside staff work), so cards are laid
  // into parallel lanes. Lanes are worked out per cluster of overlapping
  // roles, so a role that overlaps nothing still gets the full width.
  items.forEach((i) => {
    i.top = y(i.end);
    i.height = Math.max(MIN_H, y(i.start) - y(i.end));
    i.bottom = i.top + i.height;
  });
  items.sort((a, b) => a.top - b.top);

  const clusters = [];
  let cluster = null;
  for (const it of items) {
    if (cluster && it.top < cluster.bottom) {
      cluster.items.push(it);
      cluster.bottom = Math.max(cluster.bottom, it.bottom);
    } else {
      cluster = { items: [it], bottom: it.bottom };
      clusters.push(cluster);
    }
  }

  for (const c of clusters) {
    const laneEnds = [];
    for (const it of c.items) {
      let lane = laneEnds.findIndex((end) => it.top >= end);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = it.bottom;
      it.lane = lane;
    }
    c.lanes = laneEnds.length;
    for (const it of c.items) it.lanes = c.lanes;
  }

  // ── Place ───────────────────────────────────────────────────────────────
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const label = (d) => MONTHS[d.getMonth()] + ' ' + d.getFullYear();

  for (const it of items) {
    const pct = 100 / it.lanes;
    it.el.style.top    = it.top + 'px';
    it.el.style.height = it.height + 'px';
    it.el.style.left   = `calc(${it.lane * pct}% + ${it.lane ? LANE_GAP / 2 : 0}px)`;
    it.el.style.width  = it.lanes > 1
      ? `calc(${pct}% - ${LANE_GAP / 2}px)`
      : '100%';

    const dates = it.el.querySelector('.tl-dates');
    if (dates) {
      dates.textContent = it.el.classList.contains('tl-item--point')
        ? label(it.start)
        : label(it.start) + ' — ' + (it.current ? 'Present' : label(it.end));
    }
  }

  list.style.height = total + 'px';
  chart.style.height = total + 'px';
})();
