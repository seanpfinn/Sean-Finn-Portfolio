// ── Case studies: TL;DR / Detailed ─────────────────────────────────────────
// Every case study opens on a TL;DR: the same project told image-first, with
// its header, its pictures and a few one-line takeaways. "Detailed" is the
// full write-up (the board on desktop, the scrolling story on phones).
//
// The TL;DR is built from the page's own markup, so it never drifts from the
// write-up: an inline script right after </main> keeps an untouched copy of
// the case study (window.__csSrc) before the layouts rearrange it, and this
// file, loaded after them, turns that copy into a full-screen sheet over the
// detailed view. Switching is instant and remembered.
(function () {
  var src = window.__csSrc;
  var col = document.querySelector('.proj-col');
  if (!src || !col) return;

  var root = document.documentElement;
  var q = new URLSearchParams(location.search).get('view');
  // Every visit opens on the TL;DR; ?view=detailed links straight to the rest.
  var mode = q === 'detailed' ? 'detailed' : 'tldr';

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function text(n) { return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function sentences(s) { return s.match(/[^.!?]+(?:[.!?]+(?=\s+[A-Z“"(]|$)|$)/g) || [s]; }
  // The lead sentence, or the first two when the first is only a few words.
  function lead(s) {
    var all = sentences(s), out = all[0].trim();
    if (out.length < 60 && all[1]) out += ' ' + all[1].trim();
    return out;
  }
  // Clones must not carry ids (the page already has them) or hooks for
  // scripts that only bind to the originals.
  function scrub(n) {
    if (n.nodeType !== 1) return n;
    n.removeAttribute('id');
    n.querySelectorAll('[id]').forEach(function (c) { c.removeAttribute('id'); });
    n.querySelectorAll('video').forEach(function (v) {
      v.removeAttribute('data-play-in-view');
      v.setAttribute('preload', 'metadata');
      v.muted = true;
      v.setAttribute('data-tldr-video', '');
    });
    n.querySelectorAll('img').forEach(function (i) { i.setAttribute('loading', 'lazy'); i.setAttribute('decoding', 'async'); });
    return n;
  }

  // ── Read the write-up ────────────────────────────────────────────────────
  var header = src.querySelector('.proj-header-group');
  var chapters = [];         // {label, body}
  var shots = [];            // {panel, caption, chapter}
  var current = null;
  Array.prototype.forEach.call(src.children, function (n) {
    if (n.classList.contains('proj-caption')) {
      current = { label: text(n.querySelector('.proj-caption-label')), body: text(n.querySelector('.proj-caption-body')) };
      chapters.push(current);
      return;
    }
    if (!n.classList.contains('proj-panel-group') && !n.classList.contains('proj-panel-new')) return;
    var panel = n.classList.contains('proj-panel-new') ? n : n.querySelector('.proj-panel-new');
    if (!panel) return;
    // Live demos and script-driven panels belong to the write-up; a dead copy
    // of them would just be an empty frame.
    if (panel.querySelector('iframe, .live-start') || panel.classList.contains('proj-panel--embed')) return;
    if (!panel.querySelector('img, video, svg, picture, canvas')) return;
    var cap = n.querySelector && n.querySelector('.proj-image-caption');
    shots.push({ panel: panel, caption: text(cap), chapter: current ? current.label : '' });
  });

  function pick(re) {
    for (var i = 0; i < chapters.length; i++) if (re.test(chapters[i].label) && chapters[i].body && !/^(TODO|Placeholder)/i.test(chapters[i].body)) return chapters[i];
    return null;
  }
  var takeaways = [];
  [[[/^(problem|challenge)/i], 'Problem'],
   [[/(approach|process)/i, /(role|options|bodies|finishes|the mark)/i], 'Approach'],
   [[/^(outcome|result|impact)/i, /^summary/i, /^before/i], 'Outcome']].forEach(function (t) {
    var c = null;
    for (var i = 0; !c && i < t[0].length; i++) c = pick(t[0][i]);
    if (c && takeaways.every(function (x) { return x.c !== c; })) takeaways.push({ c: c, title: t[1] });
  });
  if (!takeaways.length && chapters[0]) takeaways.push({ c: chapters[0], title: chapters[0].label });

  // ── The toggle ───────────────────────────────────────────────────────────
  var toggles = [];
  function toggle() {
    var t = el('div', 'view-toggle');
    t.setAttribute('role', 'tablist');
    t.setAttribute('aria-label', 'Case study length');
    t.innerHTML = '<span class="view-toggle-thumb" aria-hidden="true"></span>' +
      '<button type="button" role="tab" data-view="tldr">TL;DR</button>' +
      '<button type="button" role="tab" data-view="detailed">Detailed</button>';
    t.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-view]');
      if (b) set(b.dataset.view, true);
    });
    toggles.push(t);
    return t;
  }

  // ── Build the TL;DR sheet ────────────────────────────────────────────────
  var sheet = el('div', 'tldr');
  sheet.setAttribute('aria-label', 'TL;DR');
  var inner = el('div', 'tldr-inner');
  sheet.appendChild(inner);

  var head = el('header', 'tldr-head');
  if (header) {
    var h = scrub(header.cloneNode(true));
    h.className = 'tldr-header';
    head.appendChild(h);
  }
  inner.appendChild(head);

  var heroShot = shots.shift();
  if (heroShot) {
    var hf = el('figure', 'tldr-hero');
    hf.appendChild(scrub(heroShot.panel.cloneNode(true)));
    inner.appendChild(hf);
  }

  if (takeaways.length) {
    var tk = el('section', 'tldr-takeaways');
    takeaways.forEach(function (t) {
      var item = el('div', 'tldr-take');
      item.appendChild(el('span', 'tldr-take-label', t.title));
      item.appendChild(el('p', 'tldr-take-body', lead(t.c.body)));
      tk.appendChild(item);
    });
    inner.appendChild(tk);
  }

  if (shots.length) {
    var grid = el('section', 'tldr-grid' + (shots.length === 1 ? ' is-single' : ''));
    shots.forEach(function (s, i) {
      var f = el('figure', 'tldr-shot');
      f.appendChild(scrub(s.panel.cloneNode(true)));
      var label = s.chapter ? '<span class="tldr-shot-chapter">' + s.chapter.replace(/&/g, '&amp;') + '</span>' : '';
      var cap = s.caption || '';
      if (label || cap) {
        var fc = el('figcaption', 'tldr-shot-cap');
        fc.innerHTML = label + (cap ? '<span>' + cap.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>' : '');
        f.appendChild(fc);
      }
      grid.appendChild(f);
    });
    inner.appendChild(grid);
  }

  var more = el('section', 'tldr-more');
  var go = el('button', 'tldr-go', 'Read the detailed case study <span aria-hidden="true">→</span>');
  go.type = 'button';
  go.addEventListener('click', function () { set('detailed', true); });
  more.appendChild(go);
  inner.appendChild(more);

  document.body.appendChild(sheet);

  // One toggle for both views, floating in the top bar where the page's
  // running title used to sit, so it's in reach wherever you are.
  var bar = toggle();
  bar.classList.add('view-toggle--float');
  document.body.appendChild(bar);
  // The case study's name, right under the toggle.
  var h1 = src.querySelector('.proj-title-new');
  if (h1) {
    var vt = el('div', 'vt-title');
    vt.setAttribute('aria-hidden', 'true');
    vt.textContent = text(h1);
    document.body.appendChild(vt);
  }

  // Show that name only once the view's own big title has gone under the bar.
  var gone = { tldr: false, detailed: false };
  function syncTitle() { root.classList.toggle('vt-titled', !!gone[mode]); }
  if ('IntersectionObserver' in window) {
    var titleIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var which = sheet.contains(e.target) ? 'tldr' : 'detailed';
        gone[which] = !e.isIntersecting && e.boundingClientRect.top < innerHeight / 2;
      });
      syncTitle();
    }, { rootMargin: '-72px 0px 0px 0px' });
    var big = [sheet.querySelector('.proj-title-new'), col.querySelector('.proj-title-new') || document.querySelector('.proj-header-group .proj-title-new')];
    big.forEach(function (n) { if (n) titleIO.observe(n); });
  }
  root.classList.add('has-view-toggle');

  // "More case studies" is added by main.js after this; copy it in once it is.
  document.addEventListener('DOMContentLoaded', function () { setTimeout(copyMore, 0); });
  function copyMore() {
    var pm = document.querySelector('.proj-more');
    if (pm && !inner.querySelector('.proj-more')) {
      var c = scrub(pm.cloneNode(true));
      inner.appendChild(c);
      watch(c);
    }
  }

  // ── Videos: only the view on screen plays ───────────────────────────────
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting && root.classList.contains('tldr-on')) v.play().catch(function () {});
      else v.pause();
    });
  }, { root: sheet, threshold: 0.35 }) : null;
  function watch(scope) {
    if (!io) return;
    scope.querySelectorAll('video').forEach(function (v) { v.muted = true; v.loop = true; v.playsInline = true; io.observe(v); });
  }
  watch(inner);

  // A picture that fails to load takes its frame with it.
  inner.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || !/^(IMG|VIDEO|SOURCE)$/.test(t.tagName)) return;
    var f = t.closest('.tldr-shot, .tldr-hero');
    if (f && !f.querySelector('img:not([src="' + t.getAttribute('src') + '"]), svg, canvas')) f.remove();
  }, true);

  function detailedVideos() {
    return Array.prototype.filter.call(document.querySelectorAll('video'), function (v) { return !sheet.contains(v); });
  }

  // ── Switching ────────────────────────────────────────────────────────────
  // The homepage window transition grows into whichever view is showing, so
  // the view that's up holds the id proj-hero (page-transition.js).
  var stageHero = null;
  var sheetHero = sheet.querySelector('.tldr-hero .proj-panel-new');
  function claimHero(tldr) {
    if (!stageHero) stageHero = document.getElementById('proj-hero');
    if (!stageHero || !sheetHero) return;
    if (tldr) { stageHero.id = 'proj-hero-detail'; sheetHero.id = 'proj-hero'; }
    else { sheetHero.removeAttribute('id'); stageHero.id = 'proj-hero'; }
  }

  var resume = [];
  function set(m, user) {
    mode = m === 'detailed' ? 'detailed' : 'tldr';
    var on = mode === 'tldr';
    root.classList.toggle('tldr-on', on);
    sheet.hidden = !on;
    sheet.setAttribute('aria-hidden', on ? 'false' : 'true');
    toggles.forEach(function (t) {
      t.dataset.active = mode;
      t.querySelectorAll('button').forEach(function (b) {
        var sel = b.dataset.view === mode;
        b.setAttribute('aria-selected', sel ? 'true' : 'false');
        b.tabIndex = sel ? 0 : -1;
      });
    });
    claimHero(on);
    if (typeof syncTitle === 'function') syncTitle();
    if (on) {
      // Remember what the write-up was playing, to pick it back up after.
      resume = detailedVideos().filter(function (v) { return !v.paused || v.autoplay; });
      resume.forEach(function (v) { v.pause(); });
      if (user) { sheet.scrollTop = 0; gone.tldr = false; }
    } else {
      sheet.querySelectorAll('video').forEach(function (v) { v.pause(); });
      // Wake the write-up's videos that are on screen (they paused while hidden).
      resume.forEach(function (v) { v.play().catch(function () {}); });
      resume = [];
      detailedVideos().forEach(function (v) {
        if (!v.hasAttribute('data-play-in-view')) return;
        var r = v.getBoundingClientRect();
        if (r.width && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) v.play().catch(function () {});
      });
      if (user && !window.BOARD_ACTIVE) window.scrollTo(0, 0);
      dispatchEvent(new Event('resize'));
    }
    if (user) {
      try { var u = new URL(location.href); u.searchParams.delete('view'); history.replaceState(history.state, '', u); } catch (e) {}
    }
  }
  window.csView = { set: set, get: function () { return mode; } };
  set(mode, false);
})();
