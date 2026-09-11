// =====================================================================
//  layout.js  —  shared header/footer injector for Akay Mighty Concept
//  ---------------------------------------------------------------------
//  Every public page calls:
//      <script type="module">
//        import { initLayout } from './layout.js';
//        initLayout('home');   // pass the active page id from site-config.js
//      </script>
//
//  This module:
//    • Injects the sticky navbar (with logo + nav + CTA + mobile menu)
//    • Injects the footer (brand + columns + socials + copyright)
//    • Injects the floating WhatsApp button
//    • Injects the back-to-top button + scroll progress bar
//    • Injects the triple-click inline fallback script (so the logo
//      navigates to /admin.html on 3 clicks even if admin.js fails)
//    • Loads the shared script tags (firebase-config, admin,
//      projects-renderer, showcase-scroll) into <head> / end of <body>
//    • Wires up navbar scroll state, mobile nav toggle, scroll-progress,
//      back-to-top, and the active-page highlight
//
//  Pages still need to include their own <link rel="stylesheet" href="./site.css">
//  and the Google Fonts <link> in <head> — layout.js handles the rest.
// =====================================================================

import { SITE_CONFIG } from './site-config.js';

// ---------------------------------------------------------------------
// SVG icon factory — keeps the template literals below readable
// ---------------------------------------------------------------------
const ICONS = {
  whatsapp:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 2a2 2 0 110 4 2 2 0 010-4z"/></svg>',
  arrowUp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>',
  arrowRight:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>',
  chevronDown:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>'
};

// ---------------------------------------------------------------------
// HEADER
// ---------------------------------------------------------------------
function buildHeaderHTML(activePage) {
  const nav = SITE_CONFIG.nav;
  const navItems = nav
    .filter((l) => !l.cta)
    .map((l) => {
      const cls = l.id === activePage ? 'active' : '';
      return `<li><a href="${l.url}" class="${cls}" data-page="${l.id}">${l.label}</a></li>`;
    })
    .join('\n        ');

  const cta = nav.find((l) => l.cta);
  const ctaHTML = cta
    ? `<a href="${cta.url}" class="btn btn-primary nav-cta">${ICONS.whatsapp.replace(
        'viewBox="0 0 24 24" fill="currentColor"',
        'viewBox="0 0 24 24" fill="currentColor" width="14" height="14"'
      )}<span>${cta.label}</span></a>`
    : '';

  // Mobile menu includes the CTA as a full-width button at the bottom
  const mobileNavItems = nav
    .map((l) => {
      if (l.cta) {
        return `<a href="${l.url}" class="btn btn-primary" style="margin-top:14px;justify-content:center;">${l.label}</a>`;
      }
      const cls = l.id === activePage ? 'active' : '';
      return `<a href="${l.url}" class="${cls}" data-page="${l.id}" style="color:${cls ? 'var(--red)' : 'var(--text-muted)'};">${l.label}</a>`;
    })
    .join('\n      ');

  return `
  <nav id="navbar">
    <div class="nav-inner">
      <a href="/home.html" class="nav-logo" id="navLogo" aria-label="Akay Mighty Concept home">
        <img src="${SITE_CONFIG.logo}" alt="Akay Mighty Concept Logo" class="nav-logo-img" data-img-slot="img:logo">
        <div class="nav-logo-text">${SITE_CONFIG.brandShort} <span>${SITE_CONFIG.brandAccent}</span><br>${SITE_CONFIG.brandSuffix}</div>
      </a>
      <ul class="nav-links" id="navLinks">
        <div class="nav-pill" id="navPill"></div>
        ${navItems}
      </ul>
      ${ctaHTML}
      <button class="hamburger" id="hamburger" aria-label="Open menu"><span></span><span></span><span></span></button>
    </div>
  </nav>
  <div class="mobile-nav" id="mobileNav">
    ${mobileNavItems}
  </div>`;
}

