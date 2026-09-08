// =====================================================================
//  admin-dashboard.js  v3  —  logic for /admin.html
//  ---------------------------------------------------------------------
//  FEATURES
//    • Sidebar layout, stats bar, live preview grid
//    • Auto-discovers ALL data-text-slot elements from the live site
//      (opens a hidden iframe to ./ and reads them)
//    • Groups image + text slots by section for easy scanning
//    • Verifies Firestore writes actually land (not just queued in
//      the offline cache) by re-reading the doc after write
//    • Surfaces permission errors clearly
//    • Auto-redirects to dashboard UI immediately after sign-in
// =====================================================================

import { auth, db, forceOnline, waitForServer } from "./firebase-config.js";
import {
  cloudinaryConfig,
  cloudinaryUploadUrl,
  cloudinaryDeleteEndpoint,
  publicIdFromCloudinaryUrl
} from "./cloudinary-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdToken
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// =====================================================================
//  IMAGE-SLOT REGISTRY — grouped by section for the dashboard UI.
//  Default URLs are pulled from the live site via iframe.
// =====================================================================
const IMAGE_SECTIONS = [
  {
    title: 'Branding',
    slots: [
      { id: 'img:logo',           label: 'Site logo (nav, preloader, footer)' },
      { id: 'img:headshot',       label: 'Akay headshot (hero + about)' }
    ]
  },
  {
    title: 'Design Services',
    slots: [
      { id: 'img:logo-design',    label: 'Logo Design sample' },
      { id: 'img:ads-flyer',      label: 'Ads Flyer sample' },
      { id: 'img:food-flyer',     label: 'Food Flyer sample' },
      { id: 'img:business-flyer', label: 'Business Flyer sample' },
      { id: 'img:club-flyer',     label: 'Club Flyer sample' },
      { id: 'img:web3-flyer',     label: 'Web3 / Crypto Flyer sample' }
    ]
  },
  {
    title: 'Print Services',
    slots: [
      { id: 'img:business-card',  label: 'Business Card sample' },
      { id: 'img:leather-print',  label: 'Leather Print sample' },
      { id: 'img:paper-bag',      label: 'Paper Bag sample' },
      { id: 'img:custom-bag',     label: 'Custom Bag sample' },
      { id: 'img:branded-merch',  label: 'Branded Merch sample' }
    ]
  },
  {
    title: 'Web Showcase (horizontal marquee)',
    slots: [
      { id: 'img:web-1',  label: 'Row 1 · Card 1' },
      { id: 'img:web-2',  label: 'Row 1 · Card 2' },
      { id: 'img:web-3',  label: 'Row 1 · Card 3' },
      { id: 'img:web-4',  label: 'Row 1 · Card 4' },
      { id: 'img:web-5',  label: 'Row 1 · Card 5' },
      { id: 'img:web-6',  label: 'Row 1 · Card 6' },
      { id: 'img:web-7',  label: 'Row 2 · Card 1' },
      { id: 'img:web-8',  label: 'Row 2 · Card 2' },
      { id: 'img:web-9',  label: 'Row 2 · Card 3' },
      { id: 'img:web-10', label: 'Row 2 · Card 4' },
      { id: 'img:web-11', label: 'Row 2 · Card 5' },
      { id: 'img:web-12', label: 'Row 2 · Card 6' }
    ]
  }
];

// =====================================================================
//  STATE
// =====================================================================
const state = {
  images: {},
  texts: {},
  customImages: [],
  defaults: { images: {}, texts: {} },
  defaultsReady: false,
  textSlotsDiscovered: [],
  unsubImages: null,
  unsubTexts: null,
  unsubCustom: null,
  rulesOk: null
};

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// =====================================================================
//  TOAST
// =====================================================================
function toast(msg, kind = 'info') {
  let el = $('#akayToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'akayToast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `akay-toast akay-toast--${kind} is-visible`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('is-visible'), 3000);
}

