// ── Project windows ─────────────────────────────────────────────────────────
// A homepage thumbnail is a window into its project. Clicking one grows that
// window into the project's header visual while the homepage recedes and the
// case study assembles around it; going back shrinks it into its card again.
//
// Built on cross-document View Transitions: the thumbnail and the header
// visual share one view-transition-name for the length of the navigation, and
// the browser morphs one into the other. Browsers without support simply
// navigate. Loaded in <head> so the pagereveal listener exists before the
// first frame; project pages also hold that frame until #proj-hero is parsed
// (<link rel="expect">), so the header is there to be named.
(function () {
  if (!('onpagereveal' in window)) return;

  var NAME = 'project-window';

  // Have the next page ready before it is asked for: links to projects (and
  // home) start rendering in the background on hover, or as a finger lands,
  // and the homepage fetches every project's HTML up front. A click then
  // swaps to a page that is already drawn, so the transition starts at once.
  if (window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    var rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({
      prerender: [{ where: { or: [
        { selector_matches: 'a.gallery-card' },
        { selector_matches: 'a.nav-project-item' },
        { selector_matches: '.splash-nav a[href="/"], a[href="index.html"]' }
      ] }, eagerness: 'moderate' }],
      prefetch: [{ where: { selector_matches: 'a.gallery-card' }, eagerness: 'eager' }]
    });
    document.head.appendChild(rules);
  }
  var KEY = 'project-window';

  // Pages are compared by file name alone ("/clear-vault"; "/" for the
  // homepage), so the site behaves the same at the root of a domain or in a
  // sub-folder, with or without ".html".
  function path(u) {
    try {
      var p = new URL(u, location.href).pathname.split('/').pop().replace(/\.html$/, '');
      return p === '' || p === 'index' ? '/' : '/' + p;
    } catch (e) { return ''; }
  }
  function isHome(u) { return path(u) === '/'; }
  function hero() { return document.getElementById('proj-hero'); }
  // A project page is anything the Projects menu links to.
  function isProject(u) {
    var p = path(u);
    return Array.prototype.some.call(document.querySelectorAll('a.nav-project-item[href]'), function (a) {
      return path(a.href) === p;
    });
  }
  function read() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function write(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function clear() { try { sessionStorage.removeItem(KEY); } catch (e) {} }
  function frameTime(el) {
    var v = el && (el.tagName === 'VIDEO' ? el : el.querySelector && el.querySelector('video'));
    return v && v.readyState >= 1 ? v.currentTime : null;
  }
  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }
  function name(el, vt) {
    el.style.viewTransitionName = NAME;
    vt.finished.finally(function () { el.style.viewTransitionName = ''; });
  }

  // The element to grow on the way out. Grid cards are found on click; the
  // globe, which draws its tiles in WebGL, hands over a stand-in it placed
  // exactly over the tile (see home-layout.js).
  var pending = null;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var vis = a.querySelector('.gallery-card-visual');
    pending = vis ? { el: vis, to: path(a.href), t: frameTime(vis) } : null;
  }, true);
  window.projectWindow = function (el, href, t) {
    pending = { el: el, to: path(href), t: t };
  };

  addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    var to = e.activation && e.activation.entry ? e.activation.entry.url : '';
    if (pending && pending.to === path(to)) {
      name(pending.el, e.viewTransition);
      write({ to: pending.to, t: pending.t });
    } else if (hero() && isHome(to)) {
      // Leaving a project for the homepage: the header goes home.
      name(hero(), e.viewTransition);
      write({ back: path(location.href), t: frameTime(hero()) });
    } else if (hero() && isProject(to)) {
      // Project to project: one header turns into the next.
      name(hero(), e.viewTransition);
      write({ to: path(to), t: null });
    }
    pending = null;
  });

  addEventListener('pagereveal', function (e) {
    var info = read();
    clear();
    if (!e.viewTransition || !info) return;
    var root = document.documentElement;

    if (info.to && info.to === path(location.href) && hero()) {
      // Arriving on a project through its window.
      var h = hero();
      h.style.animation = 'none';            // it arrives by morphing, not by blurring in
      var st = document.querySelector('.cs-story');
      if (st) st.style.animationDuration = '0.5s';   // the story settles in quickly around it
      name(h, e.viewTransition);
      root.classList.add('pw-arrive');
      e.viewTransition.finished.finally(function () { root.classList.remove('pw-arrive'); });
      syncVideo(h, info.t);
    } else if (info.back && isHome(location.href)) {
      // Back on the homepage: shrink into the card if it is on screen.
      var card = document.querySelector('a.gallery-card[href="' + info.back.slice(1) + '.html"] .gallery-card-visual, a.gallery-card[href="' + info.back.slice(1) + '"] .gallery-card-visual');
      // In globe mode a page restored from the back/forward cache still has
      // the flat stand-in lying exactly over its tile: shrink into that.
      var standin = document.querySelector('.pw-standin') || globeStandin(info.back);
      if (card && inView(card)) {
        name(card, e.viewTransition);
        syncVideo(card, info.t);
      } else if (standin) {
        name(standin, e.viewTransition);
      }
      root.classList.add('pw-return');
      e.viewTransition.finished.finally(function () {
        root.classList.remove('pw-return');
        // A fresh-load stand-in waits for the globe; give up if it never comes.
        if (window.projectWindowFacing) setTimeout(releaseStandins, 4000);
        else releaseStandins();
      });
    }
    releaseStandinsLater = false;
  });

  // ── Back into the globe ─────────────────────────────────────────────────
  // On a fresh load the globe (WebGL, loaded as a module) does not exist yet
  // when the page is revealed. Its geometry is fixed, though, so the place its
  // tile will sit once turned to face the viewer can be worked out now: a
  // stand-in showing the tile's still goes there, the header shrinks into it,
  // and the globe starts with that tile facing front and takes over from the
  // stand-in once it has drawn (see home-layout.js). These numbers mirror
  // createGlobe() there; change them together.
  function globeStandin(back) {
    if (!document.documentElement.classList.contains('layout-globe-pending')) return null;
    var mount = document.getElementById('globe-canvas');
    var cards = Array.prototype.slice.call(document.querySelectorAll('#project-grid a.gallery-card'));
    var filter = 'all';                  // the homepage no longer filters
    var visible = cards.filter(function (c) {
      return filter === 'all' || (c.dataset.cat || '').split(/\s+/).indexOf(filter) !== -1;
    });
    var card = visible.filter(function (c) { return path(c.getAttribute('href')) === back; })[0];
    if (!mount || !card) return null;
    var r = mount.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var v = card.querySelector('video'), img = card.querySelector('img.gv-video');
    var still = v ? v.getAttribute('poster') : img && img.getAttribute('src');
    if (!still) return null;

    var n = visible.length;
    var R = Math.max(2.4, Math.min(4.0, 1.35 + n * 0.196));
    var TW = 3.4, TH = TW * (314 / 575);
    var extent = Math.hypot(R, Math.hypot(TW / 2, TH / 2));
    var vHalf = (42 * Math.PI / 180) / 2;
    var hHalf = Math.atan(Math.tan(vHalf) * (r.width / r.height));
    var d = 1.04 * extent / Math.sin(Math.min(vHalf, hHalf));
    var ppu = r.height / (2 * (d - R) * Math.tan(vHalf));      // pixels per unit at the tile
    var w = TW * ppu, h = TH * ppu;

    var el = document.createElement('img');
    el.className = 'pw-standin';
    el.src = still;
    el.alt = '';
    Object.assign(el.style, {
      position: 'fixed', zIndex: 50, pointerEvents: 'none', objectFit: 'cover',
      left: (r.left + r.width / 2 - w / 2) + 'px', top: (r.top + r.height / 2 - h / 2) + 'px',
      width: w + 'px', height: h + 'px', borderRadius: (w * 0.031) + 'px',
      transition: 'opacity 0.25s ease',
    });
    document.body.appendChild(el);
    window.projectWindowFacing = card.getAttribute('href');
    return el;
  }
  // The globe has drawn with the tile facing front: fade the stand-in off it.
  addEventListener('projectwindow:globe-ready', function () {
    var s = document.querySelectorAll('.pw-standin');
    if (!s.length) return;
    s.forEach(function (n) { n.style.opacity = '0'; });
    setTimeout(releaseStandins, 260);
  });

  // The stand-in stays until the way back has used it, then the globe is let go.
  var releaseStandinsLater = false;
  function releaseStandins() {
    document.querySelectorAll('.pw-standin').forEach(function (n) { n.remove(); });
    dispatchEvent(new Event('projectwindow:released'));
  }

  // Pick the video up where the thumbnail left it, so the window keeps playing.
  function syncVideo(el, t) {
    var v = el.querySelector('video');
    if (!v || t == null) return;
    var go = function () {
      try { v.currentTime = Math.min(t, (v.duration || t + 1) - 0.05); } catch (e) {}
      v.play().catch(function () {});
    };
    if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
  }

  // A page restored from the back/forward cache comes back exactly as it was
  // left, stand-in included. Clear it.
  addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    document.querySelectorAll('[style*="view-transition-name"]').forEach(function (n) { n.style.viewTransitionName = ''; });
    // pagereveal runs next and may use the stand-in; if it doesn't, drop it.
    releaseStandinsLater = true;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (releaseStandinsLater) releaseStandins();
    }); });
  });
})();
