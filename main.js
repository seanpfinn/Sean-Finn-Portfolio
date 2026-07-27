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

  // ── Live weather (New York) ──────────────────────────────────────────────
  // Minimal line icons matching the original "Foggy" mark (thin monochrome
  // strokes, currentColor so they adapt to light/dark automatically).
  const _wx = (paths) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  const WX_ICONS = {
    sun:   _wx('<circle cx="12" cy="12" r="4.2"/><path d="M12 1.5v2.2M12 20.3v2.2M1.5 12h2.2M20.3 12h2.2M4.5 4.5l1.6 1.6M17.9 17.9l1.6 1.6M19.5 4.5l-1.6 1.6M6.1 17.9l-1.6 1.6"/>'),
    moon:  _wx('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
    cloud: _wx('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'),
    fog:   _wx('<path d="M7.5 6h9M4.5 9.5h12M6.5 13h13M3.5 16.5h12M8 20h9"/>'),
    rain:  _wx('<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><path d="M8 14v5M16 14v5M12 16v5"/>'),
    snow:  _wx('<path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><path d="M8 16v.01M8 20v.01M12 18v.01M12 22v.01M16 16v.01M16 20v.01"/>'),
    storm: _wx('<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><path d="M13 11l-4 6h6l-4 6"/>'),
  };

  function weatherInfo(code, isDay) {
    const clear = isDay ? 'sun' : 'moon';
    const map = {
      0:  ['Clear',            clear],
      1:  ['Mainly clear',     clear],
      2:  ['Partly cloudy',    'cloud'],
      3:  ['Overcast',         'cloud'],
      45: ['Fog',              'fog'], 48: ['Fog', 'fog'],
      51: ['Drizzle',          'rain'], 53: ['Drizzle', 'rain'], 55: ['Drizzle', 'rain'],
      56: ['Freezing drizzle', 'rain'], 57: ['Freezing drizzle', 'rain'],
      61: ['Rain',             'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
      66: ['Freezing rain',    'rain'], 67: ['Freezing rain', 'rain'],
      71: ['Snow',             'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
      80: ['Rain showers',     'rain'], 81: ['Rain showers', 'rain'], 82: ['Heavy showers', 'rain'],
      85: ['Snow showers',     'snow'], 86: ['Snow showers', 'snow'],
      95: ['Thunderstorm',     'storm'], 96: ['Thunderstorm', 'storm'], 99: ['Thunderstorm', 'storm'],
    };
    return map[code] || ['', 'cloud'];
  }

  (async function loadWeather() {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=America/New_York');
      const data = await res.json();
      const c = data.current;
      const [label, iconKey] = weatherInfo(c.weather_code, c.is_day);
      const temp = Math.round(c.temperature_2m) + '°F';
      document.querySelectorAll('.weather-temp').forEach(el => el.textContent = temp);
      document.querySelectorAll('.weather-cond').forEach(el => el.textContent = label);
      document.querySelectorAll('.weather-icon').forEach(el => {
        el.innerHTML = WX_ICONS[iconKey] || WX_ICONS.cloud;
        el.setAttribute('aria-label', label);
      });
    } catch (e) {}
  })();
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
          <span class="gh-tip-stat"><span class="gh-tip-count">–</span> contributions <span class="gh-tip-range">in the last 90 days</span></span>
        </div>
        <div class="gh-tip-filter" role="group" aria-label="Timeframe">
          <button type="button" class="gh-tip-tf" data-tf="30">30D</button>
          <button type="button" class="gh-tip-tf is-active" data-tf="90">90D</button>
          <button type="button" class="gh-tip-tf" data-tf="365">1Y</button>
        </div>
      </div>
      <svg class="gh-tip-graph" xmlns="http://www.w3.org/2000/svg"></svg>
      <div class="gh-tip-stats">
        <div class="gh-tip-stat-item"><span class="gh-tip-stat-value" data-stat="contrib">–</span><span class="gh-tip-stat-label">Contributions</span></div>
        <div class="gh-tip-stat-item"><span class="gh-tip-stat-value" data-stat="active">–</span><span class="gh-tip-stat-label">Active days</span></div>
        <div class="gh-tip-stat-item"><span class="gh-tip-stat-value" data-stat="streak">–</span><span class="gh-tip-stat-label">Longest streak</span></div>
        <div class="gh-tip-stat-item"><span class="gh-tip-stat-value" data-stat="busiest">–</span><span class="gh-tip-stat-label">Busiest day</span></div>
      </div>
    `;
    // Lives above the content as a fixed overlay — never added to the page
    // flow beneath the footer (which would extend the scroll height).
    document.body.insertBefore(tip, document.body.firstChild);

    const svg = tip.querySelector('.gh-tip-graph');
    const NS = 'http://www.w3.org/2000/svg';
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Trailing 365 days of contributions ({date,count,level}); the 30/90/365-day
    // views all slice from this one dataset. Filled by loadGH().
    let allDays = [];
    let currentTf = 90;   // selected timeframe in days
    const TF_LABEL = { 30: 'in the last 30 days', 90: 'in the last 90 days', 365: 'in the last year' };

    // Filled by renderGraph; read by the pointer-driven glow below. Each entry
    // is { cx, cy, glow } in viewBox units.
    let glowCells = [];

    // Contribution heatmap with a month axis (x, top) and weekday axis (y, left),
    // sized to a constant viewBox so labels stay the same size across timeframes.
    const VB_W = 340, VB_H = 125, ROWS = 7;
    const AX_L = 24, AX_T = 13;      // gutters for the y-axis (weekdays) / x-axis (months)
    const AX_FONT = 7;               // axis label size, in viewBox units
    let glowStep = 12;               // cell pitch of the current render, for the glow radius
    function renderGraph(tf) {
      svg.innerHTML = '';
      glowCells = [];
      if (!allDays.length) return;

      const byDate = {};
      allDays.forEach(c => { byDate[c.date] = c.level; });

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const endSunday = new Date(today);
      endSunday.setDate(today.getDate() - today.getDay());
      const winStart = new Date(today);
      winStart.setDate(today.getDate() - (tf - 1));
      const startSunday = new Date(winStart);
      startSunday.setDate(winStart.getDate() - winStart.getDay());
      const COLS = Math.round((endSunday - startSunday) / (7 * 864e5)) + 1;

      svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);

      // The plot area is a fixed box (right of the y-axis, below the x-axis); the
      // grid always fills it, so the chart's footprint never changes. Cells scale
      // to the timeframe — wide for 30 days, narrow for a full year. Row height is
      // constant (7 rows), column width shrinks as more weeks are shown.
      const xOff = AX_L, yOff = AX_T;
      const cellW = (VB_W - AX_L) / COLS;
      const cellH = (VB_H - AX_T) / ROWS;
      glowStep = cellH;   // constant → the spotlight stays the same size across timeframes
      const gap = Math.min(cellW, cellH) * 0.16;
      const rectW = cellW - gap, rectH = cellH - gap;
      const rx = Math.min(rectW, rectH) * 0.3;

      function mkText(txt, x, y, anchor) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x); t.setAttribute('y', y);
        t.setAttribute('class', 'gh-axis-label');
        t.setAttribute('font-size', AX_FONT);
        t.setAttribute('text-anchor', anchor);
        t.textContent = txt;
        return t;
      }

      // Y-axis: weekday labels (Mon / Wed / Fri), aligned to their rows.
      [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']].forEach(([row, label]) => {
        const t = mkText(label, AX_L - 4, yOff + row * cellH + cellH / 2, 'end');
        t.setAttribute('dominant-baseline', 'middle');
        svg.appendChild(t);
      });

      // X-axis: month labels at the column where each new month begins. Skip the
      // leading partial month (a thin sliver at the left whose label would land
      // over the next month) and keep a min column gap so labels never collide.
      const minGap = Math.max(2, Math.ceil((AX_FONT * 2.2) / cellW));
      let lastMonth = -1, lastLabelCol = -99;
      for (let col = 0; col < COLS; col++) {
        const d = new Date(startSunday);
        d.setDate(startSunday.getDate() + col * 7);
        const m = d.getMonth();
        if (m !== lastMonth) {
          lastMonth = m;
          const isLeadingSliver = col === 0 && d.getDate() > 7;
          if (!isLeadingSliver && col - lastLabelCol >= minGap) {
            svg.appendChild(mkText(MONTHS[m], xOff + col * cellW, yOff - 4, 'start'));
            lastLabelCol = col;
          }
        }
      }

      const glowRects = [];
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          const d = new Date(startSunday);
          d.setDate(startSunday.getDate() + col * 7 + row);
          if (d > today) continue;
          const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const level = byDate[dateStr] ?? 0;
          const x = xOff + col * cellW, y = yOff + row * cellH;
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', x); rect.setAttribute('y', y);
          rect.setAttribute('width', rectW); rect.setAttribute('height', rectH);
          rect.setAttribute('rx', rx);
          rect.setAttribute('class', `gh-cell--${level}`);
          svg.appendChild(rect);

          // Matching glow overlay, drawn on top of every base cell below.
          const glow = document.createElementNS(NS, 'rect');
          glow.setAttribute('x', x); glow.setAttribute('y', y);
          glow.setAttribute('width', rectW); glow.setAttribute('height', rectH);
          glow.setAttribute('rx', rx);
          glow.setAttribute('class', 'gh-cell-glow');
          glowRects.push(glow);
          glowCells.push({ cx: x + rectW / 2, cy: y + rectH / 2, glow });
        }
      }
      glowRects.forEach(g => svg.appendChild(g));
    }

    // Real, timeframe-aware stats from the daily contribution counts.
    function renderStats(tf) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const start = new Date(today);
      start.setDate(today.getDate() - (tf - 1));
      const startStr = start.toISOString().slice(0, 10);
      const win = allDays.filter(c => c.date >= startStr && c.count != null);

      let total = 0, active = 0, streak = 0, best = 0, busiest = null;
      for (const c of win) {
        total += c.count;
        if (c.count > 0) { active++; streak++; if (streak > best) best = streak; }
        else streak = 0;
        if (!busiest || c.count > busiest.count) busiest = c;
      }

      const set = (name, val) => {
        const el = tip.querySelector(`[data-stat="${name}"]`);
        if (el) el.textContent = val;
      };
      set('contrib', total.toLocaleString());
      set('active', String(active));
      set('streak', String(best));
      set('busiest', busiest && busiest.count > 0 ? String(busiest.count) : '—');

      // Header count + range reflect the selected window too.
      tip.querySelector('.gh-tip-count').textContent = total.toLocaleString();
      tip.querySelector('.gh-tip-range').textContent = TF_LABEL[tf];
    }

    function render(tf) {
      currentTf = tf;
      renderGraph(tf);
      renderStats(tf);
      tip.querySelectorAll('.gh-tip-tf').forEach(b => {
        b.classList.toggle('is-active', Number(b.dataset.tf) === tf);
      });
    }

    // ── Cursor-following glow ────────────────────────────────────────────────
    // Brighten cells by proximity to the pointer, brightest under the cursor and
    // fading out within ~3.5 cells, so the grid lights up like a fidget toy.
    const GLOW_MAX = 0.85;    // peak overlay opacity
    let glowRaf = 0, glowX = 0, glowY = 0;
    function paintGlow() {
      glowRaf = 0;
      const radius = glowStep * 3.5;   // ~3.5 cells, tracks the current cell size
      for (const c of glowCells) {
        const dx = c.cx - glowX, dy = c.cy - glowY;
        let inf = 1 - Math.hypot(dx, dy) / radius;
        inf = inf > 0 ? inf * inf : 0;   // ease-in falloff
        c.glow.style.opacity = inf ? (inf * GLOW_MAX).toFixed(3) : '';
      }
    }
    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      if (!vb || !r.width) return;
      glowX = (e.clientX - r.left) / r.width * vb.width;
      glowY = (e.clientY - r.top) / r.height * vb.height;
      if (!glowRaf) glowRaf = requestAnimationFrame(paintGlow);
    });
    svg.addEventListener('pointerleave', () => {
      if (glowRaf) { cancelAnimationFrame(glowRaf); glowRaf = 0; }
      for (const c of glowCells) c.glow.style.opacity = '';
    });

    // Filter buttons switch the timeframe (re-renders graph + stats).
    tip.querySelectorAll('.gh-tip-tf').forEach(btn => {
      btn.addEventListener('click', () => {
        const tf = Number(btn.dataset.tf);
        if (allDays.length && tf !== currentTf) render(tf);
      });
    });

    let fetched = false;
    async function loadGH() {
      if (fetched) return; fetched = true;
      try {
        // y=last returns the trailing 365 days — one fetch feeds every timeframe.
        const res = await fetch('https://github-contributions-api.jogruber.de/v4/seanpfinn?y=last');
        const data = await res.json();
        allDays = (data.contributions || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
        render(currentTf);
      } catch (e) {}
    }

    function positionTip(link) {
      const r = link.getBoundingClientRect();
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      // Fixed positioning is viewport-relative, matching getBoundingClientRect.
      let left = r.left + r.width / 2 - tw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
      tip.style.left = left + 'px';
      tip.style.top  = (r.top - th - 10) + 'px';
    }

    loadGH();

    // Keep the tooltip open while the cursor is over it (not just the link), so
    // the grid can be hovered. A small close delay bridges the gap between the
    // link and the tooltip floating above it.
    let hideTimer = 0;
    function showTip(link) { clearTimeout(hideTimer); tip.classList.add('is-visible'); positionTip(link); }
    function scheduleHide() { hideTimer = setTimeout(() => tip.classList.remove('is-visible'), 160); }

    ghLinks.forEach(link => {
      link.addEventListener('mouseenter', () => showTip(link));
      link.addEventListener('mouseleave', scheduleHide);
    });
    tip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    tip.addEventListener('mouseleave', scheduleHide);
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

  // ── Mobile nav scroll glass ──────────────────────────────────────────────
  const splashNav = document.querySelector('.splash-nav');
  if (splashNav) {
    const onScroll = () => splashNav.classList.toggle('scrolled', window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Mobile hamburger toggle ───────────────────────────────────────────────
  const hamburger = document.getElementById('nav-hamburger');
  if (hamburger && navLinks) {
    // Force-finish the one-time entrance animation before the overlay opens.
    // Toggling `animation: none` on/off for the menu-open state would
    // otherwise replay the keyframes (from -> to) every time it's re-applied,
    // making the navbar appear to fade back in each time the menu closes.
    const settleNavEntrance = () => { if (splashNav) splashNav.classList.remove('blur-in'); };
    if (splashNav) splashNav.addEventListener('animationend', settleNavEntrance, { once: true });

    const setMenuOpen = (open) => {
      if (open) settleNavEntrance();
      hamburger.classList.toggle('is-open', open);
      hamburger.setAttribute('aria-expanded', String(open));
      navLinks.classList.toggle('mobile-open', open);
      if (splashNav) splashNav.classList.toggle('menu-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };

    hamburger.addEventListener('click', () => {
      setMenuOpen(!hamburger.classList.contains('is-open'));
    });

    navLinks.addEventListener('click', e => {
      if (e.target.closest('a')) setMenuOpen(false);
    });

    const closeBtn = document.getElementById('nav-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => setMenuOpen(false));
    }
  }

  // ── Play videos when scrolled into view (no loop) ─────────────────────────
  const inViewVideos = document.querySelectorAll('video[data-play-in-view]');
  if (inViewVideos.length) {
    const vidObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const vid = entry.target;
        if (entry.isIntersecting) {
          if (vid.ended) vid.currentTime = 0;
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      });
    }, { threshold: 0.4 });
    inViewVideos.forEach(vid => vidObserver.observe(vid));
  }

  // ── Pan & zoom (scroll/pinch to zoom, drag to pan) ────────────────────────
  function initPanZoom(container) {
    // The pannable/zoomable target is the container's first child — a neutral
    // full-bleed wrapper (.proj-zoom-target) with no transform of its own, so
    // whatever responsive positioning lives inside it (which may differ
    // between desktop and mobile) is untouched by the pan/zoom transform.
    const target = container.firstElementChild;
    if (!target) return;

    const minScale = 1;
    const maxScale = 4;
    let scale = 1;
    let originX = 0;
    let originY = 0;
    const pointers = new Map();
    let lastDist = null;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function apply() {
      target.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
      container.style.cursor = scale > minScale ? (dragging ? 'grabbing' : 'grab') : 'zoom-in';
    }

    function clamp() {
      const rect = container.getBoundingClientRect();
      const maxX = (rect.width * (scale - 1)) / 2 + rect.width * 0.15;
      const maxY = (rect.height * (scale - 1)) / 2 + rect.height * 0.15;
      originX = Math.max(-maxX, Math.min(maxX, originX));
      originY = Math.max(-maxY, Math.min(maxY, originY));
    }

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const prevScale = scale;
      const delta = -e.deltaY * 0.0015;
      scale = Math.min(maxScale, Math.max(minScale, scale * (1 + delta)));
      const factor = scale / prevScale;
      originX = cx - (cx - originX) * factor;
      originY = cy - (cy - originY) * factor;
      if (scale === minScale) { originX = 0; originY = 0; }
      clamp();
      apply();
    }, { passive: false });

    container.addEventListener('pointerdown', (e) => {
      container.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (pointers.size === 2) {
        dragging = false;
        const pts = [...pointers.values()];
        lastDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
      apply();
    });

    container.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (lastDist) {
          const prevScale = scale;
          scale = Math.min(maxScale, Math.max(minScale, scale * (dist / lastDist)));
          const factor = scale / prevScale;
          originX *= factor;
          originY *= factor;
        }
        lastDist = dist;
        clamp();
        apply();
      } else if (dragging && scale > minScale) {
        originX += e.clientX - lastX;
        originY += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        clamp();
        apply();
      } else if (dragging) {
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastDist = null;
      if (pointers.size === 0) dragging = false;
      apply();
    }
    container.addEventListener('pointerup', endPointer);
    container.addEventListener('pointercancel', endPointer);
    container.addEventListener('pointerleave', (e) => { if (pointers.size <= 1) endPointer(e); });

    container.addEventListener('dblclick', () => {
      scale = scale > minScale ? minScale : 2;
      originX = 0;
      originY = 0;
      apply();
    });

    container.style.touchAction = 'none';
    apply();
  }
  document.querySelectorAll('.proj-panel-zoomable').forEach(initPanZoom);

  // ── Miniplayer (every page) ─────────────────────────────────────────────
  // To connect a YouTube Music playlist: paste its playlist ID below.
  // Find it in the playlist's share URL, e.g.
  //   https://music.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxx
  //                                            ^^^^^^^^^^^^^^^^^^ this part
  // YouTube Music playlists share the same catalog/IDs as youtube.com, so
  // the IFrame Player API (no API key needed) can play it directly.
  const YT_PLAYLIST_ID = 'PLEDQcLdU2FpQ';

  if (YT_PLAYLIST_ID && !document.getElementById('miniplayer')) {
    const SKIP_BACK_PATH = 'M19.5 4.48875V19.5112C19.4972 19.7772 19.4237 20.0376 19.2872 20.2658C19.1506 20.494 18.9558 20.6818 18.7227 20.8099C18.4896 20.938 18.2267 21.0019 17.9608 20.9949C17.695 20.988 17.4357 20.9105 17.2097 20.7703L6 13.7597V20.25C6 20.4489 5.92098 20.6397 5.78033 20.7803C5.63968 20.921 5.44891 21 5.25 21C5.05109 21 4.86032 20.921 4.71967 20.7803C4.57902 20.6397 4.5 20.4489 4.5 20.25V3.75C4.5 3.55109 4.57902 3.36032 4.71967 3.21967C4.86032 3.07902 5.05109 3 5.25 3C5.44891 3 5.63968 3.07902 5.78033 3.21967C5.92098 3.36032 6 3.55109 6 3.75V10.2403L17.2097 3.22969C17.4354 3.08797 17.695 3.00918 17.9614 3.00146C18.2278 2.99374 18.4915 3.05737 18.7251 3.18578C18.9586 3.31418 19.1536 3.50269 19.2899 3.73178C19.4261 3.96086 19.4987 4.22221 19.5 4.48875Z';
    const PLAY_PATH = 'M22.5 12C22.5006 12.2546 22.4353 12.5051 22.3105 12.7271C22.1856 12.949 22.0055 13.1349 21.7875 13.2666L8.28 21.5297C8.05227 21.6691 7.79144 21.7453 7.52445 21.7502C7.25746 21.7552 6.99399 21.6887 6.76125 21.5578C6.53073 21.4289 6.3387 21.241 6.2049 21.0132C6.07111 20.7855 6.00039 20.5263 6 20.2622V3.73781C6.00039 3.4737 6.07111 3.21447 6.2049 2.98675C6.3387 2.75904 6.53073 2.57108 6.76125 2.44219C6.99399 2.31126 7.25746 2.24484 7.52445 2.24979C7.79144 2.25473 8.05227 2.33086 8.28 2.47031L21.7875 10.7334C22.0055 10.8651 22.1856 11.051 22.3105 11.2729C22.4353 11.4949 22.5006 11.7453 22.5 12Z';
    const PAUSE_PATH = 'M20.25 4.5V19.5C20.25 19.8978 20.092 20.2794 19.8107 20.5607C19.5294 20.842 19.1478 21 18.75 21H15C14.6022 21 14.2206 20.842 13.9393 20.5607C13.658 20.2794 13.5 19.8978 13.5 19.5V4.5C13.5 4.10218 13.658 3.72064 13.9393 3.43934C14.2206 3.15804 14.6022 3 15 3H18.75C19.1478 3 19.5294 3.15804 19.8107 3.43934C20.092 3.72064 20.25 4.10218 20.25 4.5ZM9 3H5.25C4.85218 3 4.47064 3.15804 4.18934 3.43934C3.90804 3.72064 3.75 4.10218 3.75 4.5V19.5C3.75 19.8978 3.90804 20.2794 4.18934 20.5607C4.47064 20.842 4.85218 21 5.25 21H9C9.39782 21 9.77936 20.842 10.0607 20.5607C10.342 20.2794 10.5 19.8978 10.5 19.5V4.5C10.5 4.10218 10.342 3.72064 10.0607 3.43934C9.77936 3.15804 9.39782 3 9 3Z';
    const SKIP_FORWARD_PATH = 'M19.5 3.75V20.25C19.5 20.4489 19.421 20.6397 19.2803 20.7803C19.1397 20.921 18.9489 21 18.75 21C18.5511 21 18.3603 20.921 18.2197 20.7803C18.079 20.6397 18 20.4489 18 20.25V13.7597L6.79031 20.7703C6.56456 20.912 6.30504 20.9908 6.0386 20.9985C5.77217 21.0063 5.50852 20.9426 5.27494 20.8142C5.04137 20.6858 4.84636 20.4973 4.71011 20.2682C4.57386 20.0391 4.50132 19.7778 4.5 19.5112V4.48875C4.50132 4.22221 4.57386 3.96086 4.71011 3.73178C4.84636 3.50269 5.04137 3.31418 5.27494 3.18578C5.50852 3.05737 5.77217 2.99374 6.0386 3.00146C6.30504 3.00918 6.56456 3.08797 6.79031 3.22969L18 10.2403V3.75C18 3.55109 18.079 3.36032 18.2197 3.21967C18.3603 3.07902 18.5511 3 18.75 3C18.9489 3 19.1397 3.07902 19.2803 3.21967C19.421 3.36032 19.5 3.55109 19.5 3.75Z';

    const miniplayer = document.createElement('div');
    miniplayer.className = 'miniplayer miniplayer-blur-in';
    miniplayer.id = 'miniplayer';
    miniplayer.innerHTML = `
      <div class="miniplayer-row">
        <div class="miniplayer-main">
          <span class="miniplayer-art">
            <img id="miniplayer-artwork" class="miniplayer-artwork" src="" alt="" />
          </span>
          <span class="miniplayer-meta">
            <span class="miniplayer-title-clip">
              <span class="miniplayer-title" id="miniplayer-title">Music</span>
            </span>
            <span class="miniplayer-artist" id="miniplayer-artist">Connecting…</span>
          </span>
        </div>
        <div class="miniplayer-controls">
          <button class="miniplayer-btn" id="miniplayer-prev" aria-label="Previous track" type="button">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="${SKIP_BACK_PATH}"/></svg>
          </button>
          <button class="miniplayer-btn miniplayer-btn--play" id="miniplayer-playpause" aria-label="Play" aria-pressed="false" type="button">
            <svg class="icon-play" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="${PLAY_PATH}"/></svg>
            <svg class="icon-pause" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="${PAUSE_PATH}"/></svg>
          </button>
          <button class="miniplayer-btn" id="miniplayer-next" aria-label="Next track" type="button">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="${SKIP_FORWARD_PATH}"/></svg>
          </button>
        </div>
      </div>
      <div class="miniplayer-progress" id="miniplayer-progress">
        <span class="miniplayer-progress-track"></span>
        <span class="miniplayer-progress-fill" id="miniplayer-progress-fill"></span>
        <span class="miniplayer-progress-thumb" id="miniplayer-progress-thumb"></span>
        <span class="miniplayer-time" id="miniplayer-time">0:00</span>
      </div>
      <button class="miniplayer-handle" id="miniplayer-handle" type="button" aria-label="Show upcoming tracks" aria-expanded="false">
        <span class="miniplayer-handle-line"></span>
        <span class="miniplayer-handle-line"></span>
      </button>
      <div class="miniplayer-expand" id="miniplayer-expand">
        <p class="miniplayer-upnext-label">Up Next</p>
        <div class="miniplayer-upnext-list" id="miniplayer-upnext-list"></div>
      </div>
    `;
    document.body.appendChild(miniplayer);

    const host = document.createElement('div');
    host.id = 'miniplayer-yt-host';
    host.className = 'miniplayer-yt-host';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);

    const artEl        = miniplayer.querySelector('.miniplayer-art');
    const imgEl         = document.getElementById('miniplayer-artwork');
    const titleEl       = document.getElementById('miniplayer-title');
    const artistEl      = document.getElementById('miniplayer-artist');
    const playBtn        = document.getElementById('miniplayer-playpause');
    const prevBtn        = document.getElementById('miniplayer-prev');
    const nextBtn        = document.getElementById('miniplayer-next');
    const progressEl      = document.getElementById('miniplayer-progress');
    const progressFillEl  = document.getElementById('miniplayer-progress-fill');
    const progressThumbEl = document.getElementById('miniplayer-progress-thumb');
    const timeEl          = document.getElementById('miniplayer-time');
    const handleEl       = document.getElementById('miniplayer-handle');
    const upNextListEl   = document.getElementById('miniplayer-upnext-list');

    let player = null;

    function updateTicker() {
      const clip = titleEl.parentElement;
      clip.classList.remove('is-ticking');
      clip.style.removeProperty('--ticker-shift');
      // Wait a frame so the removed animation/measurement isn't racing the
      // text that was just written in.
      requestAnimationFrame(() => {
        const overflow = titleEl.scrollWidth - clip.clientWidth;
        if (overflow > 4) {
          clip.style.setProperty('--ticker-shift', `-${overflow}px`);
          clip.classList.add('is-ticking');
        }
      });
    }

    // Many YouTube uploads report no channel/author via the player API but
    // follow the "Artist - Title" convention in the video title itself, and
    // separately, YouTube's auto-generated music channels are literally
    // named "<Artist> - Topic" — clean both up before display. Shared by the
    // now-playing metadata and the Up Next list.
    function splitTitleArtist(title, artist) {
      if (!artist && title && title.includes(' - ')) {
        const i = title.indexOf(' - ');
        artist = title.slice(0, i);
        title = title.slice(i + 3);
      }
      if (artist) artist = artist.replace(/\s*[-–]\s*Topic\s*$/i, '');
      return [title, artist];
    }

    function setMeta(rawTitle, rawArtist, videoId) {
      const [title, artist] = splitTitleArtist(rawTitle, rawArtist);
      titleEl.textContent = title || 'Music';
      artistEl.textContent = artist || '';
      if (videoId) {
        imgEl.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        artEl.classList.add('has-art');
      }
      updateTicker();
    }

    function currentVideoId() {
      // We play single videos we pick from our own shuffled order, so the
      // current track is always known locally — no getPlaylist()/index needed.
      if (order.length && tracks.length) return tracks[order[orderPos]] || null;
      return null;
    }

    // Metadata lookup by video ID with no API key, via noembed.com's public
    // oEmbed proxy — see refreshFromPlayer() for why this is needed at all.
    let shownVideoId = null;
    let fetchingVideoId = null;
    function fetchMetaByVideoId(videoId) {
      if (!videoId || fetchingVideoId === videoId) return;
      fetchingVideoId = videoId;
      fetch(`https://noembed.com/embed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`)
        .then((r) => r.json())
        .then((data) => {
          // The track may have changed while this was in flight.
          if (currentVideoId() !== videoId) return;
          setMeta(data.title, data.author_name, videoId);
          shownVideoId = videoId;
        })
        .catch(() => {})
        .finally(() => {
          if (fetchingVideoId === videoId) fetchingVideoId = null;
        });
    }

    function refreshFromPlayer() {
      const videoId = currentVideoId();
      if (!videoId || videoId === shownVideoId) return;
      // getVideoData() is free and synchronous when it works, but YouTube
      // frequently leaves it empty immediately after cueing — it only
      // reliably fills in once the video actually starts buffering, which
      // otherwise meant the title/artist didn't show until Play was
      // pressed. Falling back to the same noembed lookup used for the Up
      // Next list fixes that: it's independent of playback state.
      //
      // Require BOTH title and author before trusting getVideoData: for a
      // freshly cued (unplayed) track it often returns the title with an
      // empty author, which showed the first song with no artist until it
      // started playing. When the author is missing, noembed still has it.
      let data = null;
      try { data = player.getVideoData(); } catch (e) {}
      if (data && data.video_id === videoId && data.title && data.author) {
        setMeta(data.title, data.author, videoId);
        shownVideoId = videoId;
      } else {
        fetchMetaByVideoId(videoId);
      }
    }

    // The case-study page embeds a second, fully-functional Music Box; this id
    // lets the two coordinate so they never play over each other.
    const MB_ID = 'global';
    function setPlaying(isPlaying) {
      miniplayer.classList.toggle('is-playing', isPlaying);
      playBtn.setAttribute('aria-pressed', String(isPlaying));
      playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
      // Tell any other Music Box on the page to pause, so they never overlap.
      if (isPlaying) window.dispatchEvent(new CustomEvent('musicbox:play', { detail: MB_ID }));
    }
    // Pause ourselves when another Music Box (the embedded one) starts playing.
    window.addEventListener('musicbox:play', (e) => {
      if (e.detail !== MB_ID && player && typeof player.pauseVideo === 'function') {
        try { player.pauseVideo(); } catch (err) {}
      }
    });

    // The IFrame API queues playVideo/pauseVideo/next/previousVideo calls
    // internally until the player is actually ready, so these are safe to
    // call as soon as `player` exists — no separate "ready" gate needed.
    function togglePlay() {
      if (!player) return;
      if (player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }

    function formatTime(sec) {
      if (!isFinite(sec) || sec < 0) sec = 0;
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${String(s).padStart(2, '0')}`;
    }

    let isScrubbing = false;

    function renderProgress(pct, seconds) {
      progressFillEl.style.width = pct + '%';
      progressThumbEl.style.left = pct + '%';
      timeEl.style.left = pct + '%';
      timeEl.textContent = formatTime(seconds);
    }

    function updateProgress() {
      // While the visitor is dragging the scrubber, don't let the poll yank
      // the thumb back to the real playhead mid-drag — the drag owns it.
      if (isScrubbing) return;
      if (!player || typeof player.getCurrentTime !== 'function') return;
      let current = 0, duration = 0;
      try {
        current = player.getCurrentTime() || 0;
        duration = player.getDuration() || 0;
      } catch (e) { return; }
      const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
      renderProgress(pct, current);
    }

    // Click or drag anywhere on the bar to scrub. Pointer events unify mouse
    // and touch, and pointer capture keeps the drag alive even when the
    // finger/cursor slides off the thin bar. During the drag we seek with
    // allowSeekAhead=false (cheap — stays within already-buffered audio); the
    // release commits with true so the player can fetch ahead if needed.
    let scrubDuration = 0;
    function progressFracFromX(clientX) {
      const rect = progressEl.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    }
    function scrubTo(clientX, commit) {
      const frac = progressFracFromX(clientX);
      renderProgress(frac * 100, scrubDuration * frac);
      try { player.seekTo(scrubDuration * frac, commit); } catch (err) {}
    }
    progressEl.addEventListener('pointerdown', (e) => {
      if (!player || typeof player.getDuration !== 'function') return;
      try { scrubDuration = player.getDuration() || 0; } catch (err) { scrubDuration = 0; }
      if (scrubDuration <= 0) return;
      isScrubbing = true;
      progressEl.classList.add('is-scrubbing');
      try { progressEl.setPointerCapture(e.pointerId); } catch (err) {}
      scrubTo(e.clientX, false);
      e.preventDefault();
    });
    progressEl.addEventListener('pointermove', (e) => {
      if (!isScrubbing) return;
      scrubTo(e.clientX, false);
      e.preventDefault();
    });
    function endScrub(e) {
      if (!isScrubbing) return;
      scrubTo(e.clientX, true);
      try { progressEl.releasePointerCapture(e.pointerId); } catch (err) {}
      progressEl.classList.remove('is-scrubbing');
      isScrubbing = false;
    }
    progressEl.addEventListener('pointerup', endScrub);
    progressEl.addEventListener('pointercancel', endScrub);

    function setExpanded(expanded) {
      miniplayer.classList.toggle('is-expanded', expanded);
      handleEl.setAttribute('aria-expanded', String(expanded));
      handleEl.setAttribute('aria-label', expanded ? 'Hide upcoming tracks' : 'Show upcoming tracks');
      if (expanded) populateUpNext();
    }

    function populateUpNext() {
      if (!player || !tracks.length || !order.length) {
        upNextListEl.innerHTML = '';
        return;
      }
      // We drive playback through our own shuffled `order` (see onStateChange),
      // so the real upcoming tracks are the next entries in `order` — a stable
      // list that changes only as the song advances, not each time the panel is
      // opened. `upcoming` holds positions in `order`; each maps to a video ID
      // via tracks[order[pos]].
      const count = Math.min(4, order.length - 1);
      const upcoming = [];
      for (let i = 1; i <= count; i++) upcoming.push((orderPos + i) % order.length);

      // Dividers only BETWEEN consecutive Up Next items — none above the
      // first item or above the "Up Next" label (per the expanded design).
      upNextListEl.innerHTML = upcoming.map((_, i) => `
        ${i > 0 ? '<div class="miniplayer-divider"></div>' : ''}
        <button class="miniplayer-upnext-item" type="button">
          <span class="miniplayer-upnext-art"><img alt="" /></span>
          <span class="miniplayer-upnext-meta">
            <span class="miniplayer-upnext-title">Loading…</span>
            <span class="miniplayer-upnext-artist"></span>
          </span>
        </button>
      `).join('');

      const items = upNextListEl.querySelectorAll('.miniplayer-upnext-item');
      upcoming.forEach((orderIdx, i) => {
        const videoId = tracks[order[orderIdx]];
        const item = items[i];
        const img = item.querySelector('img');
        const titleSpan = item.querySelector('.miniplayer-upnext-title');
        const artistSpan = item.querySelector('.miniplayer-upnext-artist');

        item.addEventListener('click', () => {
          loadTrack(orderIdx, true);
          setExpanded(false);
        });

        fetch(`https://noembed.com/embed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`)
          .then((r) => r.json())
          .then((data) => {
            const [title, artist] = splitTitleArtist(data.title, data.author_name);
            titleSpan.textContent = title || 'Music';
            artistSpan.textContent = artist || '';
            img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
          })
          .catch(() => {
            titleSpan.textContent = 'Unknown track';
          });
      });
    }

    let tracks = [];     // every playlist video ID, in canonical order
    let order = [];      // shuffled indices into `tracks`
    let orderPos = 0;    // our current position within `order`
    let shuffledOnce = false;

    function buildShuffleOrder(len) {
      const a = [];
      for (let i = 0; i < len; i++) a.push(i);
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    // Load (autoplay) or cue (no autoplay) the track at position `pos` in our
    // shuffled order. Single-video playback — not a playlist — so YouTube never
    // auto-advances to the sequential next track: every change goes through
    // here, keeping playback shuffled.
    function loadTrack(pos, autoplay) {
      if (!player || !order.length) return;
      orderPos = ((pos % order.length) + order.length) % order.length;
      const vid = tracks[order[orderPos]];
      if (autoplay) player.loadVideoById(vid);
      else player.cueVideoById(vid);
    }

    window.onYouTubeIframeAPIReady = function () {
      player = new YT.Player(host, {
        host: 'https://www.youtube.com',
        playerVars: {
          listType: 'playlist',
          list: YT_PLAYLIST_ID,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: function () {
            // cuePlaylist (unlike loadPlaylist) loads without autoplaying —
            // the bar sits ready to go until the visitor presses play.
            player.cuePlaylist({ listType: 'playlist', list: YT_PLAYLIST_ID });
            setInterval(updateProgress, 250);
          },
          onStateChange: function (e) {
            const loadState = e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING || e.data === YT.PlayerState.CUED;
            if (loadState && !shuffledOnce) {
              const list = player.getPlaylist();
              if (list && list.length > 1) {
                // Shuffle, decided once per page load. Cueing a shuffled array
                // of IDs or calling setShuffle(true) are both silently ignored
                // for a playlist loaded by ID — and a playlist doesn't even fire
                // ENDED between tracks, so there's no way to intercept its
                // sequential auto-advance. Instead we read the playlist's IDs
                // once, keep our OWN shuffled order of them, and switch to
                // single-video playback that we fully control (next/prev and the
                // ENDED handler below both step through `order`). cueVideoById
                // (not loadVideoById) doesn't autoplay; the early return skips
                // the metadata refresh so there's no flash of the canonical
                // first track. Doing this once here — not in populateUpNext — is
                // what keeps opening/closing Up Next from reshuffling.
                shuffledOnce = true;
                tracks = list.slice();
                order = buildShuffleOrder(tracks.length);
                orderPos = 0;
                player.cueVideoById(tracks[order[0]]);
                return;
              }
            }
            // Each single video fires ENDED when it finishes — advance to the
            // next track in our shuffled order (autoplay to keep it continuous).
            if (e.data === YT.PlayerState.ENDED && order.length) {
              loadTrack(orderPos + 1, true);
              return;
            }
            refreshFromPlayer();
            setPlaying(e.data === YT.PlayerState.PLAYING);
          },
        },
      });
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);

    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', () => { loadTrack(orderPos - 1, true); });
    nextBtn.addEventListener('click', () => { loadTrack(orderPos + 1, true); });

    // ── Expand/collapse the Up Next panel: swipe up (or tap) the drag
    // handle to open it, swipe down (or tap again) to close ────────────────
    handleEl.addEventListener('click', () => {
      setExpanded(!miniplayer.classList.contains('is-expanded'));
    });
    let handleTouchStartY = null;
    handleEl.addEventListener('touchstart', (e) => {
      handleTouchStartY = e.touches[0].clientY;
    }, { passive: true });
    handleEl.addEventListener('touchend', (e) => {
      if (handleTouchStartY === null) return;
      const dy = e.changedTouches[0].clientY - handleTouchStartY;
      handleTouchStartY = null;
      e.stopPropagation();
      e.preventDefault();
      if (dy < -20) setExpanded(true);
      else if (dy > 20) setExpanded(false);
      else setExpanded(!miniplayer.classList.contains('is-expanded'));
    }, { passive: false });

    // ── Mobile: auto-park off-screen after 10s idle. Swipe left (or tap the
    // peeking edge) to bring it back, swipe right to park it again — at any
    // time, not just once the auto-hide timer has fired ────────────────────
    const isMobile = () => window.matchMedia('(max-width: 50.5625rem)').matches;
    let autoHideTimer = null;
    if (isMobile()) {
      autoHideTimer = setTimeout(() => {
        if (isMobile()) miniplayer.classList.add('is-hidden');
      }, 10000);
    }
    // A real swipe, not ordinary tap jitter — 60px is well past what a tap
    // on the art/title/buttons ever moves, so those pass through untouched.
    const SWIPE_THRESHOLD = 60;
    let touchStartX = null;
    let touchStartY = null;
    miniplayer.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    miniplayer.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      // Touch targeting stays pinned to the element touchstart began on, even
      // if the finger later moves elsewhere — safe to read here.
      const target = e.changedTouches[0].target;
      touchStartX = null;
      touchStartY = null;
      // A drag that began on the scrubber is a seek, not a park-swipe — its
      // own pointer handler already handled it, so bail before parking.
      if (target && target.closest && target.closest('.miniplayer-progress')) return;
      const hidden = miniplayer.classList.contains('is-hidden');
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const isTap = Math.abs(dx) < 8 && Math.abs(dy) < 8;
      const onArtOrTitle = target && target.closest && target.closest('.miniplayer-main');
      // A leftward swipe, or a plain tap on the peeking edge, both reveal it.
      // When visible, a swipe right OR a plain tap on the album art/title
      // (not the transport buttons) both park it again.
      if (hidden && (isTap || (horizontal && dx < -SWIPE_THRESHOLD))) {
        miniplayer.classList.remove('is-hidden');
      } else if (!hidden && ((horizontal && dx > SWIPE_THRESHOLD) || (isTap && onArtOrTitle))) {
        miniplayer.classList.add('is-hidden');
      } else {
        return;
      }
      // Once the visitor takes manual control, don't let the 10s auto-hide
      // fire later and override whatever they just chose.
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
        autoHideTimer = null;
      }
    }, { passive: true });
  }

})();

