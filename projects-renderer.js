// =====================================================================
//  projects-renderer.js  v27
//  ---------------------------------------------------------------------
//  Subscribes to Firestore 'content/projects' doc and renders projects
//  into the correct section based on the 'section' field:
//    - web-showcase     → Recent Web Work marquee (image cards)
//    - web-portfolio    → Websites I've Built (browser-style cards w/ live URL)
//    - design-services  → Design Services grid
//    - print-services   → Print Services grid
//
//  FIX v27: Added onerror handler on images so broken URLs show a
//  "broken image" icon instead of black blank.
// =====================================================================

import { db, doc, onSnapshot } from "./firebase-config.js";

console.log('[projects] module loaded');

function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeAttr(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Broken image placeholder — shows when image URL fails to load
const BROKEN_IMG_SVG = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 250'>
    <rect width='400' height='250' fill='#1a1a1a'/>
    <text x='200' y='120' font-family='Montserrat,Arial,sans-serif' font-size='14' fill='#5a5a5a' text-anchor='middle'>Image failed to load</text>
    <text x='200' y='145' font-family='monospace' font-size='10' fill='#3a3a3a' text-anchor='middle'>Check the image URL</text>
  </svg>
`)}`;

function renderCard(item) {
  const url = escapeAttr(item.imageUrl || '');
  const title = escapeHtml(item.title || 'Untitled');
  const category = escapeHtml(item.category || '');
  const desc = escapeHtml(item.description || '');
  const liveUrl = escapeAttr(item.liveUrl || '');

  const openLink = liveUrl ? `<a href="${liveUrl}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;">` : '';
  const closeLink = liveUrl ? `</a>` : '';

  return `
    <div class="showcase-card reveal">
      ${openLink}
      <div class="showcase-card-img">
        ${url ? `<img src="${url}" alt="${escapeAttr(title)}" loading="lazy" onerror="this.onerror=null;this.src='${BROKEN_IMG_SVG}';console.warn('[projects] image failed:', this.src);" />` : ''}
      </div>
      <div class="showcase-card-meta">
        ${category ? `<span class="showcase-card-tag">${category}</span>` : ''}
        <h4 class="showcase-card-title">${title}</h4>
        ${desc ? `<p class="showcase-card-cat">${desc}</p>` : ''}
      </div>
      ${closeLink}
    </div>
  `;
}

// Render a web-portfolio card (browser-style with live URL)
function renderWebPortfolioCard(item) {
  const url = escapeAttr(item.imageUrl || '');
  const title = escapeHtml(item.title || 'Untitled');
  const category = escapeHtml(item.category || '');
  const desc = escapeHtml(item.description || '');
  const liveUrl = escapeAttr(item.liveUrl || '');

  // Extract domain from liveUrl for the browser URL bar
  let domain = '';
  try { if (liveUrl) domain = new URL(liveUrl).hostname; } catch {}

  return `
    <div class="wp-card reveal" data-url="${liveUrl}" data-name="${escapeAttr(title)}" data-desc="${escapeAttr(desc)}">
      <div class="wp-browser"><div class="wp-dots"><span></span><span></span><span></span></div><div class="wp-url">${escapeHtml(domain)}</div></div>
      <div class="wp-preview" style="background:linear-gradient(135deg,#0a0a0a,#1a0505);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;position:relative;overflow:hidden;">
        ${url ? `<img src="${url}" alt="${escapeAttr(title)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.style.display='none';" />` : ''}
        <div style="position:relative;z-index:1;text-align:center;padding:20px;">
          <span style="color:rgba(255,255,255,0.8);font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">${title}</span>
          ${category ? `<br><span style="color:rgba(255,255,255,0.4);font-size:11px;">${category}</span>` : ''}
        </div>
        <div class="zoom-hint" aria-label="Click to zoom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></div>
      </div>
      <div class="wp-body">
        <span class="wp-tag">${category || 'Web'}</span>
        <h4 class="wp-name">${title}</h4>
        <p class="wp-desc">${desc}</p>
        <span class="wp-btn">Watch it scroll →</span>
      </div>
    </div>
  `;
}

// Render a card for design/print services grid
function renderServiceCard(item) {
  const url = escapeAttr(item.imageUrl || '');
  const title = escapeHtml(item.title || 'Untitled');
  const category = escapeHtml(item.category || '');
  const desc = escapeHtml(item.description || '');
  const liveUrl = escapeAttr(item.liveUrl || '');

  const openLink = liveUrl ? `<a href="${liveUrl}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;">` : '';
  const closeLink = liveUrl ? `</a>` : '';

  return `
    <div class="service-card reveal" style="cursor:pointer;">
      ${openLink}
      <div class="service-card-img clickable-img" data-img="${url}" style="background:linear-gradient(135deg,#0a0a0a,#1a0505);">
        ${url ? `<img src="${url}" alt="${escapeAttr(title)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.style.display='none';" />` : ''}
      </div>
      <div style="padding:12px 14px;">
        ${category ? `<div style="font:600 10px/1 'Montserrat',sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#ff1a1a;margin-bottom:6px;">${category}</div>` : ''}
        <h4 style="font:700 14px/1.3 'Montserrat',sans-serif;color:#fff;margin:0 0 4px;">${title}</h4>
        ${desc ? `<p style="font:400 11px/1.4 'Poppins',sans-serif;color:#8a8a8a;margin:0;">${desc}</p>` : ''}
      </div>
      ${closeLink}
    </div>
  `;
}

function renderProjects(items) {
  console.log('[projects] renderProjects called with', items.length, 'items');

  const webShowcase = items.filter(p => !p.section || p.section === 'web-showcase');
  const webPortfolio = items.filter(p => p.section === 'web-portfolio');
  const designServices = items.filter(p => p.section === 'design-services');
  const printServices = items.filter(p => p.section === 'print-services');

  console.log('[projects] web-showcase:', webShowcase.length, 'web-portfolio:', webPortfolio.length, 'design:', designServices.length, 'print:', printServices.length);

  renderWebShowcase(webShowcase);
  renderWebPortfolio(webPortfolio);
  renderServiceSection('design-services', designServices);
  renderServiceSection('print-services', printServices);
}

function renderWebShowcase(items) {
  const section = document.getElementById('web-showcase');
  if (!section) return;

  section.style.display = '';

  if (!items.length) {
    const wraps = section.querySelectorAll('.showcase-track-wrap');
    if (wraps[0]) {
      const strip1 = wraps[0].querySelector('.showcase-strip');
      if (strip1) strip1.innerHTML = `
        <div class="showcase-card reveal" style="opacity:0.5;">
          <div class="showcase-card-img" style="display:flex;align-items:center;justify-content:center;">
            <span style="color:#5a5a5a;font:600 12px/1.4 'Montserrat',sans-serif;text-align:center;padding:20px;">No projects yet.<br>Add some from the admin dashboard.</span>
          </div>
        </div>
      `;
    }
    if (wraps[1]) {
      const strip2 = wraps[1].querySelector('.showcase-strip');
      if (strip2) strip2.innerHTML = '';
    }
    return;
  }

  items.sort((a, b) => (a.order || 0) - (b.order || 0));
  const mid = Math.ceil(items.length / 2);
  const row1 = items.slice(0, mid);
  const row2 = items.slice(mid);

  const row1Html = row1.map(renderCard).join('');
  const row2Html = row2.map(renderCard).join('');

  const wraps = section.querySelectorAll('.showcase-track-wrap');
  if (wraps[0]) {
    const strip1 = wraps[0].querySelector('.showcase-strip');
    if (strip1) strip1.innerHTML = row1Html + row1Html;
  }
  if (wraps[1]) {
    const strip2 = wraps[1].querySelector('.showcase-strip');
    if (strip2) strip2.innerHTML = row2Html + row2Html;
  }

  // These cards are injected after the page's one-time scroll-reveal
  // observer already ran, so it never sees them and they'd stay at
  // opacity:0 forever. Mark them visible immediately instead.
  section.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));

  if (window.initShowcase) {
    setTimeout(() => window.initShowcase(), 100);
  }
}

