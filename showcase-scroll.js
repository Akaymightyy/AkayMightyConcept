// =====================================================================
//  showcase-scroll.js  v21
//  ---------------------------------------------------------------------
//  FIX: Removed pointer event drag handlers that were capturing all
//  touch events (via setPointerCapture) and blocking vertical page
//  scroll. Now uses:
//    • Native overflow-x: auto for horizontal scroll (works with touch)
//    • rAF for smooth auto-play
//    • Passive touch listeners (don't block anything)
//    • CSS touch-action: pan-x pan-y (browser handles both directions)
//
//  Exposes window.initShowcase() so projects-renderer.js can re-init
//  after dynamically rendering project cards.
// =====================================================================

const SPEED = 0.2;           // px per ms
const RESUME_DELAY = 2500;  // ms after last interaction before auto-play resumes

function initShowcase() {
  document.querySelectorAll('.showcase-track-wrap').forEach(initWrap);
  console.log('[showcase] initShowcase — found', document.querySelectorAll('.showcase-track-wrap').length, 'tracks');
}
window.initShowcase = initShowcase;

function initWrap(wrap) {
  // If a previous init already started an animation loop (e.g. it ran
  // once on page load before real cards existed, measuring width 0),
  // cancel that loop first so re-running this doesn't stack a second
  // loop on top of it and fight over wrap.scrollLeft.
  if (wrap._akayShowcaseRafId) {
    cancelAnimationFrame(wrap._akayShowcaseRafId);
    wrap._akayShowcaseRafId = null;
  }
  if (wrap._akayShowcaseIO) {
    wrap._akayShowcaseIO.disconnect();
  }

  const strip = wrap.querySelector('.showcase-strip');
  if (!strip) return;
  const direction = strip.getAttribute('data-direction') === 'right' ? -1 : 1;

  // Track half-width for seamless loop (content is duplicated)
  let halfWidth = 0;
  function measure() {
    halfWidth = strip.scrollWidth / 2;
    if (!halfWidth || halfWidth < 100) halfWidth = strip.scrollWidth;
  }
  measure();
  window.addEventListener('resize', measure);
  // Re-measure when images load
  strip.querySelectorAll('img').forEach(img => {
    if (img.complete) return;
    img.addEventListener('load', measure, { once: true });
    img.addEventListener('error', measure, { once: true });
  });

  // State
  let isHovering = false;
  let isTouching = false;
  let lastInteract = 0;
  let lastFrame = performance.now();
  let rafId = null;
  let isAutoScrolling = false;

  function tick(now) {
    const dt = Math.min(now - lastFrame, 50);
    lastFrame = now;

    const inEditMode = document.body.classList.contains('akay-edit-mode');
    const recentlyInteracted = (now - lastInteract) < RESUME_DELAY;
    const shouldAutoPlay = !isHovering && !isTouching && !inEditMode && !recentlyInteracted;

    if (shouldAutoPlay) {
      wrap.classList.add('is-autoplaying');
      const dx = SPEED * dt * direction;
      let next = wrap.scrollLeft + dx;

      // Seamless wrap-around
      if (direction > 0) {
        if (next >= halfWidth) next -= halfWidth;
      } else {
        if (next <= 0) next += halfWidth;
      }

      isAutoScrolling = true;
      wrap.scrollLeft = next;
      Promise.resolve().then(() => { isAutoScrolling = false; });
    } else {
      wrap.classList.remove('is-autoplaying');
    }
    rafId = requestAnimationFrame(tick);
    wrap._akayShowcaseRafId = rafId;
  }
  rafId = requestAnimationFrame(tick);
  wrap._akayShowcaseRafId = rafId;

  // Interaction listeners only need attaching once ever — they don't
  // depend on the content inside the strip, so re-running initWrap
  // (to restart the scroll loop with real content) must not stack
  // duplicate listeners.
  if (wrap.dataset.akayShowcaseListenersInit === '1') {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) {
          cancelAnimationFrame(rafId);
          wrap._akayShowcaseRafId = null;
        } else if (!wrap._akayShowcaseRafId) {
          lastFrame = performance.now();
          rafId = requestAnimationFrame(tick);
          wrap._akayShowcaseRafId = rafId;
        }
      });
    }, { threshold: 0 });
    io.observe(wrap);
    wrap._akayShowcaseIO = io;
    return;
  }
  wrap.dataset.akayShowcaseListenersInit = '1';

  // ---- Pause on hover (desktop) ----
  wrap.addEventListener('mouseenter', () => {
    isHovering = true;
    lastInteract = performance.now();
  });
  wrap.addEventListener('mouseleave', () => {
    isHovering = false;
    lastInteract = performance.now();
  });

  // ---- Pause on touch (mobile) — ALL PASSIVE, no preventDefault ----
  // These do NOT block vertical scrolling. The CSS touch-action: pan-x pan-y
  // tells the browser to handle both directions natively.
  wrap.addEventListener('touchstart', () => {
    isTouching = true;
    lastInteract = performance.now();
  }, { passive: true });
  wrap.addEventListener('touchend', () => {
    isTouching = false;
    lastInteract = performance.now();
  }, { passive: true });
  wrap.addEventListener('touchmove', () => {
    lastInteract = performance.now();
  }, { passive: true });

  // ---- Detect USER scroll (not our auto-play scroll) ----
  wrap.addEventListener('scroll', () => {
    if (isAutoScrolling) return;
    lastInteract = performance.now();
  }, { passive: true });

  // ---- Wheel: shift+wheel = horizontal, otherwise page scrolls ----
  wrap.addEventListener('wheel', e => {
    if (e.shiftKey) {
      e.preventDefault();
      wrap.scrollLeft += e.deltaY;
    }
    // Otherwise let the page scroll vertically — do nothing
  }, { passive: false });

  // ---- Pause when offscreen (perf) ----
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) {
        cancelAnimationFrame(rafId);
        wrap._akayShowcaseRafId = null;
      } else if (!wrap._akayShowcaseRafId) {
        lastFrame = performance.now();
        rafId = requestAnimationFrame(tick);
        wrap._akayShowcaseRafId = rafId;
      }
    });
  }, { threshold: 0 });
  io.observe(wrap);
  wrap._akayShowcaseIO = io;
}

// Auto-init on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShowcase);
} else {
  initShowcase();
}
