import { defineSound, ensureReady, setMasterVolume } from './node_modules/@web-kits/audio/dist/index.js';

// ── SoundProvider ─────────────────────────────────────────────────────────────
// Module-level state acts as the sound context (SoundProvider equivalent).
// Sound is OFF by default — only enables on explicit user opt-in.
const STORAGE_KEY = 'sf-sound';

const provider = {
  enabled: localStorage.getItem(STORAGE_KEY) === 'true',
  volume: 0.65,
};

// ── Sound definitions ─────────────────────────────────────────────────────────

// Short sine sweep — subtle hover feedback for nav links
const hoverSound = defineSound({
  source: { type: 'sine', frequency: { start: 600, end: 780 } },
  envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.01 },
  gain: 0.032,
});

// Soft sine pop — confirms button/CTA interactions
const clickSound = defineSound({
  source: { type: 'sine', frequency: { start: 900, end: 460 } },
  envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 },
  gain: 0.058,
});

// Rising sine sweep — signals a page transition
const transitionSound = defineSound({
  source: { type: 'sine', frequency: { start: 480, end: 660 } },
  envelope: { attack: 0.005, decay: 0.22, sustain: 0, release: 0.12 },
  gain: 0.052,
});

// ── Playback helper ───────────────────────────────────────────────────────────

async function play(soundFn) {
  if (!provider.enabled) return;
  await ensureReady();
  setMasterVolume(provider.volume);
  soundFn();
}

// ── Toggle state ──────────────────────────────────────────────────────────────

function setEnabled(val) {
  provider.enabled = val;
  localStorage.setItem(STORAGE_KEY, String(val));
  syncUI();
}

function syncUI() {
  document.querySelectorAll('.sound-toggle').forEach(btn => {
    btn.classList.toggle('is-on', provider.enabled);
    btn.setAttribute('aria-pressed', String(provider.enabled));
    btn.setAttribute('aria-label', provider.enabled ? 'Disable sound' : 'Enable sound');
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  syncUI();

  // Sound toggle buttons
  document.querySelectorAll('.sound-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      setEnabled(!provider.enabled);
      // Audible confirmation when turning on
      if (provider.enabled) play(clickSound);
    });
  });

  // Hover sound — nav links and social links
  document.querySelectorAll('.nav-link, .nav-home, .social-link').forEach(el => {
    el.addEventListener('mouseenter', () => play(hoverSound));
  });

  // Click sound — CTA buttons and anchor-links that don't navigate pages
  document.querySelectorAll('.cta-btn, .cta-secondary').forEach(el => {
    el.addEventListener('click', () => play(clickSound));
  });

  // Click sound — buttons (excluding sound/dark toggles)
  document.querySelectorAll('button:not(.sound-toggle):not(.dark-toggle)').forEach(btn => {
    btn.addEventListener('click', () => play(clickSound));
  });

  // Transition tone — internal page navigations
  document.querySelectorAll('a[href]').forEach(el => {
    const href = el.getAttribute('href');
    // Skip anchors, mailto, external URLs, and same-page reloads
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('http') ||
      href.startsWith('//') ||
      href === window.location.pathname ||
      href === '/' && window.location.pathname === '/'
    ) return;

    el.addEventListener('click', e => {
      if (!provider.enabled) return;
      e.preventDefault();
      play(transitionSound);
      // Brief delay lets the sound's attack fire before the page unloads
      setTimeout(() => { window.location.href = href; }, 80);
    });
  });
});