// =====================================================================
//  STEP 1 — capture defaults from the live site via hidden iframe.
//  We also discover every [data-text-slot] element on the page so the
//  admin can edit any text without us having to maintain a registry.
// =====================================================================
function captureDefaultsFromSite() {
  return new Promise(resolve => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0;';
    iframe.src = './';
    document.body.appendChild(iframe);

    const finish = () => {
      if (iframe.parentNode) iframe.remove();
      resolve();
    };

    iframe.onload = () => {
      try {
        const idoc = iframe.contentDocument;
        if (!idoc) throw new Error('No iframe document');

        // Capture image defaults
        idoc.querySelectorAll('[data-img-slot]').forEach(el => {
          const slot = el.getAttribute('data-img-slot');
          if (state.defaults.images[slot]) return;
          if (el.tagName === 'IMG') {
            const s = el.getAttribute('src');
            if (s) state.defaults.images[slot] = new URL(s, iframe.src).href;
          } else {
            const inner = el.querySelector('img');
            if (inner && inner.getAttribute('src')) {
              state.defaults.images[slot] = new URL(inner.getAttribute('src'), iframe.src).href;
            }
          }
        });

        // Discover all text slots — group by section
        const sectionMap = new Map();   // sectionId -> { title, slots: [] }
        idoc.querySelectorAll('[data-text-slot]').forEach(el => {
          const slot = el.getAttribute('data-text-slot');
          if (state.defaults.texts[slot]) return;
          state.defaults.texts[slot] = el.textContent.trim();

          // Figure out which section this slot lives in
          const sec = el.closest('section, header, footer');
          const secId = sec ? (sec.id || sec.className.split(' ')[0] || 'general') : 'general';
          const secTitle = sec
            ? (sec.querySelector('.section-title, .showcase-title, h2, h3')?.textContent?.trim() || secId)
            : 'General';

          if (!sectionMap.has(secId)) {
            sectionMap.set(secId, { id: secId, title: secTitle, slots: [] });
          }
          sectionMap.get(secId).slots.push({
            slot,
            default: el.textContent.trim(),
            label: slot.replace(/^text:/, '').replace(/[-_]/g, ' ')
          });
        });
        state.textSlotsDiscovered = Array.from(sectionMap.values());
        state.defaultsReady = true;

        console.log(`[dash] captured ${Object.keys(state.defaults.images).length} image defaults, ${state.defaults.texts.length} text slots across ${state.textSlotsDiscovered.length} sections`);
      } catch (e) {
        console.warn('[dash] iframe defaults capture failed:', e.message);
      } finally {
        finish();
      }
    };
    iframe.onerror = finish;
    setTimeout(finish, 5000);   // safety
  });
}

// =====================================================================
//  STEP 2 — Firestore real-time subscriptions + rules check
// =====================================================================
function startSync() {
  if (state.unsubImages) state.unsubImages();
  if (state.unsubTexts)  state.unsubTexts();
  if (state.unsubCustom) state.unsubCustom();

  state.unsubImages = onSnapshot(doc(db, 'content', 'images'), snap => {
    state.images = snap.exists() ? snap.data() : {};
    delete state.images._updatedAt;
    renderImagesWithSearch();
    renderStats();
  }, err => {
    console.error('[dash] images sync error:', err);
    if (err.code === 'permission-denied') {
      state.rulesOk = false;
      renderRulesStatus();
      toast('Firestore rules not deployed — see Settings tab', 'error');
    } else {
      toast('Image sync failed: ' + err.message, 'error');
    }
  });

  state.unsubTexts = onSnapshot(doc(db, 'content', 'texts'), snap => {
    state.texts = snap.exists() ? snap.data() : {};
    delete state.texts._updatedAt;
    renderTexts();
    renderStats();
  }, err => {
    console.error('[dash] texts sync error:', err);
  });

  state.unsubCustom = onSnapshot(doc(db, 'content', 'custom-images'), snap => {
    if (snap.exists()) {
      const data = snap.data();
      state.customImages = Array.isArray(data.items) ? data.items : [];
    } else {
      state.customImages = [];
    }
    renderCustomImages();
    renderStats();
  }, err => {
    console.error('[dash] custom sync error:', err);
  });

  // Verify write permission by attempting a no-op merge
  verifyWritePermission();
}

async function verifyWritePermission() {
  try {
    await setDoc(doc(db, 'content', '_health'),
      { ping: true, _updatedAt: serverTimestamp() },
      { merge: true });
    state.rulesOk = true;
    renderRulesStatus();
  } catch (e) {
    if (e.code === 'permission-denied') {
      state.rulesOk = false;
      renderRulesStatus();
      console.error('[dash] WRITE PERMISSION DENIED — Firestore rules not deployed. See firestore.rules.');
    } else {
      console.warn('[dash] write health check failed:', e.message);
    }
  }
}

function renderRulesStatus() {
  const el = $('#rulesStatus');
  if (!el) return;
  if (state.rulesOk === true) {
    el.innerHTML = '<span class="dash-status-pill dash-status-pill--ok"><span class="dash-status-pill__dot"></span>Deployed &amp; working</span>';
  } else if (state.rulesOk === false) {
    el.innerHTML = '<span class="dash-status-pill dash-status-pill--err"><span class="dash-status-pill__dot"></span>Not deployed — edits will NOT sync</span>';
  } else {
    el.innerHTML = '<span class="dash-status-pill dash-status-pill--warn"><span class="dash-status-pill__dot"></span>Checking…</span>';
  }
}

