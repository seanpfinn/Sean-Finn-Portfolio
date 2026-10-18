// Mix CD — a YouTube-playlist disc player.
// Pair with cdplayer.css. The current track's cover art is printed onto a
// compact disc (or stuck onto a burned CD-R, with the title written on in
// marker). The disc spins up when playback starts and coasts to a stop when
// it pauses; the rainbow off its metal layer stays put while it turns.
// Changing tracks ejects the disc and loads the next one. Tapping the track
// number flips the disc over to a jewel case with the whole shuffle listed.
// Title, artist, a scrubber with seven-segment readouts and transport
// controls sit beneath it.
//
// Runs entirely on YouTube's IFrame Player API — no API key needed.
//
// Mounting: put <div id="cd-player"></div> wherever you want it. If the page
// has no such element, the player appends itself to <body>.

(function () {
  // Paste a YouTube / YouTube Music playlist ID here — the part after
  // `list=` in the playlist's share URL.
  const YT_PLAYLIST_ID = 'PLEDQcLdU2FpQ'; // demo playlist — swap for your own

  // Seconds per revolution while playing. A real CD turns 200–500 rpm; this
  // is deliberately slow so the cover art stays legible.
  const SECONDS_PER_REV = 5;
  const SPIN_UP_SECONDS = 0.9;   // disc reaching speed
  const SPIN_DOWN_SECONDS = 2.2; // coasting to a stop

  const MB_ID = 'cd-player';
  if (!YT_PLAYLIST_ID || document.querySelector('.cd[data-built]')) return;

  const SKIP_BACK_PATH = 'M19.5 4.48875V19.5112C19.4972 19.7772 19.4237 20.0376 19.2872 20.2658C19.1506 20.494 18.9558 20.6818 18.7227 20.8099C18.4896 20.938 18.2267 21.0019 17.9608 20.9949C17.695 20.988 17.4357 20.9105 17.2097 20.7703L6 13.7597V20.25C6 20.4489 5.92098 20.6397 5.78033 20.7803C5.63968 20.921 5.44891 21 5.25 21C5.05109 21 4.86032 20.921 4.71967 20.7803C4.57902 20.6397 4.5 20.4489 4.5 20.25V3.75C4.5 3.55109 4.57902 3.36032 4.71967 3.21967C4.86032 3.07902 5.05109 3 5.25 3C5.44891 3 5.63968 3.07902 5.78033 3.21967C5.92098 3.36032 6 3.55109 6 3.75V10.2403L17.2097 3.22969C17.4354 3.08797 17.695 3.00918 17.9614 3.00146C18.2278 2.99374 18.4915 3.05737 18.7251 3.18578C18.9586 3.31418 19.1536 3.50269 19.2899 3.73178C19.4261 3.96086 19.4987 4.22221 19.5 4.48875Z';
  const PLAY_PATH = 'M22.5 12C22.5006 12.2546 22.4353 12.5051 22.3105 12.7271C22.1856 12.949 22.0055 13.1349 21.7875 13.2666L8.28 21.5297C8.05227 21.6691 7.79144 21.7453 7.52445 21.7502C7.25746 21.7552 6.99399 21.6887 6.76125 21.5578C6.53073 21.4289 6.3387 21.241 6.2049 21.0132C6.07111 20.7855 6.00039 20.5263 6 20.2622V3.73781C6.00039 3.4737 6.07111 3.21447 6.2049 2.98675C6.3387 2.75904 6.53073 2.57108 6.76125 2.44219C6.99399 2.31126 7.25746 2.24484 7.52445 2.24979C7.79144 2.25473 8.05227 2.33086 8.28 2.47031L21.7875 10.7334C22.0055 10.8651 22.1856 11.051 22.3105 11.2729C22.4353 11.4949 22.5006 11.7453 22.5 12Z';
  const PAUSE_PATH = 'M20.25 4.5V19.5C20.25 19.8978 20.092 20.2794 19.8107 20.5607C19.5294 20.842 19.1478 21 18.75 21H15C14.6022 21 14.2206 20.842 13.9393 20.5607C13.658 20.2794 13.5 19.8978 13.5 19.5V4.5C13.5 4.10218 13.658 3.72064 13.9393 3.43934C14.2206 3.15804 14.6022 3 15 3H18.75C19.1478 3 19.5294 3.15804 19.8107 3.43934C20.092 3.72064 20.25 4.10218 20.25 4.5ZM9 3H5.25C4.85218 3 4.47064 3.15804 4.18934 3.43934C3.90804 3.72064 3.75 4.10218 3.75 4.5V19.5C3.75 19.8978 3.90804 20.2794 4.18934 20.5607C4.47064 20.842 4.85218 21 5.25 21H9C9.39782 21 9.77936 20.842 10.0607 20.5607C10.342 20.2794 10.5 19.8978 10.5 19.5V4.5C10.5 4.10218 10.342 3.72064 10.0607 3.43934C9.77936 3.15804 9.39782 3 9 3Z';
  const SKIP_FORWARD_PATH = 'M19.5 3.75V20.25C19.5 20.4489 19.421 20.6397 19.2803 20.7803C19.1397 20.921 18.9489 21 18.75 21C18.5511 21 18.3603 20.921 18.2197 20.7803C18.079 20.6397 18 20.4489 18 20.25V13.7597L6.79031 20.7703C6.56456 20.912 6.30504 20.9908 6.0386 20.9985C5.77217 21.0063 5.50852 20.9426 5.27494 20.8142C5.04137 20.6858 4.84636 20.4973 4.71011 20.2682C4.57386 20.0391 4.50132 19.7778 4.5 19.5112V4.48875C4.50132 4.22221 4.57386 3.96086 4.71011 3.73178C4.84636 3.50269 5.04137 3.31418 5.27494 3.18578C5.50852 3.05737 5.77217 2.99374 6.0386 3.00146C6.30504 3.00918 6.56456 3.08797 6.79031 3.22969L18 10.2403V3.75C18 3.55109 18.079 3.36032 18.2197 3.21967C18.3603 3.07902 18.5511 3 18.75 3C18.9489 3 19.1397 3.07902 19.2803 3.21967C19.421 3.36032 19.5 3.55109 19.5 3.75Z';

  // ── Markup ───────────────────────────────────────────────────────────────
  let root = document.getElementById('cd-player');
  if (!root) {
    root = document.createElement('div');
    root.id = 'cd-player';
    document.body.appendChild(root);
  }
  root.classList.add('cd');
  if (!root.dataset.disc) root.dataset.disc = 'printed';
  root.dataset.built = '1';

  const CASE_ID = 'cd-case-' + Math.random().toString(36).slice(2, 8);
  const MICRO = 'CD-R · 80 MIN · 700 MB · 1×–52× · MADE IN BROOKLYN · ID 0417-A7 ★';
  root.innerHTML = `
    <div class="cd-deck">
      <div class="cd-glow" aria-hidden="true"><img alt="" /></div>
      <div class="cd-flip">
      <div class="cd-face cd-face--front">
      <div class="cd-drive" aria-hidden="true">
        <span class="cd-turntable"></span>
        <span class="cd-hub"><i></i><i></i><i></i></span>
      </div>
      <div class="cd-load">
      <span class="cd-shadow" aria-hidden="true"></span>
      <div class="cd-lift">
      <div class="cd-spin" aria-hidden="true">
        <div class="cd-disc">
          <span class="cd-base"></span>
          <span class="cd-print"><img alt="" /><img alt="" /></span>
          <svg class="cd-micro" viewBox="0 0 200 200">
            <defs><path id="cd-micro-path" d="M100 100 m-26.6 0 a26.6 26.6 0 1 1 53.2 0 a26.6 26.6 0 1 1 -53.2 0" /></defs>
            <text textLength="165" lengthAdjust="spacing"><textPath href="#cd-micro-path" textLength="165" lengthAdjust="spacing">${MICRO}</textPath></text>
          </svg>
          <span class="cd-ink"><span class="cd-ink-title"></span><span class="cd-ink-artist"></span></span>
        </div>
      </div>
      <span class="cd-iris" aria-hidden="true"></span>
      <span class="cd-gloss" aria-hidden="true"></span>
      </div>
      </div>
      </div>
      <div class="cd-face cd-face--back" id="${CASE_ID}" aria-hidden="true">
        <div class="cd-case">
          <div class="cd-case-spine" aria-hidden="true"><span>MUSIC BOX · SHUFFLE</span><span class="cd-case-spine-n">--</span></div>
          <div class="cd-case-insert">
            <div class="cd-case-head">
              <span class="cd-case-title">Track List</span>
              <span class="cd-case-count">--</span>
            </div>
            <ol class="cd-case-list"></ol>
            <div class="cd-case-foot" aria-hidden="true">
              <span class="cd-case-barcode"></span>
              <span class="cd-case-cat">SPF-0417 · Shuffled</span>
            </div>
          </div>
          <div class="cd-case-spine" aria-hidden="true"><span>MUSIC BOX · SHUFFLE</span><span class="cd-case-spine-n">--</span></div>
        </div>
      </div>
      </div>
    </div>

    <div class="cd-meta" aria-live="polite">
      <button class="cd-track" type="button" aria-expanded="false" aria-controls="${CASE_ID}" title="Show the track list">
        <svg class="cd-track-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M2 3.5h12M2 8h12M2 12.5h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <span class="cd-track-label">Track --</span>
      </button>
      <span class="cd-title-clip"><span class="cd-title">Music</span></span>
      <span class="cd-artist">Connecting…</span>
    </div>

    <div class="cd-progress">
      <span class="cd-lcd cd-lcd--now" data-ghost="8:88"><span>0:00</span></span>
      <div class="cd-bar" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <span class="cd-bar-track"></span>
        <span class="cd-bar-fill"></span>
        <span class="cd-bar-thumb"></span>
      </div>
      <span class="cd-lcd cd-lcd--end" data-ghost="-8:88"><span>-0:00</span></span>
    </div>

    <div class="cd-controls">
      <button class="cd-btn cd-prev" type="button" aria-label="Previous track">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="${SKIP_BACK_PATH}"/></svg>
      </button>
      <button class="cd-btn cd-btn--play" type="button" aria-label="Play" aria-pressed="false">
        <svg class="cd-icon-play" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="${PLAY_PATH}"/></svg>
        <svg class="cd-icon-pause" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="${PAUSE_PATH}"/></svg>
      </button>
      <button class="cd-btn cd-next" type="button" aria-label="Next track">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="${SKIP_FORWARD_PATH}"/></svg>
      </button>
    </div>
  `;

  const host = document.createElement('div');
  host.className = 'cd-yt-host';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const hostTarget = document.createElement('div');
  host.appendChild(hostTarget);

  const $ = (sel) => root.querySelector(sel);
  const spinEl = $('.cd-spin');
  const hubEl = $('.cd-drive .cd-hub');
  const printImgs = root.querySelectorAll('.cd-print img');
  const glowImg = $('.cd-glow img');
  const inkTitle = $('.cd-ink-title');
  const inkArtist = $('.cd-ink-artist');
  const trackBtn = $('.cd-track');
  const trackEl = $('.cd-track-label');
  const loadEl = $('.cd-load');
  const frontFace = $('.cd-face--front');
  const backFace = $('.cd-face--back');
  const caseList = $('.cd-case-list');
  const caseCount = $('.cd-case-count');
  const spineNums = root.querySelectorAll('.cd-case-spine-n');
  const titleEl = $('.cd-title');
  const titleClip = $('.cd-title-clip');
  const artistEl = $('.cd-artist');
  const playBtn = $('.cd-btn--play');
  const prevBtn = $('.cd-prev');
  const nextBtn = $('.cd-next');
  const barEl = $('.cd-bar');
  const fillEl = $('.cd-bar-fill');
  const thumbEl = $('.cd-bar-thumb');
  const nowEl = $('.cd-lcd--now');
  const endEl = $('.cd-lcd--end');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let player = null;
  let tracks = [];
  let order = [];
  let orderPos = 0;
  let shuffledOnce = false;
  let isPlaying = false;

  // ── Spindle: ease angular velocity toward its target ────────────────────
  let angle = 0, velocity = 0, lastT = 0;
  function spin(t) {
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t;
    // The drive brakes hard before an eject and stays still until the next
    // disc has settled on the spindle.
    const target = isPlaying && !driveBusy && !reduceMotion.matches ? 360 / SECONDS_PER_REV : 0;
    const tau = driveBusy ? 0.06 : (target > velocity ? SPIN_UP_SECONDS : SPIN_DOWN_SECONDS) / 4;
    // While scratching, the pointer owns the angle (set in the handlers).
    if (!scratching) {
      // After a fling the disc coasts on its own spin before settling.
      const k = coasting ? 0.55 : tau;
      velocity += (target - velocity) * (1 - Math.exp(-dt / k));
      if (coasting && Math.abs(velocity - target) < 4) coasting = false;
      if (Math.abs(velocity) < 0.05 && target === 0) velocity = 0;
      angle = (angle + velocity * dt) % 360;
    }
    // A little weight: while the disc is changing speed (spin-up, coasting
    // to a stop, after a fling) it wobbles slightly on the spindle, like a
    // real disc settling. The wobble follows the rotation and dies away
    // once it's at speed.
    const full = 360 / SECONDS_PER_REV;
    const want = scratching || reduceMotion.matches ? 0
      : Math.min(1, Math.abs(velocity - target) / full) * (Math.abs(velocity) > 2 ? 1 : 0);
    wobble += (want - wobble) * (1 - Math.exp(-dt / 0.25));
    const rad = angle * Math.PI / 180, w = wobble * 3.5;
    spinEl.style.transform = w > 0.02
      ? `perspective(1400px) rotateX(${(w * Math.sin(rad)).toFixed(3)}deg) rotateY(${(w * Math.cos(rad)).toFixed(3)}deg) rotate(${angle}deg)`
      : `rotate(${angle}deg)`;
    hubEl.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    requestAnimationFrame(spin);
  }
  let driveBusy = false;
  let scratching = false, coasting = false, wobble = 0;
  // Haptics: a short tick on phones that support it (Android). Silent elsewhere.
  const buzz = (ms) => { try { if (navigator.vibrate && !reduceMotion.matches) navigator.vibrate(ms); } catch (e) {} };
  requestAnimationFrame(spin);

  // ── Metadata + cover art ────────────────────────────────────────────────
  function splitTitleArtist(title, artist) {
    if (!artist && title && title.includes(' - ')) {
      const i = title.indexOf(' - ');
      artist = title.slice(0, i);
      title = title.slice(i + 3);
    }
    if (artist) artist = artist.replace(/\s*[-–]\s*Topic\s*$/i, '');
    return [title, artist];
  }

  function updateTicker() {
    titleClip.classList.remove('is-ticking');
    titleEl.style.removeProperty('--cd-ticker-shift');
    requestAnimationFrame(() => {
      const overflow = titleEl.scrollWidth - titleClip.clientWidth;
      if (overflow > 4) {
        titleEl.style.setProperty('--cd-ticker-shift', `-${overflow + titleClip.clientWidth * 0.12}px`);
        titleClip.classList.add('is-ticking');
      }
    });
  }

  // YouTube thumbnails are 16:9; music uploads center the square album art,
  // so object-fit: cover inside the disc lands right on it. maxresdefault is
  // sharpest but missing for some videos (YouTube returns a 120×90
  // placeholder), so fall back to mqdefault.
  let shownArt = null, frontImg = 0, swappingTo = null;
  const artCache = {};
  // Resolves to the best available thumbnail URL, already downloaded.
  function resolveArt(videoId) {
    if (artCache[videoId]) return artCache[videoId];
    const fallback = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    artCache[videoId] = new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => {
        if (probe.naturalWidth > 120) { resolve(probe.src); return; }
        const fb = new Image();
        fb.onload = fb.onerror = () => resolve(fallback);
        fb.src = fallback;
      };
      probe.onerror = () => resolve(fallback);
      probe.src = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    });
    return artCache[videoId];
  }
  // Puts art on the disc. `instant` swaps it with no crossfade — used while
  // the disc is out of the drive.
  // ── Tint from the cover: the cover's main color tints the page and the
  // progress bar (see --mix-h / --mix-s in mix-cd.css). Colorful pixels
  // count most; a black-and-white cover gives a neutral tint.
  const tintCache = {};
  function tintFrom(videoId) {
    const apply = (t) => {
      if (shownArt !== videoId && swappingTo !== videoId) return;
      const de = document.documentElement;
      de.style.setProperty('--mix-h', t.h.toFixed(1));
      de.style.setProperty('--mix-s', t.s.toFixed(1) + '%');
      root.classList.add('is-tinted');
    };
    if (tintCache[videoId]) { apply(tintCache[videoId]); return; }
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const N = 24, c = document.createElement('canvas');
        c.width = c.height = N;
        const g = c.getContext('2d', { willReadFrequently: true });
        const side = Math.min(im.naturalWidth, im.naturalHeight);
        g.drawImage(im, (im.naturalWidth - side) / 2, (im.naturalHeight - side) / 2, side, side, 0, 0, N, N);
        const d = g.getImageData(0, 0, N, N).data;
        let x = 0, y = 0, sw = 0, ws = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, ch = mx - mn;
          if (ch < 0.02) continue;
          const sat = ch / (1 - Math.abs(2 * l - 1) || 1);
          let h = mx === r ? ((gg - b) / ch) % 6 : mx === gg ? (b - r) / ch + 2 : (r - gg) / ch + 4;
          h *= 60;
          const w = sat * sat * Math.sqrt(Math.max(0, 1 - Math.abs(2 * l - 1)));
          x += Math.cos(h * Math.PI / 180) * w; y += Math.sin(h * Math.PI / 180) * w;
          sw += sat * w; ws += w;
        }
        const t = ws < 2
          ? { h: 30, s: 0 }
          : { h: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, s: Math.min(85, (sw / ws) * 100) };
        tintCache[videoId] = t;
        apply(t);
      } catch (e) { /* cross-origin blocked: keep the neutral look */ }
    };
    im.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  }

  function applyArt(videoId, src, instant) {
    shownArt = videoId;
    tintFrom(videoId);
    glowImg.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    root.classList.add('has-art');
    const next = printImgs[1 - frontImg], prev = printImgs[frontImg];
    if (instant) {
      next.style.transition = prev.style.transition = 'none';
      next.src = src;
      next.classList.add('is-shown');
      prev.classList.remove('is-shown');
      frontImg = 1 - frontImg;
      requestAnimationFrame(() => { next.style.transition = prev.style.transition = ''; });
      return (next.decode ? next.decode() : Promise.resolve()).catch(() => {});
    }
    next.onload = () => {
      if (shownArt !== videoId) return;
      next.classList.add('is-shown');
      prev.classList.remove('is-shown');
      frontImg = 1 - frontImg;
    };
    next.src = src;
    return Promise.resolve();
  }
  function setArt(videoId) {
    if (!videoId || videoId === shownArt || videoId === swappingTo) return;
    shownArt = videoId;
    resolveArt(videoId).then((src) => { if (shownArt === videoId) applyArt(videoId, src, false); });
  }

  const metaCache = {};
  function setInk(t, artist) {
    inkTitle.textContent = t;
    inkTitle.classList.toggle('is-long', t.length > 16);
    inkArtist.textContent = artist || '';
  }
  function setMeta(rawTitle, rawArtist, videoId) {
    const [title, artist] = splitTitleArtist(rawTitle, rawArtist);
    const t = title || 'Music';
    if (videoId && title) { metaCache[videoId] = { title: t, artist: artist || '' }; fillCaseRow(videoId); }
    if (titleEl.textContent !== t) {
      titleEl.textContent = t;
      updateTicker();
    }
    artistEl.textContent = artist || '';
    // The marker scrawl on a burned disc — written once the disc is back in.
    if (videoId !== swappingTo) setInk(t, artist);
    setArt(videoId);
  }

  function setTrackNumber() {
    if (!order.length) return;
    const pad = (n) => String(n).padStart(2, '0');
    trackEl.textContent = `Track ${pad(orderPos + 1)} / ${pad(order.length)}`;
    markCurrentRow();
  }

  function currentVideoId() {
    return order.length && tracks.length ? tracks[order[orderPos]] || null : null;
  }

  let shownVideoId = null, fetchingVideoId = null;
  function fetchMetaByVideoId(videoId) {
    if (!videoId || fetchingVideoId === videoId) return;
    fetchingVideoId = videoId;
    setArt(videoId); // art needs only the ID — don't wait on the title lookup
    fetch(`https://noembed.com/embed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (currentVideoId() !== videoId || !data || !data.title) return;
        setMeta(data.title, data.author_name, videoId);
        shownVideoId = videoId;
      })
      .catch(() => {})
      .finally(() => { if (fetchingVideoId === videoId) fetchingVideoId = null; });
  }

  function refreshFromPlayer() {
    const videoId = currentVideoId();
    if (!videoId || videoId === shownVideoId) return;
    let data = null;
    try { data = player.getVideoData(); } catch (e) {}
    if (data && data.video_id === videoId && data.title && data.author) {
      setMeta(data.title, data.author, videoId);
      shownVideoId = videoId;
    } else {
      fetchMetaByVideoId(videoId);
    }
  }

  // ── Playback state ──────────────────────────────────────────────────────
  function setPlaying(playing) {
    if (playing === isPlaying) return;
    isPlaying = playing;
    root.classList.toggle('is-playing', playing);
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    if (playing) window.dispatchEvent(new CustomEvent('musicbox:play', { detail: MB_ID }));
  }
  // Pause if another Music Box / player on the page starts playing.
  window.addEventListener('musicbox:play', (e) => {
    if (e.detail !== MB_ID && player && player.pauseVideo) {
      try { player.pauseVideo(); } catch (err) {}
    }
  });

  function togglePlay() {
    if (!player || !player.getPlayerState) return;
    if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
  }

  // ── Progress + scrubbing ────────────────────────────────────────────────
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function setLcd(el, text) {
    el.firstElementChild.textContent = text;
    el.dataset.ghost = text.replace(/\d/g, '8');
  }

  let isScrubbing = false, lastFraction = 0, duration = 0;
  function renderProgress(frac, seconds) {
    const pct = (frac * 100).toFixed(2) + '%';
    fillEl.style.width = pct;
    thumbEl.style.left = pct;
    setLcd(nowEl, formatTime(seconds));
    setLcd(endEl, '-' + formatTime(Math.max(0, duration - seconds)));
    barEl.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
    barEl.setAttribute('aria-valuetext', `${formatTime(seconds)} of ${formatTime(duration)}`);
  }
  function updateProgress() {
    if (isScrubbing || !player || !player.getCurrentTime) return;
    let current = 0;
    try {
      current = player.getCurrentTime() || 0;
      duration = player.getDuration() || 0;
    } catch (e) { return; }
    lastFraction = duration > 0 ? Math.min(1, current / duration) : 0;
    renderProgress(lastFraction, current);
  }

  function fracFromX(clientX) {
    const rect = barEl.getBoundingClientRect();
    return rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
  }
  function scrubTo(frac, commit) {
    lastFraction = frac;
    renderProgress(frac, duration * frac);
    try { player.seekTo(duration * frac, commit); } catch (err) {}
  }
  barEl.addEventListener('pointerdown', (e) => {
    if (!player || !player.getDuration) return;
    try { duration = player.getDuration() || 0; } catch (err) { duration = 0; }
    if (duration <= 0) return;
    isScrubbing = true;
    barEl.classList.add('is-scrubbing');
    try { barEl.setPointerCapture(e.pointerId); } catch (err) {}
    scrubTo(fracFromX(e.clientX), false);
    e.preventDefault();
  });
  barEl.addEventListener('pointermove', (e) => {
    if (isScrubbing) { scrubTo(fracFromX(e.clientX), false); e.preventDefault(); }
  });
  function endScrub(e) {
    if (!isScrubbing) return;
    scrubTo(fracFromX(e.clientX), true);
    try { barEl.releasePointerCapture(e.pointerId); } catch (err) {}
    barEl.classList.remove('is-scrubbing');
    isScrubbing = false;
  }
  barEl.addEventListener('pointerup', endScrub);
  barEl.addEventListener('pointercancel', endScrub);
  barEl.addEventListener('keydown', (e) => {
    if (!player || duration <= 0) return;
    const step = e.shiftKey ? 30 : 5;
    let t = null;
    if (e.key === 'ArrowRight') t = Math.min(duration, duration * lastFraction + step);
    if (e.key === 'ArrowLeft') t = Math.max(0, duration * lastFraction - step);
    if (e.key === 'Home') t = 0;
    if (t !== null) { e.preventDefault(); scrubTo(t / duration, true); }
  });

  // ── Shuffle + track loading ─────────────────────────────────────────────
  function buildShuffleOrder(len) {
    const a = Array.from({ length: len }, (_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function loadTrack(pos, autoplay, dir) {
    if (!player || !order.length) return;
    const prevPos = orderPos;
    orderPos = ((pos % order.length) + order.length) % order.length;
    const vid = tracks[order[orderPos]];
    lastFraction = 0;
    renderProgress(0, 0);
    setTrackNumber();
    // Swap discs when there's already one in the drive.
    if (shownArt && shownArt !== vid) ejectAndLoad(vid, dir || (orderPos >= prevPos ? 'next' : 'prev'));
    fetchMetaByVideoId(vid);
    if (autoplay) player.loadVideoById(vid);
    else player.cueVideoById(vid);
  }

  // ── Eject + load: the drive brakes, the disc lifts off the spindle (its
  // shadow dropping away beneath it) and slides out; the next disc, its art
  // already printed, slides in still raised and settles onto the spindle.
  // Audio isn't held up.
  const EJECT_MS = 900;
  const FLING_MS = 300;   // a flung disc is already up and moving
  let pendingFling = false;
  let swapToken = 0;
  function ejectAndLoad(vid, dir) {
    if (reduceMotion.matches) {
      swappingTo = null;
      resolveArt(vid).then((src) => {
        if (currentVideoId() !== vid) return;
        applyArt(vid, src, false);
        const m = metaCache[vid]; if (m) setInk(m.title, m.artist);
      });
      return;
    }
    const token = ++swapToken;
    swappingTo = vid;
    driveBusy = true;
    const flung = pendingFling;
    pendingFling = false;
    loadEl.dataset.dir = dir;
    if (flung) loadEl.dataset.fling = '1'; else delete loadEl.dataset.fling;
    loadEl.classList.remove('is-in');
    void loadEl.offsetWidth;
    loadEl.classList.add('is-out');
    const art = Promise.race([resolveArt(vid), new Promise((r) => setTimeout(() => r(null), 1400))]);
    const out = new Promise((r) => setTimeout(r, flung ? FLING_MS : EJECT_MS));
    Promise.all([art, out]).then(([src]) => {
      if (token !== swapToken) return;
      const done = src ? applyArt(vid, src, true) : Promise.resolve();
      const m = metaCache[vid];
      setInk(m ? m.title : '', m ? m.artist : '');
      return done.then(() => {
        if (token !== swapToken) return;
        swappingTo = null;
        if (!src) setArt(vid);
        loadEl.classList.remove('is-out');
        void loadEl.offsetWidth;
        loadEl.classList.add('is-in');
      });
    });
  }
  loadEl.addEventListener('animationend', (e) => {
    if (/^cd-lift-in/.test(e.animationName)) {
      buzz(14);                                        // the disc lands on the spindle
      loadEl.classList.remove('is-in');
      delete loadEl.dataset.fling;
      driveBusy = false;
    }
  });

  // ── Jewel case: flip the disc over to see the whole shuffle as a track list.
  const pad2 = (n) => String(n).padStart(2, '0');
  function buildCase() {
    caseCount.textContent = `${order.length} tracks`;
    spineNums.forEach((el) => { el.textContent = `${order.length} TRACKS`; });
    caseList.innerHTML = order.map((_, i) => `
      <li><button type="button" class="cd-case-row" data-pos="${i}" data-vid="${tracks[order[i]]}" tabindex="-1">
        <span class="cd-case-n">${pad2(i + 1)}</span>
        <span class="cd-case-t">Loading…</span>
        <span class="cd-case-a"></span>
      </button></li>`).join('');
    Object.keys(metaCache).forEach(fillCaseRow);
    markCurrentRow();
    rowObserver = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((en) => { if (en.isIntersecting) queueRowMeta(en.target.dataset.vid); });
        }, { root: caseList, rootMargin: '120px 0px' })
      : null;
    caseList.querySelectorAll('.cd-case-row').forEach((row) => {
      if (rowObserver) rowObserver.observe(row);
    });
  }
  let rowObserver = null;
  function fillCaseRow(vid) {
    const m = metaCache[vid];
    if (!m) return;
    caseList.querySelectorAll(`.cd-case-row[data-vid="${vid}"]`).forEach((row) => {
      row.querySelector('.cd-case-t').textContent = m.title;
      row.querySelector('.cd-case-a').textContent = m.artist;
      row.classList.add('is-loaded');
      if (rowObserver) rowObserver.unobserve(row);
    });
  }
  function markCurrentRow() {
    const cur = caseList.querySelector('.cd-case-row.is-current');
    if (cur) { cur.classList.remove('is-current'); cur.removeAttribute('aria-current'); }
    const row = caseList.querySelector(`.cd-case-row[data-pos="${orderPos}"]`);
    if (row) { row.classList.add('is-current'); row.setAttribute('aria-current', 'true'); }
  }
  // Fetch titles a few at a time, only for rows that scroll into view.
  const metaQueue = [], metaQueued = {};
  let metaInFlight = 0;
  function queueRowMeta(vid) {
    if (!vid || metaCache[vid] || metaQueued[vid]) return;
    metaQueued[vid] = true;
    metaQueue.push(vid);
    pumpMeta();
  }
  function pumpMeta() {
    while (metaInFlight < 3 && metaQueue.length) {
      const vid = metaQueue.shift();
      metaInFlight++;
      fetch(`https://noembed.com/embed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + vid)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data || !data.title) return;
          const [title, artist] = splitTitleArtist(data.title, data.author_name);
          metaCache[vid] = { title: title || 'Untitled', artist: artist || '' };
          fillCaseRow(vid);
        })
        .catch(() => {})
        .finally(() => { metaInFlight--; pumpMeta(); });
    }
  }

  function setCaseOpen(open) {
    if (open && !order.length) return;
    root.classList.toggle('is-flipped', open);
    trackBtn.setAttribute('aria-expanded', String(open));
    trackBtn.title = open ? 'Show the disc' : 'Show the track list';
    frontFace.setAttribute('aria-hidden', String(open));
    backFace.setAttribute('aria-hidden', String(!open));
    caseList.querySelectorAll('.cd-case-row').forEach((r) => { r.tabIndex = open ? 0 : -1; });
    if (open) {
      // Start with the rows around the current track; the rest load on scroll.
      for (let i = Math.max(0, orderPos - 4); i < Math.min(order.length, orderPos + 12); i++) queueRowMeta(tracks[order[i]]);
      const cur = caseList.querySelector('.cd-case-row.is-current');
      if (cur) caseList.scrollTop = cur.offsetTop - caseList.clientHeight / 2 + cur.offsetHeight / 2;
    }
  }
  trackBtn.addEventListener('click', () => setCaseOpen(!root.classList.contains('is-flipped')));
  caseList.addEventListener('click', (e) => {
    const row = e.target.closest('.cd-case-row');
    if (!row) return;
    const pos = +row.dataset.pos;
    setCaseOpen(false);
    if (pos === orderPos) { if (!isPlaying) player.playVideo(); return; }
    // Let the case flip shut before the disc swaps.
    setTimeout(() => loadTrack(pos, true, pos > orderPos ? 'next' : 'prev'), reduceMotion.matches ? 0 : 560);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-flipped')) { setCaseOpen(false); trackBtn.focus(); }
  });

  function createPlayer() {
    player = new YT.Player(hostTarget, {
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
          // cuePlaylist loads without autoplaying — the disc sits ready
          // until the visitor presses play.
          player.cuePlaylist({ listType: 'playlist', list: YT_PLAYLIST_ID });
          setInterval(updateProgress, 250);
        },
        onStateChange: function (e) {
          const S = YT.PlayerState;
          const loadState = e.data === S.PLAYING || e.data === S.BUFFERING || e.data === S.CUED;
          if (loadState && !shuffledOnce) {
            const list = player.getPlaylist();
            if (list && list.length > 1) {
              // Same approach as Music Box: read the playlist's IDs once,
              // keep our own shuffled order, and play single videos we
              // control (setShuffle / array cueing are unreliable for a
              // playlist loaded by ID).
              shuffledOnce = true;
              tracks = list.slice();
              order = buildShuffleOrder(tracks.length);
              buildCase();
              loadTrack(0, false);
              return;
            }
          }
          if (e.data === S.ENDED && order.length) {
            loadTrack(orderPos + 1, true, 'next');
            return;
          }
          refreshFromPlayer();
          // Buffering mid-song shouldn't stop the disc.
          if (e.data === S.BUFFERING && isPlaying) return;
          setPlaying(e.data === S.PLAYING);
        },
      },
    });
  }

  // Share a single IFrame API load with anything else on the page.
  function whenYTReady(cb) {
    if (window.YT && window.YT.Player) { cb(); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof prev === 'function') prev();
      cb();
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(s);
    }
  }
  whenYTReady(createPlayer);

  // ── Gestures on the disc ────────────────────────────────────────────
  // Scratch to scrub: drag the disc round to move through the song. One
  // turn = SCRATCH_SECONDS, more when you spin faster.
  // Fling to skip: swipe the disc sideways off the drive. Left = next
  // track, right = previous. A short or slow swipe springs back.
  // A tap (no real movement) plays/pauses.
  // The first ~10px decide which: movement across the disc (radial, or a
  // horizontal swipe through its middle) is a fling; movement around it is
  // a scratch. Mouse/pen can do both everywhere. Touch can fling anywhere
  // (the page still scrolls vertically), and scratch only where the page
  // opts in with data-scratch="touch" (the full-screen player).
  const SCRATCH_SECONDS = 8;
  const deckEl = $('.cd-deck');
  const liftEl = $('.cd-lift');
  const shadowEl = $('.cd-shadow');
  let gId = null, gMode = null, gStartX = 0, gStartY = 0, gCX = 0, gCY = 0, gR = 1, gW = 1;
  let lastA = 0, lastTs = 0, scratchTime = 0, scratchW = 0;
  let scratchWasPlaying = false, seekTimer = 0;
  let flingVX = 0, flingLastX = 0, flingDX = 0;
  function polar(x, y) {
    return { a: Math.atan2(y - gCY, x - gCX) * 180 / Math.PI, d: Math.hypot(x - gCX, y - gCY) / gR };
  }
  deckEl.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || gId !== null) return;
    if (root.classList.contains('is-flipped') || driveBusy || !player || !player.getDuration) return;
    const r = deckEl.getBoundingClientRect();
    gCX = r.left + r.width / 2; gCY = r.top + r.height / 2; gR = r.width / 2; gW = r.width;
    const p = polar(e.clientX, e.clientY);
    if (p.d < 0.14 || p.d > 1.02) return;            // the spindle and outside the rim don't count
    gId = e.pointerId; gMode = null;
    gStartX = e.clientX; gStartY = e.clientY;
    lastA = p.a; lastTs = performance.now();
    flingVX = 0; flingLastX = e.clientX; flingDX = 0;
    try { deckEl.setPointerCapture(e.pointerId); } catch (err) {}
    if (e.pointerType !== 'touch') e.preventDefault();
  });

  function decide(e) {
    const dx = e.clientX - gStartX, dy = e.clientY - gStartY;
    if (Math.hypot(dx, dy) < 10) return null;
    const ux = (gStartX - gCX), uy = (gStartY - gCY), ul = Math.hypot(ux, uy) || 1;
    const radial = Math.abs((dx * ux + dy * uy) / ul);
    const tangential = Math.abs((dx * uy - dy * ux) / ul);
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
    const throughMiddle = Math.abs(gStartY - gCY) < gR * 0.32;
    if (horizontal && (radial > tangential || throughMiddle)) return 'fling';
    if (e.pointerType === 'touch' && root.dataset.scratch !== 'touch') return 'none';
    return 'scratch';
  }

  function startScratch() {
    try { duration = player.getDuration() || 0; } catch (err) { duration = 0; }
    if (duration <= 0) return false;
    scratching = true; coasting = false; velocity = 0; scratchW = 0;
    try { scratchTime = player.getCurrentTime() || 0; } catch (err) { scratchTime = 0; }
    scratchWasPlaying = isPlaying;
    root.classList.add('is-scratching');
    isScrubbing = true;
    if (scratchWasPlaying) { try { player.pauseVideo(); } catch (err) {} }
    return true;
  }

  deckEl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== gId) return;
    if (!gMode) {
      gMode = decide(e);
      if (!gMode) return;
      if (gMode === 'none') { gId = null; try { deckEl.releasePointerCapture(e.pointerId); } catch (err) {} return; }
      if (gMode === 'scratch' && !startScratch()) { gMode = 'none'; return; }
      if (gMode === 'fling') root.classList.add('is-flinging');
    }
    const now = performance.now();
    const dt = Math.max(8, now - lastTs) / 1000;
    lastTs = now;
    if (gMode === 'scratch') {
      const p = polar(e.clientX, e.clientY);
      let d = p.a - lastA;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      lastA = p.a;
      scratchW = scratchW * 0.6 + (d / dt) * 0.4;      // deg/s, smoothed
      angle = (angle + d) % 360;
      const boost = 1 + Math.min(4, Math.abs(scratchW) / 720);
      scratchTime = Math.min(Math.max(0, scratchTime + (d / 360) * SCRATCH_SECONDS * boost), Math.max(0, duration - 0.5));
      lastFraction = scratchTime / duration;
      renderProgress(lastFraction, scratchTime);
      if (!seekTimer) {
        seekTimer = setTimeout(() => {
          seekTimer = 0;
          try { player.seekTo(scratchTime, false); } catch (err) {}
        }, 160);
      }
    } else if (gMode === 'fling') {
      e.preventDefault();
      flingDX = e.clientX - gStartX;
      flingVX = flingVX * 0.5 + ((e.clientX - flingLastX) / dt) * 0.5;   // px/s
      flingLastX = e.clientX;
      // The disc comes up off the spindle and follows the finger.
      const pct = (flingDX / gW) * 100;
      const lift = Math.min(1, Math.abs(pct) / 12);
      liftEl.style.transform = `translate(${pct.toFixed(2)}%, ${(-2.5 * lift).toFixed(2)}%) scale(${(1 + 0.06 * lift).toFixed(3)}) rotate(${(pct * 0.15).toFixed(2)}deg)`;
      shadowEl.style.transform = `translate(${(pct * 1.02).toFixed(2)}%, ${(3 + 6 * lift).toFixed(2)}%)`;
      shadowEl.style.opacity = (0.75 - 0.35 * lift).toFixed(3);
    }
  });

  function endGesture(e) {
    if (e.pointerId !== gId) return;
    gId = null;
    try { deckEl.releasePointerCapture(e.pointerId); } catch (err) {}
    const mode = gMode; gMode = null;
    if (!mode) {
      if (e.type === 'pointerup') togglePlay();        // a tap on the disc
      return;
    }
    if (mode === 'scratch') {
      scratching = false;
      root.classList.remove('is-scratching');
      clearTimeout(seekTimer); seekTimer = 0;
      isScrubbing = false;
      try { player.seekTo(scratchTime, true); } catch (err) {}
      if (scratchWasPlaying) { try { player.playVideo(); } catch (err) {} }
      // Let go: the disc keeps some of your spin, then eases back to speed.
      velocity = Math.max(-1440, Math.min(1440, scratchW));
      coasting = true;
      window.dispatchEvent(new CustomEvent('mixcd:scratch'));
      return;
    }
    if (mode === 'fling') {
      root.classList.remove('is-flinging');
      const far = Math.abs(flingDX) > gW * 0.22;
      const fast = Math.abs(flingVX) > 650 && Math.sign(flingVX) === Math.sign(flingDX);
      if (e.type === 'pointerup' && (far || fast) && order.length > 1) {
        // Commit: hand the disc's current position to the eject animation.
        const pct = (flingDX / gW) * 100;
        loadEl.style.setProperty('--fx', pct.toFixed(2) + '%');
        loadEl.style.setProperty('--frot', (pct * 0.15).toFixed(2) + 'deg');
        liftEl.style.transform = ''; shadowEl.style.transform = ''; shadowEl.style.opacity = '';
        pendingFling = true;
        // Swipe left = next (exits left), swipe right = previous (exits right).
        if (flingDX < 0) loadTrack(orderPos + 1, true, 'prev');
        else loadTrack(orderPos - 1, true, 'next');
        buzz(8);
        window.dispatchEvent(new CustomEvent('mixcd:fling'));
      } else {
        // Not far enough: settle back onto the spindle.
        liftEl.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.1)';
        shadowEl.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
        liftEl.style.transform = ''; shadowEl.style.transform = ''; shadowEl.style.opacity = '';
        setTimeout(() => { liftEl.style.transition = ''; shadowEl.style.transition = ''; }, 380);
      }
    }
  }
  deckEl.addEventListener('pointerup', endGesture);
  deckEl.addEventListener('pointercancel', endGesture);

  playBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', () => {
    // Like a real CD player: past the first few seconds, ⏮ restarts the track.
    let t = 0;
    try { t = player.getCurrentTime() || 0; } catch (e) {}
    if (t > 4) { player.seekTo(0, true); return; }
    loadTrack(orderPos - 1, true, 'prev');
  });
  nextBtn.addEventListener('click', () => loadTrack(orderPos + 1, true, 'next'));
})();

