// =====================================================================
//  projects-renderer.js
//  ---------------------------------------------------------------------
//  Subscribes to Firestore 'content/projects' doc and renders the Web
//  Showcase section dynamically. Replaces the old hardcoded 12 cards.
//
//  Each project in the items array:
//    { id, title, category, description, imageUrl, liveUrl, order }
//
//  The renderer splits projects into 2 rows (first half / second half),
//  duplicates each row's content for seamless loop, then calls
//  window.initShowcase() to start the auto-play scrolling.
//
//  If no projects exist yet, the section is hidden.
// =====================================================================

import { db, doc, onSnapshot } from "./firebase-config.js";

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

  // If liveUrl exists, wrap the card in an <a> tag
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
  const section = document.getElementById('web-showcase');
  if (!section) return;

  if (!items.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  // Sort by order field
  items.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Split into 2 rows
  const mid = Math.ceil(items.length / 2);
  const row1 = items.slice(0, mid);
  const row2 = items.slice(mid);

  // Build HTML for each row (duplicated for seamless loop)
  const row1Html = row1.map(renderCard).join('');
  const row2Html = row2.map(renderCard).join('');

  // Inject into the strips
  const wraps = section.querySelectorAll('.showcase-track-wrap');
  if (wraps[0]) {
    const strip1 = wraps[0].querySelector('.showcase-strip');
    if (strip1) strip1.innerHTML = row1Html + row1Html; // duplicate for seamless loop
  }
  if (wraps[1]) {
    const strip2 = wraps[1].querySelector('.showcase-strip');
    if (strip2) strip2.innerHTML = row2Html + row2Html;
  }

  // Re-init the showcase scrolling (picks up the new cards)
  if (window.initShowcase) {
    setTimeout(() => window.initShowcase(), 100);
  }
}

function init() {
  const section = document.getElementById('web-showcase');
  if (!section) return;

  onSnapshot(doc(db, 'content', 'projects'), snap => {
    // snap.exists is a FUNCTION (matches Firebase SDK API) — must call it
    if (!snap.exists()) {
      console.log('[projects] doc does not exist — hiding section');
      renderProjects([]);
      return;
    }
    const data = snap.data();
    const items = Array.isArray(data.items) ? data.items : [];
    console.log(`[projects] received ${items.length} projects from Firestore`);
    console.log('[projects] first item sample:', items[0]);
    renderProjects(items);
  }, err => {
    console.error('[projects] sync error:', err.message);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
