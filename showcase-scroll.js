// =====================================================================
//  showcase-scroll.js  v2
//  ---------------------------------------------------------------------
//  SIMPLIFIED: native horizontal scroll + rAF auto-play.
//  No JS pointer/drag handlers — they were interfering with native
//  touch scrolling on mobile. Users can now:
//    • Touch-drag / mouse-drag / wheel horizontally — works natively
//    • Vertical touch scroll passes through to the page (touch-action: pan-x)
//    • Auto-play runs via requestAnimationFrame, pauses on hover/touch
//  =====================================================================

(function () {
  const SPEED = 0.4;          // px per ms
  const RESUME_DELAY = 2500;  // ms after last interaction before auto-play resumes

  function init() {
    document.querySelectorAll('.showcase-track-wrap').forEach(initWrap);
  }

  function initWrap(wrap) {
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
        wrap.scrollLeft = next;
      } else {
        wrap.classList.remove('is-autoplaying');
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    // Pause on hover (desktop)
    wrap.addEventListener('mouseenter', () => { isHovering = true; lastInteract = performance.now(); });
    wrap.addEventListener('mouseleave', () => { isHovering = false; lastInteract = performance.now(); });

    // Pause on touch (mobile) — uses native scroll for actual dragging
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

    // Detect native scroll (mouse wheel / trackpad) and pause briefly
    let scrollDebounce = null;
    wrap.addEventListener('scroll', () => {
      lastInteract = performance.now();
      clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(() => { lastInteract = performance.now(); }, 100);
    }, { passive: true });

    // Pause when offscreen (perf)
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) {
          cancelAnimationFrame(rafId);
          rafId = null;
        } else if (!rafId) {
          lastFrame = performance.now();
          rafId = requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0 });
    io.observe(wrap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
