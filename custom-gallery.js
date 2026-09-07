// =====================================================================
//  custom-gallery.js
//  ---------------------------------------------------------------------
//  Subscribes to Firestore 'content/custom-images' doc and renders
//  every item as a card in the #custom-gallery section on the site.
//  Runs on every page load — for admin AND public visitors.
//  =====================================================================

import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderGallery(items) {
  const grid = document.getElementById('customGalleryGrid');
  const section = document.getElementById('custom-gallery');
  if (!grid || !section) return;

  if (!items.length) {
    // Hide the whole section when there are no custom images
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  grid.innerHTML = items.map(item => `
    <figure class="cg-card reveal" data-id="${item.id}">
      <div class="cg-card__img">
        <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.caption || 'work sample')}" loading="lazy" />
      </div>
      ${item.caption ? `<figcaption class="cg-card__caption">${escapeHtml(item.caption)}</figcaption>` : ''}
    </figure>
  `).join('');

  // Trigger reveal animation if IntersectionObserver is set up
  if (window.IntersectionObserver) {
    grid.querySelectorAll('.reveal:not(.is-visible)').forEach(el => {
      // Use the site's existing reveal logic if present
      if (typeof window.observeReveal === 'function') {
        window.observeReveal(el);
      } else {
        el.classList.add('is-visible');
      }
    });
  }
}

function init() {
  const section = document.getElementById('custom-gallery');
  if (!section) return;

  onSnapshot(doc(db, 'content', 'custom-images'), snap => {
    if (!snap.exists()) {
      renderGallery([]);
      return;
    }
    const data = snap.data();
    const items = Array.isArray(data.items) ? data.items : [];
    // Sort by addedAt ascending (oldest first — feels natural for a portfolio)
    items.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    renderGallery(items);
  }, err => {
    console.error('[custom-gallery] sync error:', err.message);
    // Hide section on error
    if (section) section.style.display = 'none';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
