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
          <span class="gh-tip-stat"><span class="gh-tip-count">–</span> contributions this year</span>
        </div>
      </div>
      <svg class="gh-tip-graph" xmlns="http://www.w3.org/2000/svg"></svg>
    `;
    // Lives above the content as a fixed overlay — never added to the page
    // flow beneath the footer (which would extend the scroll height).
    document.body.insertBefore(tip, document.body.firstChild);

    const svg = tip.querySelector('.gh-tip-graph');
    const NS = 'http://www.w3.org/2000/svg';
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function renderGraph(contributions) {
      svg.innerHTML = '';
      if (!contributions.length) return;
      const CELL = 10, GAP = 2, STEP = 12;
      const COLS = 13, ROWS = 7;
      const LABEL_L = 26, LABEL_T = 14;

      // Build date→level lookup
      const byDate = {};
      contributions.forEach(c => { byDate[c.date] = c.level; });

      // Always anchor to today — grid ends at the current week
      const today = new Date(); today.setHours(0,0,0,0);
      const endSunday = new Date(today);
      endSunday.setDate(today.getDate() - today.getDay());
      const startSunday = new Date(endSunday);
      startSunday.setDate(endSunday.getDate() - (COLS - 1) * 7);

      const W = LABEL_L + COLS * STEP - GAP + 4;
      const H = LABEL_T + ROWS * STEP - GAP;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

      function mkText(content, x, y, cls) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x); t.setAttribute('y', y);
        t.setAttribute('class', cls);
        t.textContent = content;
        return t;
      }

      // Day-of-week labels
      [[1,'Mon'],[3,'Wed'],[5,'Fri']].forEach(([row, label]) => {
        const t = mkText(label, 0, LABEL_T + row * STEP + CELL / 2, 'gh-axis-label');
        t.setAttribute('dominant-baseline', 'middle');
        svg.appendChild(t);
      });

      // Month labels — pinned to the column where each month first appears
      let lastMonth = -1;
      for (let col = 0; col < COLS; col++) {
        const d = new Date(startSunday);
        d.setDate(startSunday.getDate() + col * 7);
        const m = d.getMonth();
        if (m !== lastMonth) {
          lastMonth = m;
          const t = mkText(MONTHS[m], LABEL_L + col * STEP, LABEL_T - 3, 'gh-axis-label');
          t.setAttribute('text-anchor', 'start');
          svg.appendChild(t);
        }
      }

      // Cells — render every day in the grid; level-0 for days with no contributions
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          const d = new Date(startSunday);
          d.setDate(startSunday.getDate() + col * 7 + row);
          if (d > today) continue;
          const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const level = byDate[dateStr] ?? 0;
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', LABEL_L + col * STEP);
          rect.setAttribute('y', LABEL_T + row * STEP);
          rect.setAttribute('width', CELL); rect.setAttribute('height', CELL);
          rect.setAttribute('rx', 2);
          rect.setAttribute('class', `gh-cell--${level}`);
          svg.appendChild(rect);
        }
      }
    }

    let fetched = false;
    async function loadGH() {
      if (fetched) return; fetched = true;
      try {
        const res = await fetch('https://github-contributions-api.jogruber.de/v4/seanpfinn?y=2026');
        const data = await res.json();
        tip.querySelector('.gh-tip-count').textContent = (data.total[2026] || 0).toLocaleString();
        renderGraph(data.contributions || []);
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

  // ── Miniplayer (homepage only) ──────────────────────────────────────────
  // To connect a YouTube Music playlist: paste its playlist ID below.
  // Find it in the playlist's share URL, e.g.
  //   https://music.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxx
  //                                            ^^^^^^^^^^^^^^^^^^ this part
  // YouTube Music playlists share the same catalog/IDs as youtube.com, so
  // the IFrame Player API (no API key needed) can play it directly.
  const YT_PLAYLIST_ID = 'PL_KxoM8I-cz7nPee_o0DMZTuaVbrwKQOl';

  const miniplayer = document.getElementById('miniplayer');
  if (miniplayer) {
    const artEl      = miniplayer.querySelector('.miniplayer-art');
    const imgEl      = document.getElementById('miniplayer-artwork');
    const titleEl    = document.getElementById('miniplayer-title');
    const artistEl   = document.getElementById('miniplayer-artist');
    const toggleEl   = document.getElementById('miniplayer-toggle');
    const playBtn    = document.getElementById('miniplayer-playpause');
    const prevBtn    = document.getElementById('miniplayer-prev');
    const nextBtn    = document.getElementById('miniplayer-next');
    const host       = document.getElementById('miniplayer-yt-host');

    let player = null;
    let ready = false;

    function setMeta(title, artist, videoId) {
      // Many uploads report no channel/author via the player API but follow
      // the "Artist - Title" convention in the video title itself — fall
      // back to splitting that when YouTube doesn't give us an artist.
      if (!artist && title && title.includes(' - ')) {
        const i = title.indexOf(' - ');
        artist = title.slice(0, i);
        title = title.slice(i + 3);
      }
      titleEl.textContent = title || 'Music';
      artistEl.textContent = artist || '';
      if (videoId) {
        imgEl.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        artEl.classList.add('has-art');
      }
    }

    function refreshFromPlayer() {
      if (!player || typeof player.getVideoData !== 'function') return;
      const data = player.getVideoData();
      if (data && data.video_id) setMeta(data.title, data.author, data.video_id);
    }

    function setPlaying(isPlaying) {
      miniplayer.classList.toggle('is-playing', isPlaying);
      const pressed = String(isPlaying);
      toggleEl.setAttribute('aria-pressed', pressed);
      playBtn.setAttribute('aria-pressed', pressed);
      playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }

    function togglePlay() {
      if (!ready || !player) return;
      if (player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }

    if (YT_PLAYLIST_ID) {
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
              ready = true;
              player.cuePlaylist({ listType: 'playlist', list: YT_PLAYLIST_ID });
            },
            onStateChange: function (e) {
              refreshFromPlayer();
              setPlaying(e.data === YT.PlayerState.PLAYING);
            },
          },
        });
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);

      toggleEl.addEventListener('click', togglePlay);
      toggleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          togglePlay();
        }
      });
      playBtn.addEventListener('click', togglePlay);
      prevBtn.addEventListener('click', () => { if (ready && player) player.previousVideo(); });
      nextBtn.addEventListener('click', () => { if (ready && player) player.nextVideo(); });
    }
  }

})();

