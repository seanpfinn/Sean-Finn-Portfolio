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
})();