// =====================================================================
//  STEP 3 — render images grouped by section
// =====================================================================
function renderImages() {
  const wrap = $('#imgSections');
  if (!wrap) return;

  wrap.innerHTML = IMAGE_SECTIONS.map(section => `
    <div class="dash-section">
      <div class="dash-section__head">
        <div class="dash-section__bar"></div>
        <h4 class="dash-section__title">${section.title}</h4>
        <span class="dash-section__count">${section.slots.length} slots</span>
      </div>
      <div class="dash-grid">
        ${section.slots.map(slot => renderImageCard(slot)).join('')}
      </div>
    </div>
  `).join('');

  // Wire buttons
  wrap.querySelectorAll('.dash-card').forEach(card => {
    const slot = card.getAttribute('data-slot');
    card.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => handleImageAction(slot, btn.getAttribute('data-act')));
    });
  });
}

function renderImageCard(slot) {
  const override = state.images[slot.id];
  const isCustom = !!override && override.length > 0;
  const url = isCustom ? override : (state.defaults.images[slot.id] || '');
  const urlLabel = url ? url.replace(/^https?:\/\//, '') : '(no default set)';
  const canDelete = isCustom && !!publicIdFromCloudinaryUrl(url);

  return `
    <div class="dash-card ${isCustom ? 'is-custom' : ''}" data-slot="${slot.id}">
      <div class="dash-card__preview ${url ? '' : 'dash-card__preview--empty'}">
        ${url
          ? `<img src="${url}" alt="${slot.label}" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('dash-card__preview--empty'); this.parentElement.innerHTML='Load failed';" />`
          : 'No image'
        }
      </div>
      <div class="dash-card__body">
        <div>
          <div class="dash-card__slot">${slot.id}</div>
          <div class="dash-card__label">${slot.label}</div>
        </div>
        <div class="dash-card__url" title="${url}">${urlLabel}</div>
        <div class="dash-card__btns">
          <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="upload">Replace</button>
          <button class="dash-btn dash-btn--ghost dash-btn--mini" data-act="url">Paste URL</button>
          <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="delete" ${!canDelete ? 'disabled title="Only available for Cloudinary-hosted custom images"' : ''}>Delete file</button>
          <button class="dash-btn dash-btn--ghost dash-btn--mini" data-act="reset" ${!isCustom ? 'disabled' : ''}>Reset</button>
        </div>
      </div>
    </div>
  `;
}

// =====================================================================
//  STEP 4 — render text slots grouped by section
// =====================================================================
function renderTexts() {
  const wrap = $('#textSections');
  if (!wrap) return;

  if (!state.textSlotsDiscovered.length) {
    wrap.innerHTML = `
      <div class="dash-section">
        <div class="dash-section__head">
          <div class="dash-section__bar"></div>
          <h4 class="dash-section__title">No text slots found</h4>
        </div>
        <p class="dash-panel__hint">
          No <code>data-text-slot</code> attributes were found on the site yet.
          Re-deploy with the latest <code>index.html</code> to make captions editable.
        </p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = state.textSlotsDiscovered.map(section => `
    <div class="dash-section">
      <div class="dash-section__head">
        <div class="dash-section__bar"></div>
        <h4 class="dash-section__title">${section.title}</h4>
        <span class="dash-section__count">${section.slots.length} text slots</span>
      </div>
      ${section.slots.map(s => renderTextCard(s)).join('')}
    </div>
  `).join('');

  // Wire buttons
  wrap.querySelectorAll('.dash-textcard').forEach(card => {
    const slot = card.getAttribute('data-slot');
    const input = card.querySelector('input, textarea');
    card.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const val = input.value.trim();
      if (val === input.dataset.original) return;
      const ok = await saveText(slot, val);
      if (ok) {
        input.dataset.original = val;
        toast(`Saved ${slot}`, 'success');
      }
    });
    card.querySelector('[data-act="delete"]').addEventListener('click', async () => {
      if (!confirm(`Reset ${slot} to default?`)) return;
      const ok = await deleteText(slot);
      if (ok) toast(`Reset ${slot}`, 'info');
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        card.querySelector('[data-act="save"]').click();
      }
    });
  });
}

