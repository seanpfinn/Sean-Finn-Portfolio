(function () {
  // ── Last updated date ────────────────────────────────────────────────────
  const d = new Date(document.lastModified);
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const day = d.getDate();
  const n = day % 10;
  const suffix = (day >= 11 && day <= 13) ? 'th'
    : n === 1 ? 'st'
    : n === 2 ? 'nd'
    : n === 3 ? 'rd'
    : 'th';
  const label = `Last updated: ${months[d.getMonth()]} ${day}${suffix}, ${d.getFullYear()}`;
  document.querySelectorAll('.last-updated').forEach(el => el.textContent = label);

  // ── Dark mode toggle ─────────────────────────────────────────────────────
  if (localStorage.getItem('dark') === '1') document.documentElement.classList.add('dark');
  document.querySelectorAll('.dark-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = document.documentElement.classList.toggle('dark');
      localStorage.setItem('dark', on ? '1' : '0');
    });
  });

  // ── Custom cursor ────────────────────────────────────────────────────────
  const cursor = document.createElement('div');
  cursor.className = 'custom-cursor';
  document.body.appendChild(cursor);
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
  });

  // ── Clock ────────────────────────────────────────────────────────────────
  function tick() {
    const now = new Date();
    let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const str = `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} ${ampm}`;
    ['clock','clock-mobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = str;
    });
  }
  tick();
  setInterval(tick, 1000);
  // ── Tab navigation filter switching ────────────────────────────────────
  let activeFilter = 'all';

  function updateThumb() {
    const thumb = document.getElementById('tab-nav-thumb');
    const activeBtn = document.querySelector('.tab-item--active');
    const nav = document.querySelector('.tab-nav');
    if (!thumb || !activeBtn || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    thumb.style.left   = (btnRect.left - navRect.left) + 'px';
    thumb.style.top    = (btnRect.top  - navRect.top)  + 'px';
    thumb.style.width  = btnRect.width  + 'px';
    thumb.style.height = btnRect.height + 'px';
  }

  function setTabActive(filter) {
    document.querySelectorAll('.tab-item').forEach(item => {
      item.classList.toggle('tab-item--active', item.dataset.filter === filter);
    });
    updateThumb();
  }

  function applyFilter(next) {
    if (next === activeFilter) return;

    const allCards = document.querySelectorAll('.card[data-section="projects"]');
    let visibleIndex = 0;

    allCards.forEach(card => {
      const tags = (card.dataset.tags || '').split(',');
      const show = next === 'all'
        || (next === 'apps' && tags.includes('app'))
        || (next === 'case-studies' && tags.includes('case-study'));

      if (show) {
        card.hidden = false;
        card.style.animationDelay = `${visibleIndex * 0.07}s`;
        card.classList.remove('card-reveal');
        void card.offsetWidth;
        card.classList.add('card-reveal');
        visibleIndex++;
      } else {
        card.hidden = true;
        card.classList.remove('card-reveal');
      }
    });

    activeFilter = next;
    setTabActive(next);
  }

  // Initial thumb placement (no transition on first render)
  const thumb = document.getElementById('tab-nav-thumb');
  if (thumb) thumb.style.transition = 'none';
  setTabActive('all');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (thumb) thumb.style.transition = '';
  }));

  document.querySelectorAll('.tab-item').forEach(item => {
    item.addEventListener('click', () => applyFilter(item.dataset.filter));
  });

  // ── Mobile swipe to change tabs ──────────────────────────────────────────
  const filterOrder = ['all', 'apps', 'case-studies'];

  function shiftTab(dir) {
    const idx = filterOrder.indexOf(activeFilter);
    applyFilter(filterOrder[(idx + dir + filterOrder.length) % filterOrder.length]);
  }

  let swipeX = 0, swipeY = 0;
  document.addEventListener('touchstart', e => {
    swipeX = e.touches[0].clientX;
    swipeY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (window.innerWidth > 809) return;
    const dx = e.changedTouches[0].clientX - swipeX;
    const dy = e.changedTouches[0].clientY - swipeY;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      shiftTab(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  // ── GitHub tooltip ───────────────────────────────────────────────────────
  const ghLinks = document.querySelectorAll('a[href="https://github.com/seanpfinn"]');
  if (ghLinks.length) {
    const tip = document.createElement('div');
    tip.className = 'gh-tooltip';
    tip.innerHTML = `
      <div class="gh-tip-header">
        <img class="gh-tip-avatar" src="https://avatars.githubusercontent.com/u/193159120?v=4" alt="" />
        <div class="gh-tip-meta">
          <span class="gh-tip-user">seanpfinn</span>
          <span class="gh-tip-stat"><span class="gh-tip-count">–</span> contributions this year</span>
        </div>
      </div>
      <svg class="gh-tip-graph" xmlns="http://www.w3.org/2000/svg"></svg>
    `;
    document.body.appendChild(tip);

    const svg = tip.querySelector('.gh-tip-graph');
    const NS = 'http://www.w3.org/2000/svg';
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function renderGraph(contributions) {
      svg.innerHTML = '';
      if (!contributions.length) return;
      const CELL = 10, GAP = 2, STEP = 12;
      const COLS = 13, ROWS = 7;
      const LABEL_L = 26, LABEL_T = 14;
      const today = new Date(); today.setHours(0,0,0,0);
      const cutoff = new Date(today);
      cutoff.setDate(today.getDate() - COLS * 7);
      const recent = contributions.filter(c => new Date(c.date + 'T00:00:00') >= cutoff);
      if (!recent.length) return;
      const firstDate = new Date(recent[0].date + 'T00:00:00');
      const startSunday = new Date(firstDate);
      startSunday.setDate(firstDate.getDate() - firstDate.getDay());
      const lastDate = new Date(recent[recent.length - 1].date + 'T00:00:00');
      const usedCols = Math.min(Math.floor(Math.round((lastDate - startSunday) / 86400000) / 7) + 1, COLS);
      const LABEL_R = 14;
      const W = LABEL_L + usedCols * STEP - GAP + LABEL_R;
      const H = LABEL_T + ROWS * STEP - GAP;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      function mkText(content, x, y, cls) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x); t.setAttribute('y', y);
        t.setAttribute('class', cls);
        t.textContent = content;
        return t;
      }
      [[1,'Mon'],[3,'Wed'],[5,'Fri']].forEach(([row, label]) => {
        const t = mkText(label, 0, LABEL_T + row * STEP + CELL / 2, 'gh-axis-label');
        t.setAttribute('dominant-baseline', 'middle');
        svg.appendChild(t);
      });
      const monthsFound = [];
      let lastMonth = -1;
      for (let col = 0; col < usedCols; col++) {
        const d = new Date(startSunday);
        d.setDate(startSunday.getDate() + col * 7);
        if (d.getMonth() !== lastMonth) { lastMonth = d.getMonth(); monthsFound.push(MONTHS[lastMonth]); }
      }
      const graphW = usedCols * STEP - GAP;
      monthsFound.forEach((label, i) => {
        const x = LABEL_L + (i / Math.max(monthsFound.length - 1, 1)) * graphW;
        const t = mkText(label, x, LABEL_T - 3, 'gh-axis-label');
        t.setAttribute('text-anchor', i === 0 ? 'start' : i === monthsFound.length - 1 ? 'end' : 'middle');
        svg.appendChild(t);
      });
      recent.forEach(c => {
        const date = new Date(c.date + 'T00:00:00');
        const col = Math.floor(Math.round((date - startSunday) / 86400000) / 7);
        const row = date.getDay();
        if (col >= usedCols) return;
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', LABEL_L + col * STEP);
        rect.setAttribute('y', LABEL_T + row * STEP);
        rect.setAttribute('width', CELL); rect.setAttribute('height', CELL);
        rect.setAttribute('rx', 2);
        rect.setAttribute('class', `gh-cell--${c.level}`);
        svg.appendChild(rect);
      });
    }

    let fetched = false;
    async function loadGH() {
      if (fetched) return; fetched = true;
      try {
        const res = await fetch('https://github-contributions-api.jogruber.de/v4/seanpfinn?y=last');
        const data = await res.json();
        tip.querySelector('.gh-tip-count').textContent = (data.total.lastYear || 0).toLocaleString();
        renderGraph(data.contributions || []);
      } catch (e) {}
    }

    function positionTip(link) {
      const r = link.getBoundingClientRect();
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let left = r.left + r.width / 2 - tw / 2 + window.scrollX;
      left = Math.max(8 + window.scrollX, Math.min(left, window.scrollX + window.innerWidth - tw - 8));
      tip.style.left = left + 'px';
      tip.style.top  = (r.top + window.scrollY - th - 10) + 'px';
    }

    loadGH();

    ghLinks.forEach(link => {
      link.addEventListener('mouseenter', () => { tip.classList.add('is-visible'); positionTip(link); });
      link.addEventListener('mouseleave', () => tip.classList.remove('is-visible'));
    });
  }

  // ── Work menu toggle ─────────────────────────────────────────────────────
  const workBtn    = document.getElementById('nav-work-btn');
  const workWrap   = document.getElementById('nav-work-submenu-wrap');
  const navLinks   = document.getElementById('splash-nav-links');
  const workCaret  = document.getElementById('nav-work-caret');

  if (workBtn) {
    workBtn.addEventListener('click', () => {
      const isOpen = workBtn.getAttribute('aria-expanded') === 'true';
      const next = !isOpen;
      workBtn.setAttribute('aria-expanded', next);
      if (workWrap)  workWrap.classList.toggle('is-open', next);
      if (navLinks)  navLinks.classList.toggle('is-open', next);
      if (workCaret) workCaret.classList.toggle('is-open', next);
    });

    document.addEventListener('click', e => {
      if (!navLinks || !navLinks.classList.contains('is-open')) return;
      if (navLinks.contains(e.target)) return;
      workBtn.setAttribute('aria-expanded', 'false');
      if (workWrap)  workWrap.classList.remove('is-open');
      navLinks.classList.remove('is-open');
      if (workCaret) workCaret.classList.remove('is-open');
    });
  }

})();

