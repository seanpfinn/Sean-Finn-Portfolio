// CD Player — a YouTube-playlist disc player.
// Pair with cdplayer.css. The current track's cover art is printed onto a
// compact disc (or stuck onto a burned CD-R, with the title written on in
// marker). The disc spins up when playback starts and coasts to a stop when
// it pauses; the rainbow off its metal layer stays put while it turns.
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

  const MICRO = 'CD-R · 80 MIN · 700 MB · 1×–52× · MADE IN BROOKLYN · ID 0417-A7 ★';
  root.innerHTML = `
    <div class="cd-deck">
      <div class="cd-glow" aria-hidden="true"><img alt="" /></div>
      <div class="cd-spin" aria-hidden="true">
        <span class="cd-turntable"></span>
        <div class="cd-disc">
          <span class="cd-base"></span>
          <span class="cd-print"><img alt="" /><img alt="" /></span>
          <svg class="cd-micro" viewBox="0 0 200 200">
            <defs><path id="cd-micro-path" d="M100 100 m-26.6 0 a26.6 26.6 0 1 1 53.2 0 a26.6 26.6 0 1 1 -53.2 0" /></defs>
            <text textLength="165" lengthAdjust="spacing"><textPath href="#cd-micro-path" textLength="165" lengthAdjust="spacing">${MICRO}</textPath></text>
          </svg>
          <span class="cd-ink"><span class="cd-ink-title"></span><span class="cd-ink-artist"></span></span>
        </div>
        <span class="cd-hub"><i></i><i></i><i></i></span>
      </div>
      <span class="cd-iris" aria-hidden="true"></span>
      <span class="cd-gloss" aria-hidden="true"></span>
    </div>

    <div class="cd-meta" aria-live="polite">
      <span class="cd-track">Track --</span>
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
  const printImgs = root.querySelectorAll('.cd-print img');
  const glowImg = $('.cd-glow img');
  const inkTitle = $('.cd-ink-title');
  const inkArtist = $('.cd-ink-artist');
  const trackEl = $('.cd-track');
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
    const target = isPlaying && !reduceMotion.matches ? 360 / SECONDS_PER_REV : 0;
    const tau = (target > velocity ? SPIN_UP_SECONDS : SPIN_DOWN_SECONDS) / 4;
    velocity += (target - velocity) * (1 - Math.exp(-dt / tau));
    if (Math.abs(velocity) < 0.05 && target === 0) velocity = 0;
    angle = (angle + velocity * dt) % 360;
    spinEl.style.transform = `rotate(${angle}deg)`;
    requestAnimationFrame(spin);
  }
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
  let shownArt = null, frontImg = 0;
  function setArt(videoId) {
    if (!videoId || videoId === shownArt) return;
    shownArt = videoId;
    const fallback = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    const show = (src) => {
      if (shownArt !== videoId) return;
      const next = printImgs[1 - frontImg], prev = printImgs[frontImg];
      next.onload = () => {
        next.classList.add('is-shown');
        prev.classList.remove('is-shown');
        frontImg = 1 - frontImg;
      };
      next.src = src;
      glowImg.src = fallback;
      root.classList.add('has-art');
    };
    const probe = new Image();
    probe.onload = () => show(probe.naturalWidth > 120 ? probe.src : fallback);
    probe.onerror = () => show(fallback);
    probe.src = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }

  function setMeta(rawTitle, rawArtist, videoId) {
    const [title, artist] = splitTitleArtist(rawTitle, rawArtist);
    const t = title || 'Music';
    if (titleEl.textContent !== t) {
      titleEl.textContent = t;
      updateTicker();
    }
    artistEl.textContent = artist || '';
    // The marker scrawl on a burned disc.
    inkTitle.textContent = t;
    inkTitle.classList.toggle('is-long', t.length > 16);
    inkArtist.textContent = artist || '';
    setArt(videoId);
  }

  function setTrackNumber() {
    if (!order.length) return;
    const pad = (n) => String(n).padStart(2, '0');
    trackEl.textContent = `Track ${pad(orderPos + 1)} / ${pad(order.length)}`;
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
  function loadTrack(pos, autoplay) {
    if (!player || !order.length) return;
    orderPos = ((pos % order.length) + order.length) % order.length;
    const vid = tracks[order[orderPos]];
    lastFraction = 0;
    renderProgress(0, 0);
    setTrackNumber();
    fetchMetaByVideoId(vid);
    if (autoplay) player.loadVideoById(vid);
    else player.cueVideoById(vid);
  }

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
              loadTrack(0, false);
              return;
            }
          }
          if (e.data === S.ENDED && order.length) {
            loadTrack(orderPos + 1, true);
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

  playBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', () => {
    // Like a real CD player: past the first few seconds, ⏮ restarts the track.
    let t = 0;
    try { t = player.getCurrentTime() || 0; } catch (e) {}
    if (t > 4) { player.seekTo(0, true); return; }
    loadTrack(orderPos - 1, true);
  });
  nextBtn.addEventListener('click', () => loadTrack(orderPos + 1, true));
})();