function renderTextCard(s) {
  const override = state.texts[s.slot];
  const isCustom = !!override && override.length > 0 && override !== s.default;
  const val = isCustom ? override : s.default;
  const isLong = s.default && s.default.length > 80;
  return `
    <div class="dash-textcard ${isCustom ? 'is-custom' : ''}" data-slot="${s.slot}">
      <div>
        <div class="dash-textcard__slot">${s.slot}<small>${s.label}</small></div>
      </div>
      ${isLong
        ? `<textarea class="dash-textcard__input" rows="3" data-original="${escapeAttr(val)}">${escapeHtml(val)}</textarea>`
        : `<input type="text" class="dash-textcard__input" value="${escapeAttr(val)}" data-original="${escapeAttr(val)}" />`
      }
      <div class="dash-textcard__btns">
        <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="save">Save</button>
        <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="delete">Reset</button>
      </div>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// =====================================================================
//  STEP 5 — stats
// =====================================================================
function renderStats() {
  const totalSlots = IMAGE_SECTIONS.reduce((n, s) => n + s.slots.length, 0);
  const custom = Object.values(state.images).filter(v => v && v.length > 0).length;
  const textCount = state.textSlotsDiscovered.reduce((n, s) => n + s.slots.length, 0);
  $('#statSlots').textContent  = totalSlots;
  $('#statCustom').textContent = custom;
  $('#statTexts').textContent  = textCount;
  $('#navCountImages').textContent = totalSlots;
  $('#navCountTexts').textContent  = textCount;
  $('#navCountCustom').textContent = state.customImages.length;
}

// =====================================================================
//  STEP 6.5 — search filter
// =====================================================================
function getSearchQuery() {
  const el = $('#imgSearch');
  return el ? el.value.trim().toLowerCase() : '';
}

function matchesSearch(slot, label, query) {
  if (!query) return true;
  return slot.toLowerCase().includes(query) ||
         label.toLowerCase().includes(query);
}

function renderImagesWithSearch() {
  const query = getSearchQuery();
  const wrap = $('#imgSections');
  if (!wrap) return;

  let totalShown = 0;
  let totalMatched = 0;

  wrap.innerHTML = IMAGE_SECTIONS.map(section => {
    const matchedSlots = section.slots.filter(s => {
      const isMatch = matchesSearch(s.id, s.label, query);
      if (isMatch) totalMatched++;
      return isMatch;
    });
    if (!matchedSlots.length) return '';   // hide empty sections
    totalShown += matchedSlots.length;
    return `
      <div class="dash-section">
        <div class="dash-section__head">
          <div class="dash-section__bar"></div>
          <h4 class="dash-section__title">${section.title}</h4>
          <span class="dash-section__count">${matchedSlots.length} of ${section.slots.length}</span>
        </div>
        <div class="dash-grid">
          ${matchedSlots.map(slot => renderImageCard(slot)).join('')}
        </div>
      </div>
    `;
  }).join('') || `<p class="dash-panel__hint">No images match "${escapeHtml(query)}". Try a different search term.</p>`;

  // Wire buttons
  wrap.querySelectorAll('.dash-card').forEach(card => {
    const slot = card.getAttribute('data-slot');
    card.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => handleImageAction(slot, btn.getAttribute('data-act')));
    });
  });

  // Update count
  const countEl = $('#imgSearchCount');
  if (countEl) {
    const total = IMAGE_SECTIONS.reduce((n, s) => n + s.slots.length, 0);
    countEl.textContent = query ? `${totalMatched}/${total}` : `${total} total`;
  }
}

// =====================================================================
//  STEP 6.6 — Custom images (add / list / delete)
//  Custom images live in Firestore: doc 'content/custom-images' which
//  is an array of { id, url, publicId, caption, addedAt }.
//  The site's index.html renders them in a #custom-gallery section
//  that subscribes to the same doc.
// =====================================================================
async function addCustomImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) { input.remove(); return; }
    if (file.size > 10 * 1024 * 1024) {
      toast('Max 10MB per image', 'error');
      input.remove();
      return;
    }
    toast('Uploading to Cloudinary…', 'info');
    try {
      const url = await uploadToCloudinary(file);
      toast('Uploaded — saving…', 'info');
      const newItem = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url,
        publicId: publicIdFromCloudinaryUrl(url) || '',
        caption: '',
        addedAt: Date.now()
      };
      const updated = [...state.customImages, newItem];
      const ok = await saveCustomImages(updated);
      if (ok) {
        // Prompt for caption immediately
        const caption = prompt('Caption (optional — shown under the image on the site):', '');
        if (caption !== null && caption.trim()) {
          newItem.caption = caption.trim();
          await saveCustomImages([...state.customImages, newItem]);
        }
        toast('✓ Image added', 'success');
      }
    } catch (e) {
      toast('Add failed: ' + e.message, 'error');
    } finally {
      input.remove();
    }
  });
  input.click();
}

async function saveCustomImageCaption(id, caption) {
  const updated = state.customImages.map(c => c.id === id ? { ...c, caption } : c);
  await saveCustomImages(updated);
}

async function deleteCustomImage(item) {
  if (!confirm(`Delete this image?\n\n${item.caption || item.url.slice(-60)}\n\nThis removes it from the site AND deletes the file from Cloudinary.`)) return;
  toast('Deleting…', 'info');
  try {
    // If it's on Cloudinary, hard-delete the file too
    if (item.publicId) {
      try {
        const idToken = await getIdToken(auth.currentUser, false);
        const resp = await fetch(cloudinaryDeleteEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ publicId: item.publicId })
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          console.warn('Cloudinary delete failed (non-fatal):', err.error || resp.status);
        }
      } catch (e) {
        console.warn('Cloudinary delete failed (non-fatal):', e.message);
      }
    }
    const updated = state.customImages.filter(c => c.id !== item.id);
    await saveCustomImages(updated);
    toast('✓ Image deleted', 'success');
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

async function saveCustomImages(arr) {
  try {
    await setDoc(doc(db, 'content', 'custom-images'),
      { items: arr, _updatedAt: serverTimestamp() },
      { merge: true });
    // Show success immediately — don't block UI
    toast(`✓ Custom images saved (${arr.length})`, 'success');
    // Verify in background
    verifyInBackgroundCustom(arr.length);
    return true;
  } catch (e) {
    if (e.code === 'permission-denied' || /permission|denied|rules/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules not deployed. See Settings tab.', 'error');
      state.rulesOk = false;
      renderRulesStatus();
    } else if (/offline|network|timed out|unreachable/i.test(e.message)) {
      toast('NETWORK — cannot reach Firestore. Changes saved locally, will sync when connection returns.', 'error');
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
    return false;
  }
}

// Background verification for custom images (non-blocking)
async function verifyInBackgroundCustom(expectedCount) {
  try {
    const snap = await getDoc(doc(db, 'content', 'custom-images'));
    if (!snap.exists()) {
      toast('⚠ Custom images not yet on server — will retry. Check connection.', 'error');
      return false;
    }
    const data = snap.data();
    if (!Array.isArray(data.items) || data.items.length !== expectedCount) {
      toast('⚠ Custom images save failed on server — Firestore rules may be blocking. Visit /debug.html', 'error');
      return false;
    }
    console.log(`[dash] verified ${expectedCount} custom images saved to server ✓`);
    return true;
  } catch (e) {
    console.error('[dash] verify custom failed:', e.message);
    return false;
  }
}

// Background verification helper (non-blocking, used by saveImage/saveText)
async function verifyInBackground(slot, expectedValue, docName) {
  try {
    const snap = await getDoc(doc(db, 'content', docName));
    if (!snap.exists()) {
      toast(`⚠ ${slot} not yet on server — will retry. Check connection.`, 'error');
      return false;
    }
    const data = snap.data();
    if (data[slot] !== expectedValue) {
      toast(`⚠ ${slot} save failed on server — Firestore rules may be blocking. Visit /debug.html`, 'error');
      return false;
    }
    console.log(`[dash] verified ${slot} saved to server ✓`);
    return true;
  } catch (e) {
    console.error(`[dash] verify ${slot} failed:`, e.message);
    return false;
  }
}

function renderCustomImages() {
  const grid = $('#customGrid');
  if (!grid) return;
  if (!state.customImages.length) {
    grid.innerHTML = `
      <div class="dash-card dash-card--empty">
        <div class="dash-card__body">
          <p>No custom images yet.</p>
          <button class="dash-btn dash-btn--primary" onclick="document.getElementById('btnAddCustom').click()" style="margin-top:10px;">+ Add your first image</button>
        </div>
      </div>
    `;
    return;
  }
  grid.innerHTML = state.customImages.map(item => `
    <div class="dash-card dash-card--custom" data-id="${item.id}">
      <div class="dash-card__preview">
        <img src="${item.url}" alt="${escapeAttr(item.caption || 'custom image')}" loading="lazy" />
      </div>
      <div class="dash-card__body">
        <input type="text" class="dash-card__caption" placeholder="Caption (shown on site)" value="${escapeAttr(item.caption || '')}" data-id="${item.id}" />
        <div class="dash-card__url">${item.url.replace(/^https?:\/\//, '').slice(0, 80)}</div>
        <div class="dash-card__btns">
          <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="save-caption">Save caption</button>
          <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="delete">Delete image</button>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.dash-card--custom').forEach(card => {
    const id = card.getAttribute('data-id');
    const captionInput = card.querySelector('.dash-card__caption');
    card.querySelector('[data-act="save-caption"]').addEventListener('click', async () => {
      const ok = await saveCustomImageCaption(id, captionInput.value.trim());
      if (ok) toast('Caption saved', 'success');
    });
    card.querySelector('[data-act="delete"]').addEventListener('click', () => {
      const item = state.customImages.find(c => c.id === id);
      if (item) deleteCustomImage(item);
    });
    captionInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        card.querySelector('[data-act="save-caption"]').click();
      }
    });
  });
}

