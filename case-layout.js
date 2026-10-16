// ── Case-study layout: the window stays ────────────────────────────────────
// The homepage thumbnail lands as this page's stage: one large panel pinned
// beside the story, showing the visual for whichever chapter is being read.
// A strip under the stage marks the chapters and how far through each one the
// reader is; a segment jumps to its chapter.
//
// The page's HTML stays as written (a header, then captions each followed by
// their panels). This script runs right after <main> and regroups it before
// the first frame; without it the original single column is what shows.
// The stage takes the id proj-hero so the window transition (page-transition.js)
// lands on it, and #cs-ready, placed after this script, is what the page
// waits for before it is revealed.
(function () {
  var col = document.querySelector('body.proj-page .proj-col');
  if (!col || !col.querySelector('.proj-panel-new')) return;

  var PANEL_W = 780;   // the panels' native size (48.75rem × 29.6875rem);
  var PANEL_H = 475;   // the stage keeps their proportions and scales them

  // ── Read the page into chapters ────────────────────────────────────────
  var header = col.querySelector('.proj-header-group');
  var chapters = [];
  var current = null;
  Array.prototype.slice.call(col.children).forEach(function (el) {
    if (el === header) return;
    if (el.classList.contains('proj-caption')) {
      var label = el.querySelector('.proj-caption-label');
      current = { caption: el, label: label ? label.textContent.trim() : '', media: [], notes: [] };
      chapters.push(current);
    } else if (el.classList.contains('proj-panel-new') || el.classList.contains('proj-panel-group')) {
      if (!current) {
        current = { caption: null, label: 'Overview', media: [], notes: [] };
        chapters.push(current);
      }
      var panels = el.classList.contains('proj-panel-new') ? [el] : el.querySelectorAll(':scope > .proj-panel-new');
      Array.prototype.forEach.call(panels, function (p) { current.media.push(p); });
      Array.prototype.forEach.call(el.querySelectorAll('.proj-image-caption'), function (n) { current.notes.push(n); });
    }
  });
  if (!chapters.length) return;

  // A chapter with no visual of its own keeps the one before it on stage.
  var slides = [];
  chapters.forEach(function (ch, i) {
    ch.first = slides.length;
    ch.media.forEach(function (m, k) { slides.push({ el: m, ch: i, k: k }); });
    ch.count = ch.media.length;
  });
  var lastSlide = -1;
  chapters.forEach(function (ch) {
    if (ch.count) lastSlide = ch.first + ch.count - 1;
    ch.hold = ch.count ? -1 : lastSlide;
  });

  // ── Build ──────────────────────────────────────────────────────────────
  document.documentElement.classList.add('cs-v2');

  var story = document.createElement('div');
  story.className = 'cs-story';
  if (header) story.appendChild(header);

  chapters.forEach(function (ch, i) {
    var sec = document.createElement('section');
    sec.className = 'cs-chapter';
    sec.dataset.i = i;
    sec.style.setProperty('--n', Math.max(1, ch.count));
    if (ch.caption) {
      var num = document.createElement('span');
      num.className = 'cs-num';
      num.textContent = String(i + 1).padStart(2, '0');
      num.setAttribute('aria-hidden', 'true');
      var lab = ch.caption.querySelector('.proj-caption-label');
      if (lab) lab.prepend(num);
      sec.appendChild(ch.caption);
    }
    ch.notes.forEach(function (n) { n.classList.add('cs-note'); sec.appendChild(n); });
    story.appendChild(sec);
    ch.section = sec;
  });

  var wrap = document.createElement('div');
  wrap.className = 'cs-stage-wrap';
  var stage = document.createElement('div');
  stage.className = 'cs-stage';
  var hero = document.getElementById('proj-hero');
  if (hero) hero.removeAttribute('id');
  stage.id = 'proj-hero';
  slides.forEach(function (s, n) {
    var slot = document.createElement('div');
    slot.className = 'cs-slide';
    slot.dataset.n = n;
    s.el.style.animation = 'none';
    slot.appendChild(s.el);
    stage.appendChild(slot);
    s.slot = slot;
    // The stage plays only the slide on show; the page-wide in-view
    // observer would otherwise start every stacked video at once.
    Array.prototype.forEach.call(s.el.querySelectorAll('video'), function (v) {
      v.removeAttribute('data-play-in-view');
      v.removeAttribute('autoplay');
      v.preload = n === 0 ? 'auto' : 'metadata';
    });
  });

  var strip = document.createElement('nav');
  strip.className = 'cs-strip';
  strip.setAttribute('aria-label', 'Chapters');
  var segs = document.createElement('div');
  segs.className = 'cs-segs';
  chapters.forEach(function (ch, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cs-seg';
    b.setAttribute('aria-label', 'Go to ' + (ch.label || 'chapter ' + (i + 1)));
    b.innerHTML = '<span class="cs-seg-fill"></span>';
    b.addEventListener('click', function () { goTo(i); });
    segs.appendChild(b);
    ch.seg = b;
  });
  var now = document.createElement('p');
  now.className = 'cs-now';
  now.setAttribute('aria-live', 'polite');
  strip.appendChild(segs);
  strip.appendChild(now);

  wrap.appendChild(stage);
  wrap.appendChild(strip);
  // Story and stage share one section, so the pinned stage lets go when the
  // story ends instead of riding over what follows (the next-project cards
  // main.js appends to the column).
  var body = document.createElement('div');
  body.className = 'cs-body';
  body.appendChild(story);
  body.appendChild(wrap);
  col.textContent = '';
  col.appendChild(body);

  // ── Fit the panels to the stage ─────────────────────────────────────────
  function fit() {
    var w = stage.clientWidth;
    if (w) stage.style.setProperty('--fit', (w / PANEL_W).toFixed(4));
    // Centre the pinned stage and its strip in the viewport (desktop only;
    // the phone rule pins it under the nav bar instead).
    if (window.innerWidth > 809) {
      var top = Math.max(24, (window.innerHeight - wrap.offsetHeight) / 2);
      wrap.style.setProperty('--wrap-top', top + 'px');
    } else {
      wrap.style.removeProperty('--wrap-top');
    }
  }
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(stage);

  // ── Follow the reader ───────────────────────────────────────────────────
  var shown = -1, active = -1, ticking = false;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function line() {
    // The reading line sits a little above the middle of the screen, or just
    // under the stage on a phone, where the stage covers the top.
    var r = wrap.getBoundingClientRect();
    return window.innerWidth <= 809 ? r.bottom + 48 : window.innerHeight * 0.42;
  }

  function show(n, forward) {
    if (n === shown || n < 0) return;
    var prev = slides[shown];
    var next = slides[n];
    if (prev) {
      prev.slot.classList.remove('is-on');
      prev.slot.classList.toggle('is-past', forward);
      prev.slot.classList.toggle('is-ahead', !forward);
      Array.prototype.forEach.call(prev.slot.querySelectorAll('video'), function (v) { v.pause(); });
    }
    next.slot.classList.remove('is-past', 'is-ahead');
    next.slot.classList.add('is-on');
    var bg = getComputedStyle(next.el).backgroundColor;
    stage.style.setProperty('--stage-bg', bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '');
    Array.prototype.forEach.call(next.slot.querySelectorAll('video'), function (v) {
      v.play().catch(function () {});
    });
    shown = n;
  }

  function update() {
    ticking = false;
    var y = line();
    var a = 0, progress = 0;
    chapters.forEach(function (ch, i) {
      var r = ch.section.getBoundingClientRect();
      if (r.top <= y) { a = i; progress = Math.min(1, Math.max(0, (y - r.top) / Math.max(1, r.height))); }
    });
    // Reaching the bottom of the page completes the last chapter.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      a = chapters.length - 1; progress = 1;
    }
    chapters.forEach(function (ch, i) {
      var f = i < a ? 1 : i > a ? 0 : progress;
      ch.seg.style.setProperty('--p', f.toFixed(3));
      ch.section.classList.toggle('is-active', i === a);
      ch.seg.classList.toggle('is-active', i === a);
    });
    var ch = chapters[a];
    var n = ch.count ? ch.first + Math.min(ch.count - 1, Math.floor(progress * ch.count)) : ch.hold;
    if (n < 0) n = 0;
    show(n, n > shown);
    if (a !== active) {
      active = a;
      now.innerHTML = '<span class="cs-now-label"></span><span class="cs-now-count"></span>';
      now.firstChild.textContent = ch.label;
      now.lastChild.textContent = (a + 1) + ' of ' + chapters.length;
    }
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  function goTo(i) {
    var r = chapters[i].section.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - line() + 2, behavior: reduce ? 'auto' : 'smooth' });
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', function () { fit(); onScroll(); });
  update();
})();
