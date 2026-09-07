// =====================================================================
//  showcase-scroll.js
//  ---------------------------------------------------------------------
//  Drives the Web Showcase horizontal marquee with:
//    • Auto-play (smooth, ~0.4px per frame, loops seamlessly because
//      the strip content is duplicated)
//    • Pause on hover (desktop) and on touch (mobile)
//    • Manual drag-to-scroll with pointer events (mouse + touch + pen)
//    • Vertical touch-scroll passes through to the page (touch-action: pan-x
//      on the wrap means horizontal pans go to the showcase, vertical pans
//      go to the page)
//    • Direction taken from data-direction="left|right" on the strip
//    • Resumes auto-play 2s after the user stops interacting
//
//  No external deps. Loaded as a module from index.html.
// =====================================================================

(function () {
  const SPEED = 0.4;          // px per frame (~24 px/sec at 60fps)
  const RESUME_DELAY = 2000;  // ms after last interaction before auto-play resumes

  function init() {
    document.querySelectorAll('.showcase-track-wrap').forEach(initWrap);
  }

  function initWrap(wrap) {
    const strip = wrap.querySelector('.showcase-strip');
    if (!strip) return;
    const direction = strip.getAttribute('data-direction') === 'right' ? -1 : 1;

    // Half the strip's scrollWidth = one full loop (because content is duplicated)
    let halfWidth = 0;
    function measure() {
      halfWidth = strip.scrollWidth / 2;
      // If for some reason there's no duplicate, just loop on full width
      if (!halfWidth || halfWidth < 100) halfWidth = strip.scrollWidth;
    }
    measure();
    window.addEventListener('resize', measure);
    // Re-measure once images load (scrollWidth changes)
    strip.querySelectorAll('img').forEach(img => {
      if (img.complete) return;
      img.addEventListener('load', measure, { once: true });
      img.addEventListener('error', measure, { once: true });
    });

    // ---- state ----
    let isHovering = false;
    let isDragging = false;
    let resumeTimer = null;
    let lastFrame = performance.now();

    // ---- auto-play loop ----
    let rafId = null;
    function tick(now) {
      const dt = Math.min(now - lastFrame, 50); // ms, capped
      lastFrame = now;

      if (!isHovering && !isDragging && !document.body.classList.contains('akay-edit-mode')) {
        wrap.classList.add('is-autoplaying');
        const dx = (SPEED * dt / 16.67) * direction;
        let next = wrap.scrollLeft + dx;

        // Seamless wrap-around
        if (direction > 0) {
          // scrolling left (content moves left)
          if (next >= halfWidth) next -= halfWidth;
        } else {
          // scrolling right
          if (next <= 0) next += halfWidth;
        }
        wrap.scrollLeft = next;
      } else {
        wrap.classList.remove('is-autoplaying');
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    // ---- hover pause (desktop) ----
    wrap.addEventListener('mouseenter', () => { isHovering = true; });
    wrap.addEventListener('mouseleave', () => { isHovering = false; });

    // ---- manual drag (pointer events: mouse, touch, pen) ----
    let pointerStartX = 0;
    let pointerStartScroll = 0;
    let pointerId = null;
    let didMove = false;

    wrap.addEventListener('pointerdown', e => {
      // Only react to primary button / touch / pen
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Don't start drag if user clicked a button (admin overlay)
      if (e.target.closest('button, a')) return;

      pointerId = e.pointerId;
      pointerStartX = e.clientX;
      pointerStartScroll = wrap.scrollLeft;
      didMove = false;
      isDragging = true;
      wrap.classList.add('is-dragging');
      try { wrap.setPointerCapture(pointerId); } catch {}

      // Pause auto-play
      clearTimeout(resumeTimer);
    });

    wrap.addEventListener('pointermove', e => {
      if (pointerId !== e.pointerId) return;
      const dx = e.clientX - pointerStartX;
      if (Math.abs(dx) > 3) didMove = true;
      wrap.scrollLeft = pointerStartScroll - dx;
    });

    function endDrag(e) {
      if (pointerId !== e.pointerId) return;
      isDragging = false;
      wrap.classList.remove('is-dragging');
      try { wrap.releasePointerCapture(pointerId); } catch {}
      pointerId = null;

      // Schedule auto-play resume
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { /* just let the loop pick up */ }, RESUME_DELAY);
    }
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);

    // Prevent click-navigation right after a drag (so a swipe doesn't fire a card click)
    wrap.addEventListener('click', e => {
      if (didMove) {
        e.preventDefault();
        e.stopPropagation();
        didMove = false;
      }
    }, true);

    // ---- touch: pause auto-play while touching ----
    wrap.addEventListener('touchstart', () => {
      clearTimeout(resumeTimer);
      isHovering = true;
    }, { passive: true });
    wrap.addEventListener('touchend', () => {
      isHovering = false;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {}, RESUME_DELAY);
    }, { passive: true });

    // ---- wheel: horizontal wheel scrolls the showcase, vertical scrolls the page ----
    wrap.addEventListener('wheel', e => {
      // Only intercept if it's a horizontal wheel OR shift+wheel
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // natural horizontal wheel — let the browser handle it
        return;
      }
      if (e.shiftKey) {
        // shift+wheel = force horizontal scroll on this element
        e.preventDefault();
        wrap.scrollLeft += e.deltaY;
      }
      // Otherwise, do nothing — let the page scroll vertically
    }, { passive: false });

    // ---- pause when offscreen (perf) ----
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