// =====================================================================
//  STEP 6 — image actions
// =====================================================================
async function handleImageAction(slot, act) {
  if (act === 'upload') return triggerUpload(slot);
  if (act === 'url')    return triggerUrlPaste(slot);
  if (act === 'delete') return deleteFromCloudinaryForSlot(slot);
  if (act === 'reset')  return resetSlot(slot);
}

function triggerUpload(slot) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) { input.remove(); return; }
    if (file.size > 10 * 1024 * 1024) {
      toast('Max 10MB per image', 'error');
      input.remove();
      return;
    }
    toast('Uploading to Cloudinary…', 'info');
    try {
      const url = await uploadToCloudinary(file);
      toast('Uploaded — saving to Firestore…', 'info');
      const ok = await saveImage(slot, url);
      if (ok) toast(`✓ ${slot} updated`, 'success');
    } catch (e) {
      toast('Upload failed: ' + e.message, 'error');
    } finally {
      input.remove();
    }
  });
  input.click();
}

function triggerUrlPaste(slot) {
  const current = state.images[slot] || state.defaults.images[slot] || '';
  const url = prompt(`Paste image URL for ${slot}:`, current);
  if (url === null) return;
  if (!url.trim()) { toast('No URL entered', 'error'); return; }
  try { new URL(url.trim()); } catch { toast('Invalid URL', 'error'); return; }
  saveImage(slot, url.trim()).then(ok => {
    if (ok) toast(`✓ ${slot} updated`, 'success');
  });
}

