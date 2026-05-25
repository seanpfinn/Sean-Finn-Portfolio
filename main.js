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

})();