// ---------------------------------------------------------------------
// FOOTER
// ---------------------------------------------------------------------
function buildFooterHTML() {
  const year = new Date().getFullYear();

  const studioLinks = SITE_CONFIG.footerStudioLinks
    .map((l) => `<li><a href="${l.url}">${l.label}</a></li>`)
    .join('');
  const connectLinks = SITE_CONFIG.footerConnectLinks
    .map((l) => `<li><a href="${l.url}">${l.label}</a></li>`)
    .join('');
  const socialLinks = SITE_CONFIG.social
    .map((s) => {
      const icon = ICONS[s.icon] || '';
      return `<a href="${s.url}" target="_blank" rel="noopener" class="social-link" aria-label="${s.label}">${icon.replace(
        '<svg ',
        '<svg width="18" height="18" '
      )}</a>`;
    })
    .join('');

  const footerSocialLinks = SITE_CONFIG.social
    .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>`)
    .join('');

  return `
  <footer>
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <a href="/home.html" class="nav-logo" aria-label="Akay Mighty Concept home">
            <img src="${SITE_CONFIG.logo}" alt="Akay Mighty Concept Logo" class="nav-logo-img" data-img-slot="img:logo">
            <div class="nav-logo-text">${SITE_CONFIG.brandShort} <span>${SITE_CONFIG.brandAccent}</span><br>${SITE_CONFIG.brandSuffix}</div>
          </a>
          <p class="footer-brand-text">${SITE_CONFIG.tagline}</p>
          <div class="footer-socials">${socialLinks}</div>
        </div>
        <div class="footer-col">
          <h4>Studio</h4>
          <ul>${studioLinks}</ul>
        </div>
        <div class="footer-col">
          <h4>Explore</h4>
          <ul>${connectLinks}</ul>
        </div>
        <div class="footer-col">
          <h4>Social</h4>
          <ul>${footerSocialLinks}</ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div>© <span id="footerYear">${year}</span> ${SITE_CONFIG.brand}. All rights reserved.</div>
        <div>Designed &amp; built with <span style="color:var(--red);">♥</span> by ${SITE_CONFIG.author}</div>
      </div>
    </div>
  </footer>`;
}

// ---------------------------------------------------------------------
// FLOATING WHATSAPP + BACK TO TOP + SCROLL PROGRESS
// ---------------------------------------------------------------------
function buildFloatingChromeHTML() {
  return `
  <button id="backToTop" aria-label="Back to top">
    ${ICONS.arrowUp}
    <svg class="progress-ring" viewBox="0 0 54 54"><circle cx="27" cy="27" r="24.5"></circle></svg>
  </button>
  <div id="scroll-progress"></div>
  <a href="https://wa.me/${SITE_CONFIG.whatsapp}?text=Hi%2C%20I%20want%20to%20place%20an%20order" target="_blank" class="float-wa" aria-label="Chat on WhatsApp">
    ${ICONS.whatsapp}
  </a>`;
}

// ---------------------------------------------------------------------
// TRIPLE-CLICK INLINE FALLBACK
//   Independent of admin.js — registers a triple-click handler on the
//   nav logo that navigates to /admin.html. admin.js's own handler is
//   still the source of truth (it also handles Shift+click for inline
//   login), but this guarantees the shortcut always works even if the
//   admin module fails to load.
// ---------------------------------------------------------------------
function injectTripleClickFallback() {
  // Use document-level capture listener — works regardless of when the
  // header is injected, what ID the logo has, or whether admin.js loaded.
  // CRITICAL: We preventDefault on EVERY click on the logo so the link
  // doesn't navigate away before we can count 3 clicks. After 800ms with
  // no triple-click, we manually navigate to the link's href.
  document.addEventListener('click', function(e) {
    // Check if the click hit the nav logo
    var logo = e.target.closest && (
      e.target.closest('#navLogo') ||
      e.target.closest('.nav-logo') ||
      e.target.closest('[data-img-slot="img:logo"]')
    );
    if (!logo) return;

    // ALWAYS prevent default — we'll handle navigation ourselves
    e.preventDefault();
    e.stopPropagation();

    if (!window._akayTc) window._akayTc = { count: 0, timer: null, target: null, navTimer: null };
    var tc = window._akayTc;

    if (tc.target === logo) {
      tc.count++;
    } else {
      tc.count = 1;
      tc.target = logo;
    }
    clearTimeout(tc.timer);
    clearTimeout(tc.navTimer);

    if (tc.count >= 3) {
      // Triple-click — go to admin
      tc.count = 0;
      tc.target = null;
      if (!document.body.classList.contains('akay-edit-mode')) {
        window.location.href = './admin.html';
      }
    } else {
      // Not a triple-click yet — wait 800ms, then navigate to the link's href
      // (so single/double clicks still work as normal navigation)
      tc.timer = setTimeout(function() { tc.count = 0; tc.target = null; }, 800);
      var href = logo.getAttribute('href') || '/home.html';
      tc.navTimer = setTimeout(function() {
        window.location.href = href;
      }, 250);
    }
  }, true); // capture phase
}

// ---------------------------------------------------------------------
// SHARED SCRIPT TAGS
//   Loads the admin / projects / showcase modules every page needs.
// ---------------------------------------------------------------------
function injectScripts(opts) {
  const head = document.head;

  // firebase-config.js + cloudinary-config.js + admin.js + projects-renderer.js
  // + showcase-scroll.js all use ES modules — load them as <script type="module">
  // at the end of <body> so they run after the DOM is parsed.
  const scripts = [
    './firebase-config.js',
    './cloudinary-config.js',
    './admin.js',
    './projects-renderer.js',
    './showcase-scroll.js'
  ];

  // Allow caller to opt out of certain modules (e.g. project-detail.html
  // doesn't need projects-renderer.js because it renders one project).
  const skip = (opts && opts.skip) || [];
  const filtered = scripts.filter((src) => !skip.includes(src));

  filtered.forEach((src) => {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = src;
    s.defer = true;
    document.body.appendChild(s);
  });
}

// ---------------------------------------------------------------------
// SHARED RUNTIME — navbar scroll state, mobile nav, scroll progress,
// back-to-top, active-page pill, reveal animations
// ---------------------------------------------------------------------
function injectRuntime() {
  const code = `
  (function() {
    // ---------- Navbar scroll state ----------
    var nav = document.getElementById('navbar');
    function onScroll() {
      if (!nav) return;
      if (window.scrollY > 60) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');

      // Scroll progress bar
      var bar = document.getElementById('scroll-progress');
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docHeight > 0 ? (scrollTop / docHeight) : 0;
      if (bar) bar.style.width = (pct * 100) + '%';

      // Back-to-top visibility + ring
      var btt = document.getElementById('backToTop');
      if (btt) {
        var ring = btt.querySelector('.progress-ring circle');
        var circ = 154;
        if (ring) ring.style.strokeDashoffset = String(circ * (1 - pct));
        if (scrollTop > 600) btt.classList.add('visible');
        else btt.classList.remove('visible');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ---------- Back to top click ----------
    var btt = document.getElementById('backToTop');
    if (btt) btt.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ---------- Mobile nav toggle ----------
    var ham = document.getElementById('hamburger');
    var mn = document.getElementById('mobileNav');
    if (ham && mn) {
      ham.addEventListener('click', function() {
        ham.classList.toggle('active');
        mn.classList.toggle('open');
      });
      mn.querySelectorAll('a').forEach(function(a) {
        a.addEventListener('click', function() {
          ham.classList.remove('active');
          mn.classList.remove('open');
        });
      });
    }

    // ---------- Custom cursor (desktop only) ----------
    (function() {
      if (window.matchMedia('(max-width: 900px)').matches) return;
      var dot = document.getElementById('cursor-dot');
      var ring = document.getElementById('cursor-ring');
      if (!dot || !ring) return;
      var mx = 0, my = 0, rx = 0, ry = 0;
      document.addEventListener('mousemove', function(e) {
        mx = e.clientX; my = e.clientY;
        dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
      });
      function tick() {
        rx += (mx - rx) * 0.18;
        ry += (my - ry) * 0.18;
        ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
        requestAnimationFrame(tick);
      }
      tick();
      var hoverables = 'a, button, .service-card, .wp-card, .project-card, .portfolio-item, .skill-tag, .stack-item, input, select, textarea, .ts-btn, .ts-dot, .filter-btn, .showcase-card, .blog-card, .sap-option, .sap-send-btn';
      document.addEventListener('mouseover', function(e) {
        if (e.target.closest && e.target.closest(hoverables)) { dot.classList.add('hovering'); ring.classList.add('hovering'); }
      });
      document.addEventListener('mouseout', function(e) {
        if (e.target.closest && e.target.closest(hoverables)) { dot.classList.remove('hovering'); ring.classList.remove('hovering'); }
      });
    })();

    // ---------- Nav pill (desktop) ----------
    (function() {
      if (window.matchMedia('(max-width: 900px)').matches) return;
      var links = document.querySelectorAll('.nav-links a');
      var pill = document.getElementById('navPill');
      if (!links.length || !pill) return;
      var active = document.querySelector('.nav-links a.active') || links[0];
      function movePill(el) {
        if (!el) { pill.style.opacity = '0'; return; }
        var r = el.getBoundingClientRect();
        var parentR = el.closest('.nav-links').getBoundingClientRect();
        pill.style.left = (r.left - parentR.left) + 'px';
        pill.style.width = r.width + 'px';
        pill.style.opacity = '1';
      }
      links.forEach(function(l) {
        l.addEventListener('mouseenter', function() { movePill(l); });
      });
      var navLinks = document.getElementById('navLinks');
      if (navLinks) navLinks.addEventListener('mouseleave', function() { movePill(active); });
      setTimeout(function() { movePill(active); }, 200);
    })();

    // ---------- Reveal animations ----------
    (function() {
      var reveals = document.querySelectorAll('.reveal');
      if (!reveals.length || !('IntersectionObserver' in window)) {
        reveals.forEach(function(r) { r.classList.add('visible'); });
        return;
      }
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(e) {
          if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
      reveals.forEach(function(r) { io.observe(r); });
    })();

    // ---------- Stats counter ----------
    (function() {
      var stats = document.querySelectorAll('.stat-num[data-target]');
      if (!stats.length || !('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          var target = parseInt(el.dataset.target, 10);
          var duration = 1800;
          var start = performance.now();
          function tick(now) {
            var t = Math.min(1, (now - start) / duration);
            var eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.floor(eased * target) + (t >= 1 ? '+' : '');
            if (t < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          io.unobserve(el);
        });
      }, { threshold: 0.5 });
      stats.forEach(function(s) { io.observe(s); });
    })();

    // ---------- Testimonials slider (home.html) ----------
    (function() {
      var slider = document.getElementById('tsSlider');
      if (!slider) return;
      var slides = slider.querySelectorAll('.ts-slide');
      var dotsWrap = document.getElementById('tsDots');
      var prev = document.getElementById('tsPrev');
      var next = document.getElementById('tsNext');
      if (!slides.length) return;
      var idx = 0;
      slides[0].classList.add('active');
      if (dotsWrap) {
        slides.forEach(function(_, i) {
          var d = document.createElement('button');
          d.className = 'ts-dot' + (i === 0 ? ' active' : '');
          d.setAttribute('aria-label', 'Show testimonial ' + (i + 1));
          d.addEventListener('click', function() { show(i); });
          dotsWrap.appendChild(d);
        });
      }
      function show(i) {
        idx = (i + slides.length) % slides.length;
        slides.forEach(function(s, j) { s.classList.toggle('active', j === idx); });
        if (dotsWrap) dotsWrap.querySelectorAll('.ts-dot').forEach(function(d, j) { d.classList.toggle('active', j === idx); });
      }
      if (prev) prev.addEventListener('click', function() { show(idx - 1); });
      if (next) next.addEventListener('click', function() { show(idx + 1); });
      setInterval(function() { show(idx + 1); }, 6500);
    })();

    // ---------- Custom cursor elements (inject if not present) ----------
    if (!document.getElementById('cursor-dot')) {
      var d = document.createElement('div'); d.id = 'cursor-dot'; document.body.appendChild(d);
      var r = document.createElement('div'); r.id = 'cursor-ring'; document.body.appendChild(r);
    }
  })();
  `;
  const s = document.createElement('script');
  s.textContent = code;
  document.body.appendChild(s);
}

// ---------------------------------------------------------------------
// INDIVIDUAL INJECTORS — exported so pages can opt in piece-by-piece
// if they need a custom layout. Most pages should just call initLayout().
// ---------------------------------------------------------------------

// injectHeader(activePage) — creates the sticky nav with logo, nav links,
// "Start a Project" button. Highlights the active page. Mobile: hamburger
// menu that opens a slide-in nav. Returns the inserted element.
export function injectHeader(activePage) {
  // Avoid double-injecting if a page already has a navbar in the HTML
  if (document.getElementById('navbar')) return document.getElementById('navbar');
  const header = document.createElement('div');
  header.id = 'akay-layout-header';
  header.innerHTML = buildHeaderHTML(activePage);
  if (document.body.firstChild) {
    document.body.insertBefore(header, document.body.firstChild);
  } else {
    document.body.appendChild(header);
  }
  return header;
}

// injectFooter() — creates the footer with brand info, social links, copyright.
export function injectFooter() {
  if (document.querySelector('#akay-layout-footer footer')) return;
  const footer = document.createElement('div');
  footer.id = 'akay-layout-footer';
  footer.innerHTML = buildFooterHTML();
  document.body.appendChild(footer);
  return footer;
}

// injectScripts(opts) is already defined above and is re-exported at the
// bottom of this module — callers can `import { injectScripts } from './layout.js'`.

// ---------------------------------------------------------------------
// MAIN ENTRY POINT — convenience wrapper that runs all injectors in order
// ---------------------------------------------------------------------
export function initLayout(activePage, opts) {
  opts = opts || {};

  // 1. Insert header at the top of <body>
  injectHeader(activePage);

  // 2. Insert footer at the bottom of <body>
  injectFooter();

  // 3. Insert floating chrome (back-to-top, scroll progress, WhatsApp)
  const chrome = document.createElement('div');
  chrome.id = 'akay-layout-chrome';
  chrome.innerHTML = buildFloatingChromeHTML();
  document.body.appendChild(chrome);

  // 4. Insert the inline triple-click fallback script
  injectTripleClickFallback();

  // 5. Insert shared runtime (navbar scroll, mobile nav, cursor, reveals)
  injectRuntime();

  // 6. Insert shared script tags (firebase, admin, projects, showcase)
  injectScripts(opts);
}

// Exposed for pages that need to render nav manually (rare)
export { buildHeaderHTML, buildFooterHTML, ICONS, injectScripts };

export default {
  initLayout,
  injectHeader,
  injectFooter,
  injectScripts,
  buildHeaderHTML,
  buildFooterHTML,
  ICONS
};