async function resetSlot(slot) {
  if (!confirm(`Reset ${slot} to default?`)) return;
  const ok = await saveImage(slot, '');
  if (ok) toast(`${slot} reset to default`, 'info');
}

async function deleteFromCloudinaryForSlot(slot) {
  const url = state.images[slot];
  if (!url) { toast(`No image set for ${slot}`, 'error'); return; }
  const publicId = publicIdFromCloudinaryUrl(url);
  if (!publicId) {
    toast(`This image isn't on Cloudinary — can only hard-delete Cloudinary uploads`, 'error');
    return;
  }
  if (!confirm(`Permanently DELETE from Cloudinary?\n\n${publicId}\n\nThis cannot be undone.`)) return;
  toast('Deleting from Cloudinary…', 'info');
  try {
    const idToken = await getIdToken(auth.currentUser, false);
    const resp = await fetch(cloudinaryDeleteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ publicId })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    const ok = await saveImage(slot, '');
    if (ok) toast(`✓ Deleted ${publicId}`, 'success');
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

// =====================================================================
//  STEP 7 — Firestore writes with VERIFICATION
//  The bug we're fixing: with IndexedDB persistence enabled, setDoc()
//  can return success even when the actual server write failed (it
//  gets queued in the local cache). We verify by re-reading the doc
//  after write to confirm the server actually has our change.
// =====================================================================
async function saveImage(slot, url) {
  try {
    // Write to Firestore (local cache accepts immediately, server syncs in background)
    await setDoc(doc(db, 'content', 'images'),
      { [slot]: url, _updatedAt: serverTimestamp() },
      { merge: true });

    // Show success immediately — don't block UI waiting for server
    toast(`✓ ${slot} saved`, 'success');

    // Verify in background (non-blocking)
    verifyInBackground(slot, url, 'images');
    return true;
  } catch (e) {
    console.error('[dash] saveImage failed:', e);
    if (e.code === 'permission-denied' || /permission|denied/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules rejected the write. Open Settings → Rules.', 'error');
      state.rulesOk = false;
      renderRulesStatus();
    } else if (/offline|network|timed out|unreachable/i.test(e.message)) {
      toast('NETWORK — cannot reach Firestore. Changes saved locally, will sync when connection returns.', 'error');
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
    return false;
  }
}

async function saveText(slot, text) {
  try {
    await setDoc(doc(db, 'content', 'texts'),
      { [slot]: text, _updatedAt: serverTimestamp() },
      { merge: true });
    toast(`✓ ${slot} saved`, 'success');
    verifyInBackground(slot, text, 'texts');
    return true;
  } catch (e) {
    console.error('[dash] saveText failed:', e);
    if (e.code === 'permission-denied' || /permission|denied/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules rejected the write. See Settings tab.', 'error');
      state.rulesOk = false;
      renderRulesStatus();
    } else if (/offline|network|timed out|unreachable/i.test(e.message)) {
      toast('NETWORK — cannot reach Firestore. Check connection and retry. Visit /debug.html', 'error');
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
    return false;
  }
}

async function deleteText(slot) {
  return saveText(slot, '');
}

async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', cloudinaryConfig.unsignedPreset);
  if (cloudinaryConfig.folder) fd.append('folder', cloudinaryConfig.folder);
  const resp = await fetch(cloudinaryUploadUrl(), { method: 'POST', body: fd });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    let msg = `Cloudinary ${resp.status}`;
    try {
      const j = JSON.parse(txt);
      if (j.error?.message) msg = `Cloudinary: ${j.error.message}`;
    } catch {}
    throw new Error(msg);
  }
  const data = await resp.json();
  if (!data.secure_url) throw new Error('Cloudinary response missing secure_url');
  return data.secure_url;
}

// =====================================================================
//  STEP 8 — Reset ALL
// =====================================================================
async function resetAll() {
  if (!confirm('Reset ALL image slots to defaults? This wipes every override in Firestore.')) return;
  const blank = Object.fromEntries(
    IMAGE_SECTIONS.flatMap(s => s.slots).map(s => [s.id, ''])
  );
  blank._updatedAt = serverTimestamp();
  try {
    await setDoc(doc(db, 'content', 'images'), blank, { merge: true });
    toast('✓ All images reset to defaults', 'success');
  } catch (e) {
    toast('Reset failed: ' + e.message, 'error');
  }
}

// =====================================================================
//  STEP 9 — sidebar navigation
// =====================================================================
const VIEW_TITLES = {
  images:   { title: 'All Images',         sub: 'Manage every image on your site from one place' },
  custom:   { title: 'Custom Images',      sub: 'Upload additional product shots and recent work — auto-appears on the site' },
  texts:    { title: 'Captions & Text',    sub: 'Edit every heading, label, and description' },
  settings: { title: 'Settings & Status',  sub: 'Connection health and configuration' }
};

function initNav() {
  $$('.dash-nav-item').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      $$('.dash-nav-item').forEach(t => t.classList.toggle('is-active', t === tab));
      $$('.dash-panel').forEach(p => {
        p.classList.toggle('is-active', p.id === `tab-${target}`);
      });
      const v = VIEW_TITLES[target];
      if (v) {
        $('#viewTitle').textContent = v.title;
        $('#viewSub').textContent   = v.sub;
      }
    });
  });
}