// ── Showcase discs ──────────────────────────────────────────────────────────
// <div class="cd-showcase" data-video="YOUTUBE_ID" data-disc="printed"></div>
// A display-only disc for feature images: it pulls one video's cover art from
// YouTube's thumbnail CDN and its title/artist via oEmbed, then spins. No
// audio, and it doesn't touch the main player above.
// Optional data-chrome="player" adds an inert (non-interactive) track pill,
// progress readout and transport row, set by data-track, data-time and
// data-duration (seconds) — for screenshots-that-aren't-screenshots.
(function () {
  const mounts = document.querySelectorAll('.cd-showcase[data-video]:not([data-built])');
  if (!mounts.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SECONDS_PER_REV = 5;
  const SKIP_BACK_PATH = 'M19.5 4.48875V19.5112C19.4972 19.7772 19.4237 20.0376 19.2872 20.2658C19.1506 20.494 18.9558 20.6818 18.7227 20.8099C18.4896 20.938 18.2267 21.0019 17.9608 20.9949C17.695 20.988 17.4357 20.9105 17.2097 20.7703L6 13.7597V20.25C6 20.4489 5.92098 20.6397 5.78033 20.7803C5.63968 20.921 5.44891 21 5.25 21C5.05109 21 4.86032 20.921 4.71967 20.7803C4.57902 20.6397 4.5 20.4489 4.5 20.25V3.75C4.5 3.55109 4.57902 3.36032 4.71967 3.21967C4.86032 3.07902 5.05109 3 5.25 3C5.44891 3 5.63968 3.07902 5.78033 3.21967C5.92098 3.36032 6 3.55109 6 3.75V10.2403L17.2097 3.22969C17.4354 3.08797 17.695 3.00918 17.9614 3.00146C18.2278 2.99374 18.4915 3.05737 18.7251 3.18578C18.9586 3.31418 19.1536 3.50269 19.2899 3.73178C19.4261 3.96086 19.4987 4.22221 19.5 4.48875Z';
  const PAUSE_PATH = 'M20.25 4.5V19.5C20.25 19.8978 20.092 20.2794 19.8107 20.5607C19.5294 20.842 19.1478 21 18.75 21H15C14.6022 21 14.2206 20.842 13.9393 20.5607C13.658 20.2794 13.5 19.8978 13.5 19.5V4.5C13.5 4.10218 13.658 3.72064 13.9393 3.43934C14.2206 3.15804 14.6022 3 15 3H18.75C19.1478 3 19.5294 3.15804 19.8107 3.43934C20.092 3.72064 20.25 4.10218 20.25 4.5ZM9 3H5.25C4.85218 3 4.47064 3.15804 4.18934 3.43934C3.90804 3.72064 3.75 4.10218 3.75 4.5V19.5C3.75 19.8978 3.90804 20.2794 4.18934 20.5607C4.47064 20.842 4.85218 21 5.25 21H9C9.39782 21 9.77936 20.842 10.0607 20.5607C10.342 20.2794 10.5 19.8978 10.5 19.5V4.5C10.5 4.10218 10.342 3.72064 10.0607 3.43934C9.77936 3.15804 9.39782 3 9 3Z';
  const SKIP_FORWARD_PATH = 'M19.5 3.75V20.25C19.5 20.4489 19.421 20.6397 19.2803 20.7803C19.1397 20.921 18.9489 21 18.75 21C18.5511 21 18.3603 20.921 18.2197 20.7803C18.079 20.6397 18 20.4489 18 20.25V13.7597L6.79031 20.7703C6.56456 20.912 6.30504 20.9908 6.0386 20.9985C5.77217 21.0063 5.50852 20.9426 5.27494 20.8142C5.04137 20.6858 4.84636 20.4973 4.71011 20.2682C4.57386 20.0391 4.50132 19.7778 4.5 19.5112V4.48875C4.50132 4.22221 4.57386 3.96086 4.71011 3.73178C4.84636 3.50269 5.04137 3.31418 5.27494 3.18578C5.50852 3.05737 5.77217 2.99374 6.0386 3.00146C6.30504 3.00918 6.56456 3.08797 6.79031 3.22969L18 10.2403V3.75C18 3.55109 18.079 3.36032 18.2197 3.21967C18.3603 3.07902 18.5511 3 18.75 3C18.9489 3 19.1397 3.07902 19.2803 3.21967C19.421 3.36032 19.5 3.55109 19.5 3.75Z';
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const lcd = (cls, text) => `<span class="cd-lcd ${cls}" data-ghost="${text.replace(/\d/g, '8')}"><span>${text}</span></span>`;
  function chrome(el) {
    const t = +el.dataset.time || 0, d = +el.dataset.duration || 0;
    const pct = d ? Math.min(100, (t / d) * 100).toFixed(2) + '%' : '0%';
    return {
      pill: `<span class="cd-track" aria-hidden="true"><svg class="cd-track-icon" viewBox="0 0 16 16" width="12" height="12"><path d="M2 3.5h12M2 8h12M2 12.5h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span class="cd-track-label">${el.dataset.track || ''}</span></span>`,
      rest: `
      <div class="cd-progress" aria-hidden="true">
        ${lcd('cd-lcd--now', fmt(t))}
        <div class="cd-bar"><span class="cd-bar-track"></span><span class="cd-bar-fill" style="width:${pct}"></span></div>
        ${lcd('cd-lcd--end', '-' + fmt(Math.max(0, d - t)))}
      </div>
      <div class="cd-controls" aria-hidden="true">
        <span class="cd-btn"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="${SKIP_BACK_PATH}"/></svg></span>
        <span class="cd-btn cd-btn--play"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="${PAUSE_PATH}"/></svg></span>
        <span class="cd-btn"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="${SKIP_FORWARD_PATH}"/></svg></span>
      </div>`,
    };
  }

  function clean(title, artist) {
    if (!artist && title && title.includes(' - ')) {
      const i = title.indexOf(' - ');
      artist = title.slice(0, i);
      title = title.slice(i + 3);
    }
    if (artist) artist = artist.replace(/\s*[-–]\s*Topic\s*$/i, '');
    return [title, artist];
  }

  mounts.forEach((el, n) => {
    const id = el.dataset.video;
    el.dataset.built = '1';
    el.classList.add('cd', 'cd--showcase', 'is-playing');
    if (el.dataset.theme === 'dark') el.classList.add('cd--dark');
    if (!el.dataset.disc) el.dataset.disc = 'printed';
    const pathId = `cd-show-path-${n}`;
    const isCase = el.dataset.chrome === 'case';
    if (isCase) el.classList.add('cd--case');
    const ch = el.dataset.chrome === 'player' || isCase ? chrome(el) : { pill: '', rest: '' };
    // data-chrome="case": the deck shows the jewel-case track list instead of
    // the disc, listing data-tracks (comma-separated video IDs).
    const caseIds = isCase ? (el.dataset.tracks || id).split(',').map((x) => x.trim()).filter(Boolean) : [];
    const cur = +el.dataset.current || 0;
    const pad2 = (k) => String(k).padStart(2, '0');
    const caseHtml = isCase ? `
        <div class="cd-face cd-face--static">
          <div class="cd-case">
            <div class="cd-case-spine"><span>MUSIC BOX · SHUFFLE</span><span>${el.dataset.count || ''}</span></div>
            <div class="cd-case-insert">
              <div class="cd-case-head"><span class="cd-case-title">Track List</span><span class="cd-case-count">${el.dataset.count || ''}</span></div>
              <ol class="cd-case-list">${caseIds.map((v, i) => `
                <li><span class="cd-case-row${i === cur ? ' is-current' : ''}" data-vid="${v}">
                  <span class="cd-case-n">${pad2(i + 1)}</span><span class="cd-case-t">Loading…</span><span class="cd-case-a"></span>
                </span></li>`).join('')}</ol>
              <div class="cd-case-foot"><span class="cd-case-barcode"></span><span class="cd-case-cat">SPF-0417 · Shuffled</span></div>
            </div>
            <div class="cd-case-spine"><span>MUSIC BOX · SHUFFLE</span><span>${el.dataset.count || ''}</span></div>
          </div>
        </div>` : '';
    el.innerHTML = `
      <div class="cd-deck" aria-hidden="true">
        <div class="cd-glow"><img alt="" /></div>
        <div class="cd-spin">
          <span class="cd-turntable"></span>
          <div class="cd-disc">
            <span class="cd-base"></span>
            <span class="cd-print"><img alt="" /></span>
            <svg class="cd-micro" viewBox="0 0 200 200">
              <defs><path id="${pathId}" d="M100 100 m-26.6 0 a26.6 26.6 0 1 1 53.2 0 a26.6 26.6 0 1 1 -53.2 0" /></defs>
              <text textLength="165" lengthAdjust="spacing"><textPath href="#${pathId}" textLength="165" lengthAdjust="spacing">CD-R · 80 MIN · 700 MB · 1×–52× · MADE IN BROOKLYN · ID 0417-A7 ★</textPath></text>
            </svg>
            <span class="cd-ink"><span class="cd-ink-title"></span><span class="cd-ink-artist"></span></span>
          </div>
          <span class="cd-hub"><i></i><i></i><i></i></span>
        </div>
        <span class="cd-iris"></span>
        <span class="cd-gloss"></span>${caseHtml}
      </div>
      <div class="cd-meta">
        ${ch.pill}
        <span class="cd-title-clip"><span class="cd-title">&nbsp;</span></span>
        <span class="cd-artist">&nbsp;</span>
      </div>${ch.rest}`;

    const printImg = el.querySelector('.cd-print img');
    const glowImg = el.querySelector('.cd-glow img');
    const spinEl = el.querySelector('.cd-spin');
    const fallback = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

    // Cover art straight from YouTube: maxres when it exists, else mqdefault.
    const probe = new Image();
    const show = (src) => {
      printImg.onload = () => printImg.classList.add('is-shown');
      printImg.src = src;
      glowImg.src = fallback;
      el.classList.add('has-art');
    };
    probe.onload = () => show(probe.naturalWidth > 120 ? probe.src : fallback);
    probe.onerror = () => show(fallback);
    probe.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

    // Title and artist from YouTube via oEmbed.
    fetch(`https://noembed.com/embed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.title) return;
        const [title, artist] = clean(data.title, data.author_name);
        el.querySelector('.cd-title').textContent = title;
        el.querySelector('.cd-artist').textContent = artist || '';
        el.querySelector('.cd-ink-title').textContent = title;
        el.querySelector('.cd-ink-artist').textContent = artist || '';
        el.setAttribute('aria-label', `CD with ${title}${artist ? ' by ' + artist : ''}`);
      })
      .catch(() => {});

    // Fill the track list's titles from YouTube.
    caseIds.forEach((v) => {
      fetch(`https://noembed.com/embed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + v)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data || !data.title) return;
          const [t, a] = clean(data.title, data.author_name);
          el.querySelectorAll(`.cd-case-row[data-vid="${v}"]`).forEach((row) => {
            row.querySelector('.cd-case-t').textContent = t;
            row.querySelector('.cd-case-a').textContent = a || '';
            row.classList.add('is-loaded');
          });
        })
        .catch(() => {});
    });

    // Constant, slow spin (eases in on load).
    let angle = 0, velocity = 0, last = 0;
    function tick(t) {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      const target = reduceMotion.matches ? 0 : 360 / SECONDS_PER_REV;
      velocity += (target - velocity) * (1 - Math.exp(-dt / 0.35));
      angle = (angle + velocity * dt) % 360;
      spinEl.style.transform = `rotate(${angle}deg)`;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
})();

// ── Tilt light ─────────────────────────────────────────────────────────────
// The rainbow off the disc and its gloss follow how the phone is held, so
// tilting it makes the CD catch the light. Drives three CSS variables on
// :root (see .cd-iris / .cd-gloss in mix-cd.css). On desktop, the mouse
// stands in for the tilt, more subtly. iOS asks permission for motion the
// first time the player itself is tapped.
(function () {
  if (!document.querySelector('.cd')) return;
  const root = document.documentElement;
  let tx = 0, ty = 0;          // target tilt, degrees from the resting pose
  let x = 0, y = 0;            // smoothed
  let base = null;             // resting pose, taken from the first reading
  let source = null;           // 'motion' | 'pointer'
  let running = false;
  const clampN = (v, m) => Math.max(-m, Math.min(m, v));

  function frame() {
    x += (tx - x) * 0.12;
    y += (ty - y) * 0.12;
    const angle = x * 2.4 + y * 1.6;                       // rainbow sweeps
    const k = Math.min(1, Math.hypot(x, y) / 28);          // brighter when tilted
    const shift = clampN(x * 0.45 - y * 0.3, 18);          // gloss slides
    root.style.setProperty('--cd-light-angle', angle.toFixed(2) + 'deg');
    root.style.setProperty('--cd-light-shift', shift.toFixed(2) + '%');
    root.style.setProperty('--cd-light-k', (0.2 + 0.8 * k).toFixed(3));
    if (Math.abs(tx - x) > 0.02 || Math.abs(ty - y) > 0.02) requestAnimationFrame(frame);
    else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    source = 'motion';
    // Undo screen rotation so "left/right" stays left/right in landscape.
    const a = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    let g = e.gamma, b = e.beta;
    if (a === 90) [g, b] = [b, -g];
    else if (a === -90 || a === 270) [g, b] = [-b, g];
    if (!base) base = { g, b };
    // Let the resting pose drift slowly, so a new grip becomes the new rest.
    base.g += (g - base.g) * 0.004;
    base.b += (b - base.b) * 0.004;
    tx = clampN(g - base.g, 40);
    ty = clampN(b - base.b, 40);
    kick();
  }
  function listenMotion() { window.addEventListener('deviceorientation', onOrient); }

  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    // iOS: must be asked from a tap.
    // Only from a tap on the player itself, so reading the page never prompts.
    const ask = (e) => {
      if (!e.target.closest || !e.target.closest('.cd')) return;
      document.removeEventListener('pointerup', ask);
      DOE.requestPermission().then((r) => { if (r === 'granted') listenMotion(); }).catch(() => {});
    };
    document.addEventListener('pointerup', ask);
  } else if (DOE) {
    listenMotion();
  }

  // Desktop: the pointer over the page plays the part of the tilt.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      if (source === 'motion') return;
      source = 'pointer';
      tx = ((e.clientX / window.innerWidth) - 0.5) * 24;
      ty = ((e.clientY / window.innerHeight) - 0.5) * 18;
      kick();
    }, { passive: true });
  }
})();