// ── Scroll-driven infinite gallery ────────────────────────────────────────
(function () {
  const track = document.getElementById('gallery-track');
  if (!track) return;

  const CARD_W   = 640;
  const GAP      = 24;
  const PAD      = 10;
  const MAX_ANG  = 25;    // max rotation in degrees at the edges
  const PERSP    = 1000;  // perspective distance in px
  const EASE     = 0.12;  // how quickly motion catches up to scroll input

  // Duplicate the card set so the track can wrap seamlessly in both directions
  const originals = Array.from(track.querySelectorAll('.gallery-card'));
  const N         = originals.length;
  originals.forEach(card => track.appendChild(card.cloneNode(true)));
  const cards     = track.querySelectorAll('.gallery-card');
  // Suppress CSS transition so JS-driven per-frame rotation is instantaneous
  cards.forEach(card => { card.style.transition = 'none'; });

  // Width of one full set (each card occupies width + trailing gap)
  const oneSet = N * (CARD_W + GAP);

  // Start one card back so the last card sits to the left of the first
  let target  = oneSet - (CARD_W + GAP);
  let current = oneSet - (CARD_W + GAP);

  function render() {
    const wrapped = current; // loop() keeps current in [0, oneSet)
    const tx = -wrapped;
    track.style.transform = 'translateX(' + tx + 'px)';

    // Convex rotation: each card rotates based on its distance from viewport centre
    const vpCenter = window.innerWidth / 2;
    const range    = vpCenter + CARD_W / 2;

    cards.forEach((card, i) => {
      const cardCenter = PAD + i * (CARD_W + GAP) + CARD_W / 2 + tx;
      const dist  = cardCenter - vpCenter;
      const t     = dist / range;
      const angle = Math.max(-MAX_ANG, Math.min(MAX_ANG, -t * MAX_ANG));
      const tz    = -(t * t) * 60;
      card.style.transform =
        'perspective(' + PERSP + 'px) rotateY(' + angle + 'deg) translateZ(' + tz + 'px)';
    });
  }

  function loop() {
    current += (target - current) * EASE; // smooth follow; settles when input stops
    // Keep current (and target by same offset) in [0, oneSet) — prevents float drift
    // and ensures the modulo jump never causes a visible frame artifact
    if (current >= oneSet) { current -= oneSet; target -= oneSet; }
    else if (current < 0)  { current += oneSet; target += oneSet; }
    render();
    requestAnimationFrame(loop);
  }

  // Wheel / trackpad drives the carousel horizontally (page itself doesn't scroll)
  window.addEventListener('wheel', e => {
    e.preventDefault();
    target += Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
  }, { passive: false });

  // Touch drag for mobile
  let touchX = 0, touchY = 0;
  window.addEventListener('touchstart', e => {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - touchX;
    const dy = e.touches[0].clientY - touchY;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
    // Use whichever axis dominates; drag left/up advances the carousel
    target -= Math.abs(dx) >= Math.abs(dy) ? dx : dy;
    e.preventDefault();
  }, { passive: false });

  render();
  requestAnimationFrame(loop);
  window.addEventListener('resize', render, { passive: true });
})();
