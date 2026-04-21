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
  // ── Secondary CTA active state ───────────────────────────────────────────
  const sectionMap = {
    'select-projects': '[href="#select-projects"]',
    'ai-playground':   '[href="#ai-playground"]',
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const link = document.querySelector(sectionMap[entry.target.id]);
      if (link) link.classList.toggle('is-active', entry.isIntersecting);
    });
  }, { threshold: 0, rootMargin: '0px 0px -60% 0px' });

  Object.keys(sectionMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });

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

      // Filter to last 13 weeks
      const today = new Date(); today.setHours(0,0,0,0);
      const cutoff = new Date(today);
      cutoff.setDate(today.getDate() - COLS * 7);
      const recent = contributions.filter(c => new Date(c.date + 'T00:00:00') >= cutoff);
      if (!recent.length) return;

      // Find start Sunday
      const firstDate = new Date(recent[0].date + 'T00:00:00');
      const startSunday = new Date(firstDate);
      startSunday.setDate(firstDate.getDate() - firstDate.getDay());

      const lastDate = new Date(recent[recent.length - 1].date + 'T00:00:00');
      const usedCols = Math.min(
        Math.floor(Math.round((lastDate - startSunday) / 86400000) / 7) + 1,
        COLS
      );

      const W = LABEL_L + usedCols * STEP - GAP;
      const H = LABEL_T + ROWS * STEP - GAP;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

      function mkText(content, x, y, cls) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x); t.setAttribute('y', y);
        t.setAttribute('class', cls);
        t.textContent = content;
        return t;
      }

      // Day labels: Mon, Wed, Fri
      [[1,'Mon'],[3,'Wed'],[5,'Fri']].forEach(([row, label]) => {
        const t = mkText(label, 0, LABEL_T + row * STEP + CELL / 2, 'gh-axis-label');
        t.setAttribute('dominant-baseline', 'middle');
        svg.appendChild(t);
      });

      // Month labels — collect distinct months then space evenly
      const monthsFound = [];
      let lastMonth = -1;
      for (let col = 0; col < usedCols; col++) {
        const d = new Date(startSunday);
        d.setDate(startSunday.getDate() + col * 7);
        if (d.getMonth() !== lastMonth) {
          lastMonth = d.getMonth();
          monthsFound.push(MONTHS[lastMonth]);
        }
      }
      const graphW = usedCols * STEP - GAP;
      monthsFound.forEach((label, i) => {
        const x = LABEL_L + (i / Math.max(monthsFound.length - 1, 1)) * graphW;
        svg.appendChild(mkText(label, i === 0 ? x : x - 10, LABEL_T - 3, 'gh-axis-label'));
      });

      // Contribution cells
      recent.forEach(c => {
        const date = new Date(c.date + 'T00:00:00');
        const col = Math.floor(Math.round((date - startSunday) / 86400000) / 7);
        const row = date.getDay();
        if (col >= usedCols) return;
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', LABEL_L + col * STEP);
        rect.setAttribute('y', LABEL_T + row * STEP);
        rect.setAttribute('width', CELL);
        rect.setAttribute('height', CELL);
        rect.setAttribute('rx', 2);
        rect.setAttribute('class', `gh-cell--${c.level}`);
        svg.appendChild(rect);
      });
    }

    let fetched = false;
    async function loadGH() {
      if (fetched) return;
      fetched = true;
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
      link.addEventListener('mouseenter', () => {
        tip.classList.add('is-visible');
        positionTip(link);
      });
      link.addEventListener('mouseleave', () => tip.classList.remove('is-visible'));
    });
  }
})();