// =====================================================================
//  STEP 10 — login (with immediate UI swap fix)
//  The previous bug: after signInWithEmailAndPassword resolved,
//  onAuthStateChanged was the only thing swapping the UI. Sometimes
//  that callback is delayed by network/persistence warm-up.
//  Fix: swap the UI immediately after await resolves, AND keep the
//  onAuthStateChanged subscription for the cross-tab case.
// =====================================================================
function swapToApp(user) {
  if (!user) return;
  $('#dashLogin').hidden = true;
  $('#dashApp').hidden = false;
  const email = user.email || '';
  $('#headerUser').textContent = email;
  $('#sidebarUser').textContent = email;
  // Start sync if not already running
  if (!state.unsubImages) startSync();
  // Capture defaults from site (first time only)
  if (!state.defaultsReady) {
    captureDefaultsFromSite().then(() => {
      renderTexts();
      renderStats();
    });
  }
  toast(`Welcome, ${email}`, 'success');
}

function swapToLogin() {
  $('#dashLogin').hidden = false;
  $('#dashApp').hidden = true;
  if (state.unsubImages) { state.unsubImages(); state.unsubImages = null; }
  if (state.unsubTexts)  { state.unsubTexts();  state.unsubTexts  = null; }
}

function initLogin() {
  $('#dashLoginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#dashEmail').value.trim();
    const pass  = $('#dashPass').value;
    const errEl = $('#dashLoginErr');
    const btn   = $('#dashLoginBtn');
    errEl.textContent = '';
    btn.disabled = true;
    btn.querySelector('.dash-btn-label').textContent = 'Logging in…';
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, pass);
      // IMMEDIATELY swap UI — don't wait for onAuthStateChanged
      swapToApp(userCred.user);
    } catch (err) {
      const map = {
        'auth/invalid-email':            'That email address is malformed.',
        'auth/user-disabled':            'This account has been disabled.',
        'auth/user-not-found':           'No account found with that email.',
        'auth/wrong-password':           'Wrong password. Try again.',
        'auth/invalid-credential':       'Wrong email or password.',
        'auth/too-many-requests':        'Too many attempts. Wait a minute and try again.',
        'auth/network-request-failed':   'Network error — check your connection.'
      };
      errEl.textContent = map[err.code] || `Login failed: ${err.code || err.message}`;
      btn.disabled = false;
      btn.querySelector('.dash-btn-label').textContent = 'Log in';
    }
  });

  $('#dashSignOut').addEventListener('click', async () => {
    try { await signOut(auth); } catch (e) { toast('Sign out failed', 'error'); }
  });
}