function renderWebPortfolio(items) {
  const section = document.getElementById('web-portfolio');
  if (!section) return;

  const grid = section.querySelector('.web-grid');
  if (!grid) {
    console.warn('[projects] no .web-grid found in #web-portfolio');
    return;
  }

  // Remove previously-injected dynamic cards
  const oldDynamic = grid.querySelectorAll('[data-dynamic-project]');
  oldDynamic.forEach(el => el.remove());

  if (!items.length) return;

  console.log(`[projects] injecting ${items.length} projects into #web-portfolio`);

  items.sort((a, b) => (a.order || 0) - (b.order || 0));

  items.forEach(item => {
    const temp = document.createElement('div');
    temp.innerHTML = renderWebPortfolioCard(item).trim();
    const card = temp.firstChild;
    if (card) {
      card.setAttribute('data-dynamic-project', item.id);
      grid.appendChild(card);
    }
  });

  grid.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}

function renderServiceSection(sectionId, items) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const grid = section.querySelector('.services-grid, .service-grid, .grid');
  if (!grid) return;

  const oldDynamic = grid.querySelectorAll('[data-dynamic-project]');
  oldDynamic.forEach(el => el.remove());

  if (!items.length) return;

  console.log(`[projects] injecting ${items.length} projects into #${sectionId}`);

  items.sort((a, b) => (a.order || 0) - (b.order || 0));

  items.forEach(item => {
    const temp = document.createElement('div');
    temp.innerHTML = renderServiceCard(item).trim();
    const card = temp.firstChild;
    if (card) {
      card.setAttribute('data-dynamic-project', item.id);
      grid.appendChild(card);
    }
  });

  grid.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}

