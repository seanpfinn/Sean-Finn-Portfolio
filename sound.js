import { defineSound, ensureReady, setMasterVolume } from './node_modules/@web-kits/audio/dist/index.js';

const VOLUME = 0.65;

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

async function play(soundFn) {
  await ensureReady();
  setMasterVolume(VOLUME);
  soundFn();
}

document.addEventListener('DOMContentLoaded', () => {
  // Hover sound — nav links and social links
  document.querySelectorAll('.nav-link, .nav-home, .social-link').forEach(el => {
    el.addEventListener('mouseenter', () => play(hoverSound));
  });

  // Click sound — CTA buttons and anchor-links that don't navigate pages
  document.querySelectorAll('.cta-btn, .cta-secondary').forEach(el => {
    el.addEventListener('click', () => play(clickSound));
  });

  // Click sound — buttons (excluding dark toggle)
  document.querySelectorAll('button:not(.dark-toggle)').forEach(btn => {
    btn.addEventListener('click', () => play(clickSound));
  });

  // Transition tone — internal page navigations
  document.querySelectorAll('a[href]').forEach(el => {
    const href = el.getAttribute('href');
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('http') ||
      href.startsWith('//') ||
      href === window.location.pathname ||
      (href === '/' && window.location.pathname === '/')
    ) return;

    el.addEventListener('click', e => {
      e.preventDefault();
      play(transitionSound);
      setTimeout(() => { window.location.href = href; }, 80);
    });
  });
});
