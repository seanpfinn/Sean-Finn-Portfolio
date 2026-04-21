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
    const CELL = 8, GAP = 2, COLS = 52, ROWS = 7;
    const W = COLS * (CELL + GAP) - GAP;
    const H = ROWS * (CELL + GAP) - GAP;

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
      <svg class="gh-tip-graph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"></svg>
    `;
    document.body.appendChild(tip);

    const svg = tip.querySelector('.gh-tip-graph');

    function renderGraph(contributions) {
      svg.innerHTML = '';
      if (!contributions.length) return;
      const firstDate = new Date(contributions[0].date + 'T00:00:00');
      const startSunday = new Date(firstDate);
      startSunday.setDate(firstDate.getDate() - firstDate.getDay());
      contributions.forEach(c => {
        const date = new Date(c.date + 'T00:00:00');
        const col = Math.floor(Math.round((date - startSunday) / 86400000) / 7);
        const row = date.getDay();
        if (col >= COLS) return;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', col * (CELL + GAP));
        rect.setAttribute('y', row * (CELL + GAP));
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