function renderLoadingState(section) {
  const wraps = section.querySelectorAll('.showcase-track-wrap');
  if (wraps[0]) {
    const strip1 = wraps[0].querySelector('.showcase-strip');
    if (strip1) strip1.innerHTML = `
      <div class="showcase-card reveal" style="opacity:0.5;">
        <div class="showcase-card-img" style="display:flex;align-items:center;justify-content:center;">
          <span style="color:#5a5a5a;font:600 12px/1.4 'Montserrat',sans-serif;text-align:center;padding:20px;">Loading projects…</span>
        </div>
      </div>
    `;
  }
}

function renderTimeoutState(section) {
  const wraps = section.querySelectorAll('.showcase-track-wrap');
  if (wraps[0]) {
    const strip1 = wraps[0].querySelector('.showcase-strip');
    if (strip1) strip1.innerHTML = `
      <div class="showcase-card reveal" style="opacity:0.6;">
        <div class="showcase-card-img" style="display:flex;align-items:center;justify-content:center;">
          <span style="color:#8a8a8a;font:600 12px/1.4 'Montserrat',sans-serif;text-align:center;padding:20px;">Couldn't load projects right now.<br>Check your connection and reload.</span>
        </div>
      </div>
    `;
  }
}

function init() {
  console.log('[projects] init() called');
  const section = document.getElementById('web-showcase');
  if (!section) {
    console.error('[projects] web-showcase section not found');
    return;
  }

  // Show something immediately instead of leaving the marquee blank
  // while the first Firestore poll is in flight.
  renderLoadingState(section);

  let gotData = false;
  const timeoutId = setTimeout(() => {
    if (!gotData) {
      console.warn('[projects] no data received after 8s — showing timeout state');
      renderTimeoutState(section);
    }
  }, 8000);

  try {
    const docRef = doc(db, 'content', 'projects');
    onSnapshot(docRef, snap => {
      gotData = true;
      clearTimeout(timeoutId);
      console.log('[projects] onSnapshot fired, exists:', snap.exists());
      if (!snap.exists()) {
        renderProjects([]);
        return;
      }
      const data = snap.data();
      const items = Array.isArray(data.items) ? data.items : [];
      console.log('[projects] received', items.length, 'projects');
      renderProjects(items);
    }, err => {
      console.error('[projects] onSnapshot error:', err.message);
      clearTimeout(timeoutId);
      renderTimeoutState(section);
    });
    console.log('[projects] onSnapshot subscribed');
  } catch (e) {
    console.error('[projects] init error:', e.message);
    clearTimeout(timeoutId);
    renderTimeoutState(section);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
