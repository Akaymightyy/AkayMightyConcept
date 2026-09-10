// =====================================================================
//  projects-renderer.js  v26
//  ---------------------------------------------------------------------
//  Subscribes to Firestore 'content/projects' doc and renders projects
//  into the correct section based on the 'section' field:
//    - web-showcase     → Recent Web Work marquee
//    - design-services  → Design Services grid
//    - print-services   → Print Services grid
//
//  For the web showcase, projects are split into 2 rows (forward/reverse)
//  and duplicated for seamless loop.
//
//  For design-services and print-services, projects are appended to the
//  existing grid (after the fixed slots). If no projects exist for a
//  section, that section is left as-is.
// =====================================================================

import { db, doc, onSnapshot } from "./firebase-config.js";

console.log('[projects] module loaded');

function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeAttr(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

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
        ${url ? `<img src="${url}" alt="${escapeAttr(title)}" loading="lazy" />` : ''}
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

// Render a card for design/print services grid (smaller, different layout)
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
        ${url ? `<img src="${url}" alt="${escapeAttr(title)}" style="width:100%;height:100%;object-fit:cover;" />` : ''}
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

  // Split by section
  const webShowcase = items.filter(p => !p.section || p.section === 'web-showcase');
  const designServices = items.filter(p => p.section === 'design-services');
  const printServices = items.filter(p => p.section === 'print-services');

  console.log('[projects] web-showcase:', webShowcase.length, 'design:', designServices.length, 'print:', printServices.length);

  renderWebShowcase(webShowcase);
  renderServiceSection('design-services', designServices);
  renderServiceSection('print-services', printServices);
}

function renderWebShowcase(items) {
  const section = document.getElementById('web-showcase');
  if (!section) {
    console.warn('[projects] web-showcase section not found');
    return;
  }

  // ALWAYS show the section
  section.style.display = '';

  if (!items.length) {
    console.log('[projects] no web-showcase items — showing placeholder');
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

  console.log('[projects] rendering', items.length, 'web-showcase projects');

  // Sort by order
  items.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Split into 2 rows
  const mid = Math.ceil(items.length / 2);
  const row1 = items.slice(0, mid);
  const row2 = items.slice(mid);

  const row1Html = row1.map(renderCard).join('');
  const row2Html = row2.map(renderCard).join('');

  const wraps = section.querySelectorAll('.showcase-track-wrap');
  if (wraps[0]) {
    const strip1 = wraps[0].querySelector('.showcase-strip');
    if (strip1) {
      strip1.innerHTML = row1Html + row1Html;
      console.log('[projects] injected row1:', strip1.children.length, 'cards');
    }
  }
  if (wraps[1]) {
    const strip2 = wraps[1].querySelector('.showcase-strip');
    if (strip2) strip2.innerHTML = row2Html + row2Html;
  }

  if (window.initShowcase) {
    setTimeout(() => window.initShowcase(), 100);
  }
}

function renderServiceSection(sectionId, items) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  // Find the existing grid container in this section
  // Design services and print services have a grid of service-card elements
  const grid = section.querySelector('.services-grid, .service-grid, .grid');
  if (!grid) {
    console.warn(`[projects] no grid found in #${sectionId}`);
    return;
  }

  // Remove any previously-injected dynamic cards (marked with data-dynamic)
  const oldDynamic = grid.querySelectorAll('[data-dynamic-project]');
  oldDynamic.forEach(el => el.remove());

  if (!items.length) return;

  console.log(`[projects] injecting ${items.length} projects into #${sectionId}`);

  // Sort by order
  items.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Append new cards to the grid
  items.forEach(item => {
    const cardHtml = renderServiceCard(item);
    const temp = document.createElement('div');
    temp.innerHTML = cardHtml.trim();
    const card = temp.firstChild;
    if (card) {
      card.setAttribute('data-dynamic-project', item.id);
      grid.appendChild(card);
    }
  });
}

function init() {
  console.log('[projects] init() called');
  const section = document.getElementById('web-showcase');
  if (!section) {
    console.error('[projects] web-showcase section not found');
    return;
  }

  try {
    const docRef = doc(db, 'content', 'projects');
    console.log('[projects] docRef:', docRef);

    onSnapshot(docRef, snap => {
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
    });

    console.log('[projects] onSnapshot subscribed');
  } catch (e) {
    console.error('[projects] init error:', e.message);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