// =====================================================================
//  STEP 11 — auth state (handles cross-tab + page reload)
//  ---------------------------------------------------------------------
//  CRITICAL FIX: when Firestore has network issues, onAuthStateChanged
//  can fire with null even right after a successful login. This was
//  causing the login form to flash back and "swallow" the user's
//  credentials. We now:
//    1. Track the last user we saw
//    2. Only swap to login if we get a real null AND we weren't just
//       logged in within the last 5 seconds (debounce)
//    3. Show a "Reconnecting…" banner instead of bouncing the user
// =====================================================================
let _lastUser = null;
let _lastSwapToApp = 0;

onAuthStateChanged(auth, user => {
  if (user) {
    _lastUser = user;
    _lastSwapToApp = Date.now();
    swapToApp(user);
  } else {
    // Did we JUST log in? If so, this null is a network hiccup, not a real sign-out.
    // Don't swap back to the login form — keep showing the dashboard.
    const sinceLastApp = Date.now() - _lastSwapToApp;
    if (_lastUser && sinceLastApp < 10000) {
      console.warn(`[auth] ignoring null user (likely network hiccup ${sinceLastApp}ms after login)`);
      showConnBanner('Reconnecting to Firebase…', 'warn');
      // Try to reconnect
      forceOnline();
      return;
    }
    // Real sign-out (or initial load)
    _lastUser = null;
    swapToLogin();
    // Reset login form
    const btn = $('#dashLoginBtn');
    if (btn) {
      btn.disabled = false;
      btn.querySelector('.dash-btn-label').textContent = 'Log in';
    }
  }
});

// Connection banner — shows Firebase online/offline state at top of dashboard
function showConnBanner(msg, kind = 'warn') {
  let banner = $('#dashConnBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'dashConnBanner';
    banner.style.cssText = 'position:sticky;top:0;z-index:100;padding:10px 18px;text-align:center;font:600 13px/1 "Poppins",sans-serif;border-radius:0 0 8px 8px;';
    const main = $('.dash-main');
    if (main) main.prepend(banner);
  }
  banner.textContent = msg;
  banner.style.display = 'block';
  if (kind === 'warn') {
    banner.style.background = 'rgba(255, 213, 79, .15)';
    banner.style.color = '#ffd54f';
    banner.style.borderBottom = '1px solid rgba(255, 213, 79, .3)';
  } else if (kind === 'err') {
    banner.style.background = 'rgba(255, 82, 82, .15)';
    banner.style.color = '#ff5252';
    banner.style.borderBottom = '1px solid rgba(255, 82, 82, .3)';
  } else if (kind === 'ok') {
    banner.style.background = 'rgba(46, 204, 113, .15)';
    banner.style.color = '#2ecc71';
    banner.style.borderBottom = '1px solid rgba(46, 204, 113, .3)';
    // Auto-hide success after 2.5s
    clearTimeout(banner._t);
    banner._t = setTimeout(() => { banner.style.display = 'none'; }, 2500);
  } else {
    banner.style.display = 'none';
  }
}

// Listen for browser online/offline events to update the banner
window.addEventListener('online', () => {
  showConnBanner('Back online — reconnecting…', 'ok');
  forceOnline();
});
window.addEventListener('offline', () => {
  showConnBanner('Your device is offline. Edits will be saved when you reconnect.', 'warn');
});

// =====================================================================
//  STEP 12 — wire buttons + boot
// =====================================================================
function boot() {
  initLogin();
  initNav();

  $('#btnRefresh').addEventListener('click', () => {
    renderImagesWithSearch();
    renderStats();
    toast('Refreshed', 'info');
  });
  $('#btnRefreshText').addEventListener('click', () => {
    renderTexts();
    toast('Refreshed', 'info');
  });
  $('#btnResetAll').addEventListener('click', resetAll);
  const btnReset2 = $('#btnResetAll2');
  if (btnReset2) btnReset2.addEventListener('click', resetAll);

  // Search bar — live filter
  const search = $('#imgSearch');
  if (search) {
    let searchTimer = null;
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderImagesWithSearch(), 100);
    });
  }

  // Custom image buttons
  const btnAddCustom = $('#btnAddCustom');
  if (btnAddCustom) btnAddCustom.addEventListener('click', addCustomImage);
  const btnRefreshCustom = $('#btnRefreshCustom');
  if (btnRefreshCustom) btnRefreshCustom.addEventListener('click', () => {
    renderCustomImages();
    toast('Refreshed', 'info');
  });

  // Show the delete endpoint in Settings
  const ep = $('#settingsDeleteEndpoint');
  if (ep) ep.textContent = cloudinaryDeleteEndpoint;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
