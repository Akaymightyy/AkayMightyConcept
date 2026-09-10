// =====================================================================
//  projects-renderer.js  v25
//  ---------------------------------------------------------------------
//  FIX: Added aggressive logging at every step to diagnose why
//  onSnapshot callback isn't firing on the live site.
//
//  Also: section is ALWAYS visible (never hidden). If no projects,
//  shows a placeholder card.
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

function renderProjects(items) {
  console.log('[projects] renderProjects called with', items.length, 'items');
  const section = document.getElementById('web-showcase');
  if (!section) {
    console.error('[projects] web-showcase section not found in DOM!');
    return;
  }
  console.log('[projects] section found, making visible');

  // ALWAYS show the section
  section.style.display = '';

  if (!items.length) {
    console.log('[projects] no items — showing placeholder');
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

  console.log('[projects] rendering', items.length, 'projects into cards');

  // Sort by order field
  items.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Split into 2 rows
  const mid = Math.ceil(items.length / 2);
  const row1 = items.slice(0, mid);
  const row2 = items.slice(mid);
  console.log('[projects] row1:', row1.length, 'row2:', row2.length);

  // Build HTML for each row (duplicated for seamless loop)
  const row1Html = row1.map(renderCard).join('');
  const row2Html = row2.map(renderCard).join('');

  // Inject into the strips
  const wraps = section.querySelectorAll('.showcase-track-wrap');
  console.log('[projects] found', wraps.length, 'track wraps');

  if (wraps[0]) {
    const strip1 = wraps[0].querySelector('.showcase-strip');
    if (strip1) {
      strip1.innerHTML = row1Html + row1Html;
      console.log('[projects] injected row1 HTML, length:', strip1.innerHTML.length);
    } else {
      console.error('[projects] strip1 not found inside wrap[0]!');
    }
  } else {
    console.error('[projects] wrap[0] not found!');
  }

  if (wraps[1]) {
    const strip2 = wraps[1].querySelector('.showcase-strip');
    if (strip2) {
      strip2.innerHTML = row2Html + row2Html;
      console.log('[projects] injected row2 HTML, length:', strip2.innerHTML.length);
    }
  }

  // Re-init the showcase scrolling
  if (window.initShowcase) {
    console.log('[projects] calling window.initShowcase()');
    setTimeout(() => window.initShowcase(), 100);
  } else {
    console.warn('[projects] window.initShowcase not available');
  }
}

function init() {
  console.log('[projects] init() called');
  const section = document.getElementById('web-showcase');
  if (!section) {
    console.error('[projects] web-showcase section not found — renderer will not run');
    return;
  }
  console.log('[projects] section found, setting up onSnapshot...');

  try {
    const docRef = doc(db, 'content', 'projects');
    console.log('[projects] docRef created:', docRef);

    const unsub = onSnapshot(docRef, snap => {
      console.log('[projects] onSnapshot callback fired!');
      console.log('[projects] snap type:', typeof snap);
      console.log('[projects] snap.exists():', snap.exists());

      if (!snap.exists()) {
        console.log('[projects] doc does not exist — showing placeholder');
        renderProjects([]);
        return;
      }
      const data = snap.data();
      console.log('[projects] data keys:', Object.keys(data));
      const items = Array.isArray(data.items) ? data.items : [];
      console.log('[projects] received', items.length, 'projects from Firestore');
      if (items[0]) console.log('[projects] first item:', items[0]);
      renderProjects(items);
    }, err => {
      console.error('[projects] onSnapshot ERROR:', err.message);
    });

    console.log('[projects] onSnapshot subscribed, unsub function:', typeof unsub);
  } catch (e) {
    console.error('[projects] init() threw error:', e.message);
    console.error(e.stack);
  }
}

if (document.readyState === 'loading') {
  console.log('[projects] DOM still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', init);
} else {
  console.log('[projects] DOM already loaded, calling init() immediately');
  init();
}
