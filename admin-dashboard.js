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

import {
  auth,
  db,
  forceOnline,
  waitForServer,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdToken,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp
} from "./firebase-config.js";
import {
  cloudinaryConfig,
  cloudinaryUploadUrl,
  cloudinaryDeleteEndpoint,
  publicIdFromCloudinaryUrl
} from "./cloudinary-config.js";
import {
  PROJECT_CASE_STUDIES,
  BLOG_POSTS,
  DOWNLOADS,
  SITE_CONTENT_DEFAULTS,
  PRICING_TIERS,
  TESTIMONIALS,
  STATS,
  ADDONS
} from "./site-config.js";

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
  }
  // NOTE: Web Showcase cards (img:web-1 through img:web-12) are now
  // managed dynamically via the Projects tab. See PROJECTS_DEFAULTS below.
];

// =====================================================================
//  STATE
// =====================================================================
const state = {
  images: {},
  texts: {},
  projects: [],
  customImages: [],
  defaults: { images: {}, texts: {} },
  defaultsReady: false,
  textSlotsDiscovered: [],
  unsubImages: null,
  unsubTexts: null,
  unsubCustom: null,
  unsubProjects: null,
  unsubCaseStudies: null,
  unsubBlogPosts: null,
  unsubDownloads: null,
  unsubSiteContent: null,
  unsubAddons: null,
  caseStudies: [],          // Firestore content/case-studies items only (admin-curated)
  blogPosts: [],            // Firestore content/blog-posts items only (admin-curated)
  downloads: [],            // Firestore content/downloads items only (admin-curated)
  siteContent: {},          // Firestore content/site-content overrides (flat key/value)
  addons: [],               // Firestore content/addons items only (admin-curated)
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
      // Silently log network errors — don't toast on every transient failure
      console.warn('[dash] Image sync error:', err.message);
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

  state.unsubProjects = onSnapshot(doc(db, 'content', 'projects'), snap => {
    if (snap.exists()) {
      const data = snap.data();
      state.projects = Array.isArray(data.items) ? data.items : [];
    } else {
      state.projects = [];
    }
    renderProjects();
    renderStats();
  }, err => {
    console.error('[dash] projects sync error:', err);
  });

  state.unsubCaseStudies = onSnapshot(doc(db, 'content', 'case-studies'), snap => {
    if (snap.exists()) {
      const data = snap.data();
      state.caseStudies = Array.isArray(data.items) ? data.items : [];
    } else {
      state.caseStudies = [];
    }
    renderCaseStudies();
    renderStats();
  }, err => {
    console.error('[dash] case-studies sync error:', err);
  });

  state.unsubBlogPosts = onSnapshot(doc(db, 'content', 'blog-posts'), snap => {
    if (snap.exists()) {
      const data = snap.data();
      state.blogPosts = Array.isArray(data.items) ? data.items : [];
    } else {
      state.blogPosts = [];
    }
    renderBlogPosts();
    renderStats();
  }, err => {
    console.error('[dash] blog-posts sync error:', err);
  });

  state.unsubDownloads = onSnapshot(doc(db, 'content', 'downloads'), snap => {
    if (snap.exists()) {
      const data = snap.data();
      state.downloads = Array.isArray(data.items) ? data.items : [];
    } else {
      state.downloads = [];
    }
    renderDownloadsEditor();
    renderStats();
  }, err => {
    console.error('[dash] downloads sync error:', err);
  });

  state.unsubSiteContent = onSnapshot(doc(db, 'content', 'site-content'), snap => {
    if (snap.exists()) {
      const data = snap.data();
      // Strip the internal _updatedAt key — everything else is a flat override
      const overrides = { ...data };
      delete overrides._updatedAt;
      state.siteContent = overrides;
    } else {
      state.siteContent = {};
    }
    renderSiteContentEditor();
    renderStats();
  }, err => {
    console.error('[dash] site-content sync error:', err);
  });

  state.unsubAddons = onSnapshot(doc(db, 'content', 'addons'), snap => {
    if (snap.exists()) {
      const data = snap.data();
      state.addons = Array.isArray(data.items) ? data.items : [];
    } else {
      state.addons = [];
    }
    renderAddons();
    renderStats();
  }, err => {
    console.error('[dash] addons sync error:', err);
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

  // Defensive: use setText helper that skips missing elements
  // (prevents "Cannot set properties of null" crash when admin.html is
  // an older version missing some stat elements)
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  setText('statSlots', totalSlots);
  setText('statCustom', custom);
  setText('statTexts', textCount);
  setText('navCountImages', totalSlots);
  setText('navCountTexts', textCount);
  setText('navCountCustom', state.customImages.length);
  setText('navCountProjects', state.projects.length);
  setText('navCountCaseStudies', buildMergedListCaseStudies().length);
  setText('navCountBlogPosts', buildMergedListBlogPosts().length);
  setText('navCountDownloads', buildMergedListDownloads().length);
  setText('navCountAddons', buildMergedListAddons().length);
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
  images:        { title: 'All Images',         sub: 'Manage every image on your site from one place' },
  projects:      { title: 'Web Projects',       sub: 'Add, edit, delete, and reorder projects in the Recent Web Work showcase' },
  addons:        { title: 'Service Add-ons',    sub: 'À la carte pricing for single items — logo only, extra page, business card, etc.' },
  'case-studies':{ title: 'Project Case Studies', sub: 'Full case-study pages on /project-detail.html — challenge, solution, tools, screenshots' },
  'blog-posts':  { title: 'Blog Posts',         sub: 'Full blog articles on /blog-post.html — content, tags, author' },
  downloads:     { title: 'Downloads',           sub: 'Manage the CV, corporate profile, and brand deck PDFs on /downloads.html' },
  'site-content':{ title: 'Site Content',        sub: 'Edit homepage hero text, stats, pricing, testimonials, and CTA band' },
  custom:        { title: 'Custom Images',      sub: 'Upload additional product shots and recent work — auto-appears on the site' },
  texts:         { title: 'Captions & Text',    sub: 'Edit every heading, label, and description' },
  settings:      { title: 'Settings & Status',  sub: 'Connection health and configuration' }
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
        const t = $('#viewTitle');
        const s = $('#viewSub');
        if (t) t.textContent = v.title;
        if (s) s.textContent = v.sub;
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
  const login = $('#dashLogin');
  const app = $('#dashApp');
  if (login) login.hidden = true;
  if (app) app.hidden = false;
  const email = user.email || '';
  const hu = $('#headerUser');
  const su = $('#sidebarUser');
  if (hu) hu.textContent = email;
  if (su) su.textContent = email;
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
  const login = $('#dashLogin');
  const app = $('#dashApp');
  if (login) login.hidden = false;
  if (app) app.hidden = true;
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
//  STEP 11.5 — PROJECTS CRUD (dynamic Web Showcase)
//  Projects are stored as an array in Firestore doc: content/projects
//  Each project: { id, title, category, description, imageUrl, liveUrl, order }
// =====================================================================

// These are Awwal's real, live projects — same 8 sites shown in "Websites I've Built".
// imageUrl uses WordPress mshots (free live screenshot service) so each card shows an
// actual homepage screenshot of the real site instead of a stock/placeholder photo.
const PROJECTS_DEFAULTS = [
  { title: 'Tawakkal TUFC',                   category: 'Food Brand',      description: 'Web · WhatsApp Ordering',  liveUrl: 'https://tawakkaltufc.com' },
  { title: 'AJB Autos',                       category: 'Auto Dealership', description: 'Web · Dark UI',            liveUrl: 'https://ajbautos.com.ng' },
  { title: 'Scottish Essentials Beauty & Spa',category: 'Spa Brand',       description: 'Web · Booking Flow',       liveUrl: 'https://scottishessentialsbeautyspa.vercel.app' },
  { title: 'Akay Mighty Bank App',            category: 'Bank App',        description: 'Firebase · Admin Panel',   liveUrl: 'https://akay-online-bank-app.vercel.app' },
  { title: 'Fresh Buzees Visuals',            category: 'Videography',     description: 'Web · Scroll Animations',  liveUrl: 'https://fresh-buzees-visuals.vercel.app' },
  { title: "Reedah's Delight",                category: 'Cake Brand',      description: 'Web · Product Showcase',   liveUrl: 'https://reedah-s-delight.vercel.app' },
  { title: 'Victorian Bloom Hotel & Resort',  category: 'Hotel & Resort',  description: 'Web · Booking Flow',       liveUrl: 'https://victoria-bloom-hotel-resort.onrender.com' },
  { title: 'Abbas Galaxy',                    category: 'Real Estate',     description: 'Web · Location Maps',      liveUrl: 'https://abbasgalaxy.onrender.com' }
];

// Design (branding) projects — these show in the Design filter on /projects.html
const DESIGN_PROJECTS_DEFAULTS = [
  { title: 'Adenike\'s Jewelry Logo',     category: 'Logo Design',     description: 'Brand identity · Monogram',   imageUrl: 'https://cdn.kord.live/serve/ZoCtg7SPBWlc.jpg' },
  { title: 'Chi38v\'s Brand Identity',    category: 'Brand Identity',  description: 'Logo · Colors · Typography',  imageUrl: 'https://cdn.kord.live/serve/4cG5RghDuw9w.jpg' },
  { title: 'Sicily Standard Menu',        category: 'Menu Design',     description: 'Restaurant · Print-ready',    imageUrl: 'https://cdn.kord.live/serve/NRlPY4VLxSVG.jpg' },
  { title: 'Onazy Brand Package',         category: 'Brand Package',   description: 'Logo · Business Card · Social', imageUrl: 'https://cdn.kord.live/serve/KWXIC3QcBiFj.jpg' },
  { title: 'Club Event Flyer',            category: 'Flyer Design',    description: 'Nightclub · Bold · Eye-catching', imageUrl: 'https://cdn.kord.live/serve/mH1YnwxDaQUi.jpg' },
  { title: 'Web3 Crypto Flyer',           category: 'Crypto Flyer',    description: 'Web3 · Modern · Tech',        imageUrl: 'https://cdn.kord.live/serve/lJJcUHt93XsB.jpg' }
];

// Print projects — these show in the Print filter on /projects.html
const PRINT_PROJECTS_DEFAULTS = [
  { title: 'Business Card Print',         category: 'Business Card',   description: 'CMYK · Print-ready · 350gsm',  imageUrl: 'https://cdn.kord.live/serve/009RDmkmQA0x.jpg' },
  { title: 'Leather Print Job',           category: 'Leather Print',   description: 'Custom leather · Hot foil',    imageUrl: 'https://cdn.kord.live/serve/bmVs49dmCNWa.jpg' },
  { title: 'Paper Bag Branding',          category: 'Paper Bag',       description: 'Brown kraft · Logo print',     imageUrl: 'https://cdn.kord.live/serve/ASqKSjkDcDCF.jpg' },
  { title: 'Custom Bag Print',            category: 'Custom Bag',      description: 'Premium · Branded · Full color', imageUrl: 'https://cdn.kord.live/serve/xk5l1BNebbMK.jpg' },
  { title: 'Branded Merchandise',         category: 'Branded Merch',   description: 'T-shirts · Mugs · Caps',      imageUrl: 'https://cdn.kord.live/serve/kZ3AhQCgS6Yr.jpg' }
];

// Track which projects are marked for deletion
const markedForDeletion = new Set();

function getProjectSearchQuery() {
  const el = $('#projectSearch');
  return el ? el.value.trim().toLowerCase() : '';
}

function renderProjects() {
  const list = $('#projectsList');
  if (!list) return;

  if (!state.projects.length) {
    list.innerHTML = `
      <div class="dash-card dash-card--empty">
        <div class="dash-card__body">
          <p>No projects yet.</p>
          <p style="margin-top:6px;font-size:12px;">Click <strong>+ Add New Project</strong> to create one, or <strong>Seed real projects</strong> to start with your 8 live sites.</p>
        </div>
      </div>
    `;
    return;
  }

  // Sort by order
  const sorted = [...state.projects].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Apply search filter
  const query = getProjectSearchQuery();
  const filtered = query
    ? sorted.filter(p =>
        (p.title || '').toLowerCase().includes(query) ||
        (p.category || '').toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query)
      )
    : sorted;

  // Update search count
  const countEl = $('#projectSearchCount');
  if (countEl) {
    countEl.textContent = query ? `${filtered.length}/${sorted.length}` : `${sorted.length} total`;
  }

  if (!filtered.length) {
    list.innerHTML = `<p class="dash-panel__hint">No projects match "${escapeHtml(query)}".</p>`;
    return;
  }

  list.innerHTML = filtered.map((p, i) => {
    const isMarked = markedForDeletion.has(p.id);
    const originalIndex = sorted.findIndex(s => s.id === p.id);
    // Display label: prefer the explicit categoryLabel, fall back to the
    // raw category string for legacy projects (which may store a richer
    // label like "Spa Brand" in `category` instead of the clean
    // Web/Brand/Print value).
    const catLabel = p.categoryLabel
      || (p.category && !['Web', 'Brand', 'Print'].includes(p.category) ? p.category : '');
    // Clean category pill (Web/Brand/Print) — color-coded for scanning.
    const catValue = ['Web', 'Brand', 'Print'].includes(p.category) ? p.category : '';
    const catPillStyle = catValue === 'Brand'
      ? 'color:#ff8a3d;background:rgba(255,138,61,0.10);border:1px solid rgba(255,138,61,0.30);'
      : catValue === 'Print'
      ? 'color:#2ecc71;background:rgba(46,204,113,0.10);border:1px solid rgba(46,204,113,0.30);'
      : 'color:var(--akay-accent,#5b5bf5);background:rgba(91,91,245,0.10);border:1px solid rgba(91,91,245,0.30);';
    return `
    <div class="dash-project-card ${isMarked ? 'is-marked' : ''}" data-id="${p.id}">
      <div class="dash-project-card__preview">
        ${p.imageUrl ? `<img src="${escapeAttr(p.imageUrl)}" alt="${escapeAttr(p.title)}" loading="lazy" />` : '<span class="dash-project-card__noimg">No image</span>'}
      </div>
      <div class="dash-project-card__body">
        <div class="dash-project-card__head">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <label class="dash-project-card__mark" title="Mark for bulk delete">
              <input type="checkbox" data-act="mark" ${isMarked ? 'checked' : ''} />
              <span class="dash-project-card__mark-box"></span>
            </label>
            <span class="dash-project-card__order">#${originalIndex + 1}</span>
            ${catValue ? `<span class="dash-project-card__tag" style="${catPillStyle}">${escapeHtml(catValue)}</span>` : ''}
            ${catLabel ? `<span class="dash-project-card__tag">${escapeHtml(catLabel)}</span>` : ''}
            <span class="dash-project-card__section">${escapeHtml(p.section === 'design-services' ? 'Design' : p.section === 'print-services' ? 'Print' : p.section === 'web-portfolio' ? 'Web Portfolio' : 'Web Showcase')}</span>
          </div>
          <div class="dash-project-card__btns">
            <button class="dash-btn dash-btn--ghost dash-btn--mini" data-act="up" title="Move up">↑</button>
            <button class="dash-btn dash-btn--ghost dash-btn--mini" data-act="down" title="Move down">↓</button>
            <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="edit">Edit</button>
            <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="delete">Delete</button>
          </div>
        </div>
        <h4 class="dash-project-card__title">${escapeHtml(p.title || 'Untitled')}</h4>
        <p class="dash-project-card__desc">${escapeHtml(p.description || '')}</p>
        ${p.liveUrl ? `<a href="${escapeAttr(p.liveUrl)}" target="_blank" class="dash-project-card__url">${escapeHtml(p.liveUrl)}</a>` : ''}
      </div>
    </div>
  `}).join('');

  // Wire buttons + checkboxes
  list.querySelectorAll('.dash-project-card').forEach(card => {
    const id = card.getAttribute('data-id');
    card.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => handleProjectAction(id, btn.getAttribute('data-act')));
    });
    const markBox = card.querySelector('input[data-act="mark"]');
    if (markBox) {
      markBox.addEventListener('change', e => {
        if (e.target.checked) {
          markedForDeletion.add(id);
          card.classList.add('is-marked');
        } else {
          markedForDeletion.delete(id);
          card.classList.remove('is-marked');
        }
        updateMarkedCount();
      });
    }
  });

  updateMarkedCount();
}

function updateMarkedCount() {
  const el = $('#markedCount');
  if (el) {
    const count = markedForDeletion.size;
    el.textContent = count > 0 ? `${count} marked` : '';
    el.style.display = count > 0 ? 'inline-block' : 'none';
  }
  const btn = $('#btnDeleteMarked');
  if (btn) {
    btn.disabled = markedForDeletion.size === 0;
    btn.textContent = markedForDeletion.size > 0
      ? `🗑 Delete ${markedForDeletion.size} marked`
      : '🗑 Delete marked';
  }
}

async function deleteMarkedProjects() {
  if (markedForDeletion.size === 0) return;
  const ok = await new Promise(resolve => {
    showConfirm(`Delete ${markedForDeletion.size} marked project(s)? This cannot be undone.`, resolve);
  });
  if (!ok) return;

  toast(`Deleting ${markedForDeletion.size} projects...`, 'info');
  const updated = state.projects.filter(p => !markedForDeletion.has(p.id));
  // Re-index order
  updated.forEach((p, i) => p.order = i);
  const saveOk = await saveProjects(updated);
  if (saveOk) {
    markedForDeletion.clear();
    toast('✓ Marked projects deleted', 'success');
  }
}

function clearAllMarks() {
  markedForDeletion.clear();
  renderProjects();
}

async function handleProjectAction(id, act) {
  const project = state.projects.find(p => p.id === id);
  if (!project && act !== 'add') return;

  if (act === 'up') return moveProject(id, -1);
  if (act === 'down') return moveProject(id, 1);
  if (act === 'edit') return editProject(project);
  if (act === 'delete') return deleteProject(project);
}

function addNewProject() {
  showProjectForm(null);
}

function editProject(project) {
  showProjectForm(project);
}

function showProjectForm(project) {
  const isEdit = !!project;
  const p = project || { title: '', category: '', description: '', imageUrl: '', liveUrl: '', section: 'web-showcase' };

  // Normalize the category field. Older projects may not have one — infer
  // from the existing section so the dropdown shows a sensible default.
  const inferCatFromSection = (sec) => {
    const s = String(sec || '').toLowerCase();
    if (s === 'design-services') return 'Brand';
    if (s === 'print-services')  return 'Print';
    return 'Web';
  };
  // Only accept a clean Web/Brand/Print value as explicit category;
  // otherwise fall back to inferring from section.
  const explicitCat = (p.category && ['Web', 'Brand', 'Print'].includes(p.category))
    ? p.category
    : inferCatFromSection(p.section);

  // Build modal — scrollable on mobile
  let modal = $('#projectFormModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'projectFormModal';
  modal.className = 'akay-modal is-open';
  modal.innerHTML = `
    <div class="akay-modal__panel dash-project-form-modal" style="max-width:480px;max-height:90vh;overflow-y:auto;">
      <button class="akay-modal__close" type="button" id="pfClose">×</button>
      <h2 class="akay-modal__title">${isEdit ? 'Edit Project' : 'Add New Project'}</h2>
      <form id="projectForm" class="dash-form">
        <label class="dash-field">
          <span>Title *</span>
          <input type="text" id="pf-title" required value="${escapeAttr(p.title)}" placeholder="e.g. Chardonic Oil & Gas" />
        </label>
        <label class="dash-field">
          <span>Show in section *</span>
          <select id="pf-section" required>
            <option value="web-showcase" ${p.section === 'web-showcase' ? 'selected' : ''}>Recent Web Work (showcase marquee)</option>
            <option value="web-portfolio" ${p.section === 'web-portfolio' ? 'selected' : ''}>Websites I've Built (clickable browser cards)</option>
            <option value="design-services" ${p.section === 'design-services' ? 'selected' : ''}>Design Services</option>
            <option value="print-services" ${p.section === 'print-services' ? 'selected' : ''}>Print Services</option>
            <option value="none" ${p.section === 'none' ? 'selected' : ''}>Don't show in showcase (hidden)</option>
          </select>
        </label>
        <label class="dash-field">
          <span>Category (public filter on /projects.html) *</span>
          <select id="pf-category-select" required>
            <option value="Web"   ${explicitCat === 'Web'   ? 'selected' : ''}>Web — websites, landing pages, dashboards</option>
            <option value="Brand" ${explicitCat === 'Brand' ? 'selected' : ''}>Brand — logos, identity kits, flyers, social graphics</option>
            <option value="Print" ${explicitCat === 'Print' ? 'selected' : ''}>Print — business cards, banners, bags, merch</option>
          </select>
          <small style="display:block;margin-top:4px;font-size:11px;color:var(--akay-text-mute);">
            This controls which filter the project appears under on the public Projects page.
            It's separate from "Show in section" above (which controls where on the site it appears).
          </small>
        </label>
        <label class="dash-field" style="flex-direction:row;align-items:center;gap:10px;">
          <input type="checkbox" id="pf-showInShowcase" ${p.showInShowcase !== false ? 'checked' : ''} style="width:auto;" />
          <span style="font-size:13px;">Also show in Recent Web Work auto-scroll showcase</span>
        </label>
        <label class="dash-field">
          <span>Category tag (display label)</span>
          <input type="text" id="pf-category" value="${escapeAttr(p.category && !['Web','Brand','Print'].includes(p.category) ? p.category : '')}" placeholder="e.g. Corporate, E-commerce, SaaS (optional — overrides the filter label on cards)" />
        </label>
        <label class="dash-field">
          <span>Description</span>
          <input type="text" id="pf-description" value="${escapeAttr(p.description)}" placeholder="e.g. Web design · UI/UX" />
        </label>
        <label class="dash-field">
          <span>Live URL (optional)</span>
          <input type="url" id="pf-liveurl" value="${escapeAttr(p.liveUrl)}" placeholder="https://example.com" />
        </label>
        <label class="dash-field">
          <span>Image URL *</span>
          <input type="text" id="pf-imageurl" value="${escapeAttr(p.imageUrl)}" placeholder="https://res.cloudinary.com/..." />
        </label>
        <div class="dash-project-form__upload">
          <button type="button" class="dash-btn dash-btn--primary" id="pf-upload-btn">Upload Image</button>
          <span style="font-size:12px;color:var(--akay-text-mute);">or paste a URL above</span>
        </div>
        <div id="pf-preview" style="margin-top:8px;">
          ${p.imageUrl ? `<img src="${escapeAttr(p.imageUrl)}" style="width:100%;border-radius:8px;border:1px solid var(--akay-border);" onerror="this.style.display='none';" />` : ''}
        </div>
        <button type="submit" class="dash-btn dash-btn--primary dash-btn--block" style="margin-top:16px;position:sticky;bottom:0;">${isEdit ? 'Save Changes' : 'Add Project'}</button>
        <p class="dash-form__err" id="pf-err"></p>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#pfClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Auto-sync the category dropdown when the section changes — saves the
  // admin a step on new projects. (They can still override afterwards.)
  modal.querySelector('#pf-section').addEventListener('change', e => {
    const inferred = inferCatFromSection(e.target.value);
    modal.querySelector('#pf-category-select').value = inferred;
  });

  // Upload button
  modal.querySelector('#pf-upload-btn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) { input.remove(); return; }
      if (file.size > 10 * 1024 * 1024) { toast('Max 10MB', 'error'); input.remove(); return; }
      toast('Uploading…', 'info');
      try {
        const url = await uploadToCloudinary(file);
        modal.querySelector('#pf-imageurl').value = url;
        modal.querySelector('#pf-preview').innerHTML = `<img src="${url}" style="width:100%;border-radius:8px;border:1px solid var(--akay-border);" />`;
        toast('Image uploaded', 'success');
      } catch (e) {
        toast('Upload failed: ' + e.message, 'error');
      } finally {
        input.remove();
      }
    });
    input.click();
  });

  // Live preview on URL change
  modal.querySelector('#pf-imageurl').addEventListener('input', e => {
    const url = e.target.value.trim();
    modal.querySelector('#pf-preview').innerHTML = url
      ? `<img src="${escapeAttr(url)}" style="width:100%;border-radius:8px;border:1px solid var(--akay-border);" />`
      : '';
  });

  // Submit
  modal.querySelector('#projectForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = modal.querySelector('#pf-title').value.trim();
    const section = modal.querySelector('#pf-section').value;
    const categoryFilter = modal.querySelector('#pf-category-select').value; // Web / Brand / Print
    const categoryLabel = modal.querySelector('#pf-category').value.trim();  // optional display label
    const showInShowcase = modal.querySelector('#pf-showInShowcase').checked;
    const description = modal.querySelector('#pf-description').value.trim();
    const liveUrl = modal.querySelector('#pf-liveurl').value.trim();
    const imageUrl = modal.querySelector('#pf-imageurl').value.trim();
    const errEl = modal.querySelector('#pf-err');

    if (!title) { errEl.textContent = 'Title is required'; return; }
    if (!imageUrl) {
      errEl.textContent = 'Image is required — click "Upload Image" or paste a full URL starting with https://';
      return;
    }
    // Validate image URL is a full URL (must start with http:// or https://)
    if (!/^https?:\/\//.test(imageUrl)) {
      errEl.textContent = 'Image URL must start with https:// — looks like you have a partial URL. Click "Upload Image" to get a proper Cloudinary URL.';
      return;
    }

    errEl.textContent = '';

    // The explicit category filter (Web/Brand/Print) is always saved as
    // `project.category`. If the admin also typed a display label, we
    // store it under `project.categoryLabel` so the public page can show
    // a richer label (e.g. "Corporate · E-commerce") while still using
    // the clean Web/Brand/Print value for filtering.
    const category = categoryFilter;
    const categoryLabelFinal = categoryLabel || '';

    if (isEdit) {
      const updated = state.projects.map(p =>
        p.id === project.id
          ? { ...p, title, section, showInShowcase, category, categoryLabel: categoryLabelFinal, description, liveUrl, imageUrl }
          : p
      );
      const ok = await saveProjects(updated);
      if (ok) { toast('Project updated', 'success'); modal.remove(); }
    } else {
      const newItem = {
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title, section: section || 'web-showcase', showInShowcase, category, categoryLabel: categoryLabelFinal, description, liveUrl, imageUrl,
        order: state.projects.length
      };
      const updated = [...state.projects, newItem];
      const ok = await saveProjects(updated);
      if (ok) { toast('Project added', 'success'); modal.remove(); }
    }
  });
}

async function deleteProject(project) {
  if (!confirm(`Delete "${project.title}"?\n\nThis removes it from the site immediately.`)) return;
  const updated = state.projects.filter(p => p.id !== project.id);
  // Re-index order
  updated.forEach((p, i) => p.order = i);
  const ok = await saveProjects(updated);
  if (ok) toast('Project deleted', 'info');
}

async function moveProject(id, direction) {
  const sorted = [...state.projects].sort((a, b) => (a.order || 0) - (b.order || 0));
  const index = sorted.findIndex(p => p.id === id);
  if (index < 0) return;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= sorted.length) return;

  // Swap
  [sorted[index], sorted[newIndex]] = [sorted[newIndex], sorted[index]];
  // Re-index
  sorted.forEach((p, i) => p.order = i);

  await saveProjects(sorted);
}

async function seedDefaultProjects() {
  // Use a custom confirm instead of window.confirm (more reliable on mobile)
  const ok = await new Promise(resolve => {
    showConfirm('Add your 8 real projects to the showcase, with live homepage screenshots? You can edit or delete them afterwards.', resolve);
  });
  if (!ok) return;

  toast('Adding real projects…', 'info');
  console.log('[projects] seeding real defaults...');

  const newProjects = PROJECTS_DEFAULTS.map((p, i) => ({
    id: `proj-seed-${Date.now()}-${i}`,
    title: p.title,
    section: 'web-showcase',
    category: p.category,
    description: p.description,
    // Live homepage screenshot of the real site (WordPress mshots, free, no API key)
    imageUrl: p.liveUrl ? `https://s0.wp.com/mshots/v1/${encodeURIComponent(p.liveUrl)}?w=1200&h=900` : '',
    liveUrl: p.liveUrl || '',
    order: state.projects.length + i
  }));
  const updated = [...state.projects, ...newProjects];
  console.log('[projects] saving', updated.length, 'projects to Firestore');
  const saveOk = await saveProjects(updated);
  if (saveOk) {
    toast(`✓ ${newProjects.length} real projects added`, 'success');
    console.log('[projects] seed successful');
  } else {
    console.error('[projects] seed failed');
  }
}

// Seed the 8 existing hardcoded web-portfolio projects into Firestore
// so they become editable from the admin dashboard.
async function seedWebPortfolioDefaults() {
  const ok = await new Promise(resolve => {
    showConfirm('Make your 8 existing "Websites I\'ve Built" projects editable from the dashboard? This copies them into Firestore so you can edit, delete, and reorder them. The original hardcoded cards will be replaced by the editable versions.', resolve);
  });
  if (!ok) return;

  toast('Making web projects editable…', 'info');

  const newProjects = PROJECTS_DEFAULTS.map((p, i) => ({
    id: `proj-wp-${Date.now()}-${i}`,
    title: p.title,
    section: 'web-portfolio',
    category: p.category,
    description: p.description,
    imageUrl: p.liveUrl ? `https://s0.wp.com/mshots/v1/${encodeURIComponent(p.liveUrl)}?w=1200&h=900` : '',
    liveUrl: p.liveUrl || '',
    order: i
  }));

  // Remove any existing web-portfolio projects, then add the new ones
  const others = state.projects.filter(p => p.section !== 'web-portfolio');
  const updated = [...others, ...newProjects];

  const saveOk = await saveProjects(updated);
  if (saveOk) {
    toast(`✓ ${newProjects.length} web projects are now editable`, 'success');
  }
}

// Seed design (branding) projects — these show in the Design filter
async function seedDesignProjects() {
  const ok = await new Promise(resolve => {
    showConfirm('Add 6 design/branding projects to the Projects page? These will show under the "Brand" filter. You can edit or delete them afterwards.', resolve);
  });
  if (!ok) return;

  toast('Adding design projects…', 'info');
  const newProjects = DESIGN_PROJECTS_DEFAULTS.map((p, i) => ({
    id: `proj-design-${Date.now()}-${i}`,
    title: p.title,
    section: 'design-services',
    category: p.category,
    description: p.description,
    imageUrl: p.imageUrl,
    liveUrl: '',
    order: state.projects.filter(pr => pr.section === 'design-services').length + i
  }));
  const others = state.projects.filter(p => p.section !== 'design-services');
  const updated = [...others, ...newProjects];
  const saveOk = await saveProjects(updated);
  if (saveOk) toast(`✓ ${newProjects.length} design projects added`, 'success');
}

// Seed print projects — these show in the Print filter
async function seedPrintProjects() {
  const ok = await new Promise(resolve => {
    showConfirm('Add 5 print projects to the Projects page? These will show under the "Print" filter. You can edit or delete them afterwards.', resolve);
  });
  if (!ok) return;

  toast('Adding print projects…', 'info');
  const newProjects = PRINT_PROJECTS_DEFAULTS.map((p, i) => ({
    id: `proj-print-${Date.now()}-${i}`,
    title: p.title,
    section: 'print-services',
    category: p.category,
    description: p.description,
    imageUrl: p.imageUrl,
    liveUrl: '',
    order: state.projects.filter(pr => pr.section === 'print-services').length + i
  }));
  const others = state.projects.filter(p => p.section !== 'print-services');
  const updated = [...others, ...newProjects];
  const saveOk = await saveProjects(updated);
  if (saveOk) toast(`✓ ${newProjects.length} print projects added`, 'success');
}

// Custom confirm dialog (more reliable on mobile than window.confirm)
function showConfirm(message, callback) {
  let modal = $('#akayConfirmModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'akayConfirmModal';
  modal.className = 'akay-modal is-open';
  modal.innerHTML = `
    <div class="akay-modal__panel" style="max-width:380px;text-align:center;">
      <p style="font:500 14px/1.5 'Poppins',sans-serif;color:#fff;margin:0 0 20px;">${message}</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button class="dash-btn dash-btn--ghost" id="cfCancel">Cancel</button>
        <button class="dash-btn dash-btn--primary" id="cfOk">Yes, continue</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const done = (result) => {
    modal.remove();
    callback(result);
  };

  modal.querySelector('#cfCancel').addEventListener('click', () => done(false));
  modal.querySelector('#cfOk').addEventListener('click', () => done(true));
  modal.addEventListener('click', e => { if (e.target === modal) done(false); });
}

async function saveProjects(arr) {
  console.log('[projects] saveProjects called with', arr.length, 'items');
  try {
    console.log('[projects] calling setDoc...');
    await setDoc(doc(db, 'content', 'projects'),
      { items: arr, _updatedAt: serverTimestamp() },
      { merge: true });
    console.log('[projects] setDoc succeeded');
    toast(`✓ Projects saved (${arr.length})`, 'success');
    return true;
  } catch (e) {
    console.error('[projects] saveProjects FAILED:', e);
    if (e.code === 'permission-denied' || /permission|denied|rules/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules rejected the write. See Settings tab.', 'error');
      state.rulesOk = false;
      renderRulesStatus();
    } else if (/offline|network|timed out|unreachable/i.test(e.message)) {
      toast('NETWORK — cannot reach Firestore. Try again.', 'error');
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
    return false;
  }
}

// =====================================================================
//  STEP 11.6 — CASE STUDIES CRUD (project-detail pages)
//  ---------------------------------------------------------------------
//  Static defaults live in site-config.js PROJECT_CASE_STUDIES (the 3
//  featured projects). Admin-curated case studies live in Firestore
//  `content/case-studies` as an array of items. The public
//  project-detail.html page merges both, with Firestore overriding the
//  static entries by slug (so admin edits win).
// =====================================================================

// Merge static PROJECT_CASE_STUDIES with Firestore state.caseStudies.
// Static entries come first (in their declared order); Firestore entries
// override any static entry with the same slug, and new slugs are appended.
function buildMergedListCaseStudies() {
  const list = [];
  const bySlug = new Map();

  PROJECT_CASE_STUDIES.forEach(cs => {
    if (!cs || !cs.slug) return;
    bySlug.set(cs.slug, cs);
  });

  (state.caseStudies || []).forEach(cs => {
    if (!cs || !cs.slug) return;
    bySlug.set(cs.slug, cs);
  });

  const seen = new Set();
  PROJECT_CASE_STUDIES.forEach(cs => {
    if (!cs || !cs.slug) return;
    if (bySlug.has(cs.slug)) { list.push(bySlug.get(cs.slug)); seen.add(cs.slug); }
  });
  (state.caseStudies || []).forEach(cs => {
    if (!cs || !cs.slug) return;
    if (seen.has(cs.slug)) return;
    list.push(bySlug.get(cs.slug));
    seen.add(cs.slug);
  });

  return list.sort((a, b) => (a.order || 0) - (b.order || 0));
}

function renderCaseStudies() {
  const list = $('#caseStudiesList');
  if (!list) return;
  const merged = buildMergedListCaseStudies();

  if (!merged.length) {
    list.innerHTML = `
      <div class="dash-card dash-card--empty">
        <div class="dash-card__body">
          <p>No case studies yet.</p>
          <p style="margin-top:6px;font-size:12px;">Click <strong>+ Add New Case Study</strong> to create one.</p>
        </div>
      </div>`;
    return;
  }

  list.innerHTML = merged.map((cs, i) => {
    const isStatic = PROJECT_CASE_STUDIES.some(s => s.slug === cs.slug) && !(state.caseStudies || []).some(s => s.slug === cs.slug);
    const originTag = isStatic
      ? '<span class="dash-project-card__section" style="color:#8a8a8a;background:rgba(255,255,255,0.04);border-color:var(--akay-border);">Static default</span>'
      : '<span class="dash-project-card__section">Firestore</span>';
    const tools = Array.isArray(cs.tools) ? cs.tools : (Array.isArray(cs.tech) ? cs.tech : []);
    const screenshots = Array.isArray(cs.screenshots) ? cs.screenshots : [];
    const cover = cs.coverImage || cs.cover || '';
    return `
      <div class="dash-project-card" data-slug="${escapeAttr(cs.slug)}" style="grid-template-columns:160px 1fr;">
        <div class="dash-project-card__preview">
          ${cover ? `<img src="${escapeAttr(cover)}" alt="${escapeAttr(cs.title)}" loading="lazy" />` : '<span class="dash-project-card__noimg">No cover</span>'}
        </div>
        <div class="dash-project-card__body">
          <div class="dash-project-card__head">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="dash-project-card__order">#${i + 1}</span>
              <span class="dash-project-card__tag">${escapeHtml(cs.category || '')}</span>
              <span class="dash-project-card__tag" style="color:${(cs.status||'').toLowerCase()==='delivered'?'#8a8a8a':'#2ecc71'};background:${(cs.status||'').toLowerCase()==='delivered'?'rgba(255,255,255,0.04)':'rgba(46,204,113,0.1)'};border:1px solid ${(cs.status||'').toLowerCase()==='delivered'?'var(--akay-border)':'rgba(46,204,113,0.25)'};">${escapeHtml(cs.status || 'Active')}</span>
              ${originTag}
            </div>
            <div class="dash-project-card__btns">
              <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="edit">Edit</button>
              <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="delete" ${isStatic ? 'disabled title="Static defaults can be overridden by editing — but not deleted from here."' : ''}>Delete</button>
            </div>
          </div>
          <h4 class="dash-project-card__title">${escapeHtml(cs.title || 'Untitled')}</h4>
          <p class="dash-project-card__desc" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml((cs.challenge || '').slice(0, 240))}${(cs.challenge || '').length > 240 ? '…' : ''}</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--akay-text-mute);margin-top:4px;">
            <span>🛠 ${tools.length} tool${tools.length === 1 ? '' : 's'}</span>
            <span>🖼 ${screenshots.length} screenshot${screenshots.length === 1 ? '' : 's'}</span>
            ${cs.liveUrl ? `<a href="${escapeAttr(cs.liveUrl)}" target="_blank" class="dash-project-card__url">${escapeHtml(cs.liveUrl)}</a>` : '<span style="color:var(--akay-text-dim);">No live URL</span>'}
          </div>
        </div>
      </div>`;
  }).join('');

  // Wire buttons
  list.querySelectorAll('.dash-project-card').forEach(card => {
    const slug = card.getAttribute('data-slug');
    card.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-act');
        const cs = merged.find(c => c.slug === slug);
        if (!cs) return;
        if (act === 'edit') showCaseStudyForm(cs);
        if (act === 'delete') deleteCaseStudy(cs);
      });
    });
  });
}

function showCaseStudyForm(cs) {
  const isEdit = !!cs;
  const base = cs || {
    slug: '', title: '', category: '', status: 'Active', coverImage: '',
    challenge: '', solution: '', tools: [], screenshots: [],
    liveUrl: '', order: (state.caseStudies || []).length
  };

  let modal = $('#caseStudyFormModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'caseStudyFormModal';
  modal.className = 'akay-modal is-open';
  modal.innerHTML = `
    <div class="akay-modal__panel dash-project-form-modal" style="max-width:560px;">
      <button class="akay-modal__close" type="button" id="csClose">×</button>
      <h2 class="akay-modal__title">${isEdit ? 'Edit Case Study' : 'Add New Case Study'}</h2>
      <form id="caseStudyForm" class="dash-form">
        <label class="dash-field">
          <span>Title *</span>
          <input type="text" id="cs-title" required value="${escapeAttr(base.title)}" placeholder="e.g. Scottish Essentials Beauty & Spa" />
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <label class="dash-field">
            <span>Slug * (URL key)</span>
            <input type="text" id="cs-slug" required value="${escapeAttr(base.slug)}" placeholder="scottish-essentials" ${isEdit ? 'readonly' : ''} />
          </label>
          <label class="dash-field">
            <span>Status</span>
            <select id="cs-status">
              <option value="Active" ${(base.status || 'Active') === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Delivered" ${base.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            </select>
          </label>
        </div>
        <label class="dash-field">
          <span>Category</span>
          <input type="text" id="cs-category" value="${escapeAttr(base.category)}" placeholder="e.g. Web · Spa Brand" />
        </label>
        <label class="dash-field">
          <span>Cover image URL *</span>
          <input type="text" id="cs-coverimage" value="${escapeAttr(base.coverImage)}" placeholder="https://..." />
        </label>
        <div class="dash-project-form__upload">
          <button type="button" class="dash-btn dash-btn--primary" id="cs-upload-btn">Upload Cover Image</button>
          <span style="font-size:12px;color:var(--akay-text-mute);">or paste a URL above</span>
        </div>
        <div id="cs-preview" style="margin-top:8px;">
          ${base.coverImage ? `<img src="${escapeAttr(base.coverImage)}" style="width:100%;border-radius:8px;border:1px solid var(--akay-border);" onerror="this.style.display='none';" />` : ''}
        </div>
        <label class="dash-field">
          <span>Challenge (paragraph) *</span>
          <textarea id="cs-challenge" rows="4" required placeholder="What problem was the client facing?">${escapeHtml(base.challenge || '')}</textarea>
        </label>
        <label class="dash-field">
          <span>Solution (paragraph) *</span>
          <textarea id="cs-solution" rows="4" required placeholder="What did you build? How does it work?">${escapeHtml(base.solution || '')}</textarea>
        </label>
        <label class="dash-field">
          <span>Tools &amp; tech (comma-separated)</span>
          <input type="text" id="cs-tools" value="${escapeAttr((Array.isArray(base.tools) ? base.tools : []).join(', '))}" placeholder="HTML5, CSS3, JavaScript, Firebase" />
        </label>
        <label class="dash-field">
          <span>Screenshots (one URL per line)</span>
          <textarea id="cs-screenshots" rows="3" placeholder="https://...&#10;https://...">${escapeHtml((Array.isArray(base.screenshots) ? base.screenshots : []).join('\n'))}</textarea>
        </label>
        <label class="dash-field">
          <span>Live URL (optional)</span>
          <input type="url" id="cs-liveurl" value="${escapeAttr(base.liveUrl)}" placeholder="https://example.com" />
        </label>
        <button type="submit" class="dash-btn dash-btn--primary dash-btn--block" style="margin-top:16px;">${isEdit ? 'Save Changes' : 'Add Case Study'}</button>
        <p class="dash-form__err" id="cs-err"></p>
      </form>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('#csClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Auto-slug from title (only on create, not edit)
  if (!isEdit) {
    modal.querySelector('#cs-title').addEventListener('input', e => {
      const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      modal.querySelector('#cs-slug').value = slug;
    });
  }

  // Upload button
  modal.querySelector('#cs-upload-btn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) { input.remove(); return; }
      if (file.size > 10 * 1024 * 1024) { toast('Max 10MB', 'error'); input.remove(); return; }
      toast('Uploading…', 'info');
      try {
        const url = await uploadToCloudinary(file);
        modal.querySelector('#cs-coverimage').value = url;
        modal.querySelector('#cs-preview').innerHTML = `<img src="${url}" style="width:100%;border-radius:8px;border:1px solid var(--akay-border);" />`;
        toast('Image uploaded', 'success');
      } catch (e) {
        toast('Upload failed: ' + e.message, 'error');
      } finally {
        input.remove();
      }
    });
    input.click();
  });

  // Live preview on URL change
  modal.querySelector('#cs-coverimage').addEventListener('input', e => {
    const url = e.target.value.trim();
    modal.querySelector('#cs-preview').innerHTML = url
      ? `<img src="${escapeAttr(url)}" style="width:100%;border-radius:8px;border:1px solid var(--akay-border);" />`
      : '';
  });

  // Submit
  modal.querySelector('#caseStudyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = modal.querySelector('#cs-title').value.trim();
    const slug = modal.querySelector('#cs-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const status = modal.querySelector('#cs-status').value;
    const category = modal.querySelector('#cs-category').value.trim();
    const coverImage = modal.querySelector('#cs-coverimage').value.trim();
    const challenge = modal.querySelector('#cs-challenge').value.trim();
    const solution = modal.querySelector('#cs-solution').value.trim();
    const tools = modal.querySelector('#cs-tools').value.split(',').map(s => s.trim()).filter(Boolean);
    const screenshots = modal.querySelector('#cs-screenshots').value.split('\n').map(s => s.trim()).filter(Boolean);
    const liveUrl = modal.querySelector('#cs-liveurl').value.trim();
    const errEl = modal.querySelector('#cs-err');

    if (!title) { errEl.textContent = 'Title is required'; return; }
    if (!slug) { errEl.textContent = 'Slug is required'; return; }
    if (!coverImage) { errEl.textContent = 'Cover image URL is required'; return; }
    if (!/^https?:\/\//.test(coverImage)) { errEl.textContent = 'Cover image URL must start with https://'; return; }
    if (!challenge) { errEl.textContent = 'Challenge paragraph is required'; return; }
    if (!solution) { errEl.textContent = 'Solution paragraph is required'; return; }

    errEl.textContent = '';

    // Build the new item
    const item = {
      slug, title, category, status, coverImage,
      challenge, solution, tools, screenshots, liveUrl,
      order: isEdit ? (base.order || 0) : (state.caseStudies || []).length
    };

    let updated;
    if (isEdit) {
      // If we're editing a static default, push it as a Firestore override
      const existing = (state.caseStudies || []).findIndex(c => c.slug === slug);
      if (existing >= 0) {
        updated = [...state.caseStudies];
        updated[existing] = item;
      } else {
        // Editing a static default — create a Firestore override
        updated = [...(state.caseStudies || []), item];
      }
    } else {
      // New — check slug uniqueness against both static and Firestore
      const allSlugs = new Set([
        ...PROJECT_CASE_STUDIES.map(c => c.slug),
        ...(state.caseStudies || []).map(c => c.slug)
      ]);
      if (allSlugs.has(slug)) {
        errEl.textContent = `Slug "${slug}" already exists. Choose a different slug.`;
        return;
      }
      updated = [...(state.caseStudies || []), item];
    }

    const ok = await saveCaseStudies(updated);
    if (ok) { toast(isEdit ? 'Case study updated' : 'Case study added', 'success'); modal.remove(); }
  });
}

async function deleteCaseStudy(cs) {
  if (!cs || !cs.slug) return;
  const ok = await new Promise(resolve => {
    showConfirm(`Delete case study "${cs.title}"?\n\nThis removes it from /project-detail.html immediately. Static defaults can be re-added by editing site-config.js.`, resolve);
  });
  if (!ok) return;
  const updated = (state.caseStudies || []).filter(c => c.slug !== cs.slug);
  const saveOk = await saveCaseStudies(updated);
  if (saveOk) toast('Case study deleted', 'info');
}

async function saveCaseStudies(arr) {
  try {
    await setDoc(doc(db, 'content', 'case-studies'),
      { items: arr, _updatedAt: serverTimestamp() },
      { merge: true });
    toast(`✓ Case studies saved (${arr.length})`, 'success');
    return true;
  } catch (e) {
    console.error('[case-studies] save failed:', e);
    if (e.code === 'permission-denied' || /permission|denied|rules/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules rejected the write. See Settings tab.', 'error');
      state.rulesOk = false;
      renderRulesStatus();
    } else if (/offline|network|timed out|unreachable/i.test(e.message)) {
      toast('NETWORK — cannot reach Firestore. Try again.', 'error');
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
    return false;
  }
}

// =====================================================================
//  STEP 11.7 — BLOG POSTS CRUD
//  ---------------------------------------------------------------------
//  Static defaults live in site-config.js BLOG_POSTS (3 posts). Admin-
//  curated posts live in Firestore `content/blog-posts`. The public
//  blog.html + blog-post.html pages merge both, with Firestore overriding
//  static posts by slug.
// =====================================================================

function buildMergedListBlogPosts() {
  const list = [];
  const bySlug = new Map();

  BLOG_POSTS.forEach(p => { if (p && p.slug) bySlug.set(p.slug, p); });
  (state.blogPosts || []).forEach(p => { if (p && p.slug) bySlug.set(p.slug, p); });

  const seen = new Set();
  BLOG_POSTS.forEach(p => {
    if (!p || !p.slug) return;
    if (bySlug.has(p.slug)) { list.push(bySlug.get(p.slug)); seen.add(p.slug); }
  });
  (state.blogPosts || []).forEach(p => {
    if (!p || !p.slug) return;
    if (seen.has(p.slug)) return;
    list.push(bySlug.get(p.slug));
    seen.add(p.slug);
  });

  return list;
}

function renderBlogPosts() {
  const list = $('#blogPostsList');
  if (!list) return;
  const merged = buildMergedListBlogPosts();

  if (!merged.length) {
    list.innerHTML = `
      <div class="dash-card dash-card--empty">
        <div class="dash-card__body">
          <p>No blog posts yet.</p>
          <p style="margin-top:6px;font-size:12px;">Click <strong>+ Add New Post</strong> to create one.</p>
        </div>
      </div>`;
    return;
  }

  list.innerHTML = merged.map((p, i) => {
    const isStatic = BLOG_POSTS.some(s => s.slug === p.slug) && !(state.blogPosts || []).some(s => s.slug === p.slug);
    const originTag = isStatic
      ? '<span class="dash-project-card__section" style="color:#8a8a8a;background:rgba(255,255,255,0.04);border-color:var(--akay-border);">Static default</span>'
      : '<span class="dash-project-card__section">Firestore</span>';
    const cover = p.coverImage || p.image || '';
    const tags = Array.isArray(p.tags) ? p.tags : [];
    return `
      <div class="dash-project-card" data-slug="${escapeAttr(p.slug)}" style="grid-template-columns:160px 1fr;">
        <div class="dash-project-card__preview">
          ${cover ? `<img src="${escapeAttr(cover)}" alt="${escapeAttr(p.title)}" loading="lazy" />` : '<span class="dash-project-card__noimg">No cover</span>'}
        </div>
        <div class="dash-project-card__body">
          <div class="dash-project-card__head">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="dash-project-card__order">#${i + 1}</span>
              <span class="dash-project-card__tag">${escapeHtml(p.category || '')}</span>
              <span class="dash-project-card__tag" style="color:#ffd54f;background:rgba(255,213,79,0.08);border:1px solid rgba(255,213,79,0.2);">${escapeHtml(p.date || '')}</span>
              ${originTag}
            </div>
            <div class="dash-project-card__btns">
              <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="edit">Edit</button>
              <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="delete" ${isStatic ? 'disabled title="Static defaults can be overridden by editing — but not deleted from here."' : ''}>Delete</button>
            </div>
          </div>
          <h4 class="dash-project-card__title">${escapeHtml(p.title || 'Untitled')}</h4>
          <p class="dash-project-card__desc" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml((p.excerpt || '').slice(0, 240))}${(p.excerpt || '').length > 240 ? '…' : ''}</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--akay-text-mute);margin-top:4px;">
            <span>✍ ${escapeHtml(p.author || 'Awwal Abdulhakeem')}</span>
            <span>🏷 ${tags.length} tag${tags.length === 1 ? '' : 's'}</span>
            <span>📄 ${((p.content || '').match(/<p>/g) || []).length} paragraph${((p.content || '').match(/<p>/g) || []).length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.dash-project-card').forEach(card => {
    const slug = card.getAttribute('data-slug');
    card.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-act');
        const post = merged.find(p => p.slug === slug);
        if (!post) return;
        if (act === 'edit') showBlogPostForm(post);
        if (act === 'delete') deleteBlogPost(post);
      });
    });
  });
}

function showBlogPostForm(post) {
  const isEdit = !!post;
  const base = post || {
    slug: '', title: '', excerpt: '', date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    author: 'Awwal Abdulhakeem', category: 'Web Design', coverImage: '',
    content: '<p>Write your article here. HTML is supported — use &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;a&gt; etc.</p>',
    tags: []
  };

  let modal = $('#blogPostFormModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'blogPostFormModal';
  modal.className = 'akay-modal is-open';
  modal.innerHTML = `
    <div class="akay-modal__panel dash-project-form-modal" style="max-width:680px;">
      <button class="akay-modal__close" type="button" id="bpClose">×</button>
      <h2 class="akay-modal__title">${isEdit ? 'Edit Blog Post' : 'Add New Blog Post'}</h2>
      <form id="blogPostForm" class="dash-form">
        <label class="dash-field">
          <span>Title *</span>
          <input type="text" id="bp-title" required value="${escapeAttr(base.title)}" placeholder="e.g. 5 Landing Page Mistakes That Kill Your Conversions" />
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <label class="dash-field">
            <span>Slug * (URL key)</span>
            <input type="text" id="bp-slug" required value="${escapeAttr(base.slug)}" placeholder="5-landing-page-mistakes" ${isEdit ? 'readonly' : ''} />
          </label>
          <label class="dash-field">
            <span>Category</span>
            <input type="text" id="bp-category" value="${escapeAttr(base.category)}" placeholder="Web Design" />
          </label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <label class="dash-field">
            <span>Date</span>
            <input type="text" id="bp-date" value="${escapeAttr(base.date)}" placeholder="Jun 2026" />
          </label>
          <label class="dash-field">
            <span>Author</span>
            <input type="text" id="bp-author" value="${escapeAttr(base.author)}" placeholder="Awwal Abdulhakeem" />
          </label>
        </div>
        <label class="dash-field">
          <span>Excerpt (1-2 sentence summary)</span>
          <textarea id="bp-excerpt" rows="2" placeholder="A short summary that appears on the blog grid.">${escapeHtml(base.excerpt || '')}</textarea>
        </label>
        <label class="dash-field">
          <span>Cover image URL</span>
          <input type="text" id="bp-coverimage" value="${escapeAttr(base.coverImage)}" placeholder="https://..." />
        </label>
        <div class="dash-project-form__upload">
          <button type="button" class="dash-btn dash-btn--primary" id="bp-upload-btn">Upload Cover Image</button>
          <span style="font-size:12px;color:var(--akay-text-mute);">or paste a URL above</span>
        </div>
        <div id="bp-preview" style="margin-top:8px;">
          ${base.coverImage ? `<img src="${escapeAttr(base.coverImage)}" style="width:100%;border-radius:8px;border:1px solid var(--akay-border);" onerror="this.style.display='none';" />` : ''}
        </div>
        <label class="dash-field">
          <span>Content (HTML)</span>
          <textarea id="bp-content" rows="12" style="font-family:'SFMono-Regular',Menlo,monospace;font-size:12px;line-height:1.5;" placeholder="<p>First paragraph...</p>&#10;<h2>Section heading</h2>&#10;<p>Body...</p>">${escapeHtml(base.content || '')}</textarea>
        </label>
        <label class="dash-field">
          <span>Tags (comma-separated)</span>
          <input type="text" id="bp-tags" value="${escapeAttr((Array.isArray(base.tags) ? base.tags : []).join(', '))}" placeholder="Web Design, Conversion, UX" />
        </label>
        <button type="submit" class="dash-btn dash-btn--primary dash-btn--block" style="margin-top:16px;">${isEdit ? 'Save Changes' : 'Add Post'}</button>
        <p class="dash-form__err" id="bp-err"></p>
      </form>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('#bpClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  if (!isEdit) {
    modal.querySelector('#bp-title').addEventListener('input', e => {
      const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      modal.querySelector('#bp-slug').value = slug;
    });
  }

  modal.querySelector('#bp-upload-btn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) { input.remove(); return; }
      if (file.size > 10 * 1024 * 1024) { toast('Max 10MB', 'error'); input.remove(); return; }
      toast('Uploading…', 'info');
      try {
        const url = await uploadToCloudinary(file);
        modal.querySelector('#bp-coverimage').value = url;
        modal.querySelector('#bp-preview').innerHTML = `<img src="${url}" style="width:100%;border-radius:8px;border:1px solid var(--akay-border);" />`;
        toast('Image uploaded', 'success');
      } catch (e) {
        toast('Upload failed: ' + e.message, 'error');
      } finally {
        input.remove();
      }
    });
    input.click();
  });

  modal.querySelector('#bp-coverimage').addEventListener('input', e => {
    const url = e.target.value.trim();
    modal.querySelector('#bp-preview').innerHTML = url
      ? `<img src="${escapeAttr(url)}" style="width:100%;border-radius:8px;border:1px solid var(--akay-border);" />`
      : '';
  });

  modal.querySelector('#blogPostForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = modal.querySelector('#bp-title').value.trim();
    const slug = modal.querySelector('#bp-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const category = modal.querySelector('#bp-category').value.trim();
    const date = modal.querySelector('#bp-date').value.trim();
    const author = modal.querySelector('#bp-author').value.trim();
    const excerpt = modal.querySelector('#bp-excerpt').value.trim();
    const coverImage = modal.querySelector('#bp-coverimage').value.trim();
    const content = modal.querySelector('#bp-content').value;
    const tags = modal.querySelector('#bp-tags').value.split(',').map(s => s.trim()).filter(Boolean);
    const errEl = modal.querySelector('#bp-err');

    if (!title) { errEl.textContent = 'Title is required'; return; }
    if (!slug) { errEl.textContent = 'Slug is required'; return; }
    if (!content.trim()) { errEl.textContent = 'Content is required'; return; }

    errEl.textContent = '';

    const item = {
      slug, title, category, date, author, excerpt, coverImage, content, tags
    };

    let updated;
    if (isEdit) {
      const existing = (state.blogPosts || []).findIndex(p => p.slug === slug);
      if (existing >= 0) {
        updated = [...state.blogPosts];
        updated[existing] = item;
      } else {
        updated = [...(state.blogPosts || []), item];
      }
    } else {
      const allSlugs = new Set([
        ...BLOG_POSTS.map(p => p.slug),
        ...(state.blogPosts || []).map(p => p.slug)
      ]);
      if (allSlugs.has(slug)) {
        errEl.textContent = `Slug "${slug}" already exists. Choose a different slug.`;
        return;
      }
      updated = [...(state.blogPosts || []), item];
    }

    const ok = await saveBlogPosts(updated);
    if (ok) { toast(isEdit ? 'Post updated' : 'Post added', 'success'); modal.remove(); }
  });
}

async function deleteBlogPost(post) {
  if (!post || !post.slug) return;
  const ok = await new Promise(resolve => {
    showConfirm(`Delete blog post "${post.title}"?\n\nThis removes it from /blog-post.html immediately.`, resolve);
  });
  if (!ok) return;
  const updated = (state.blogPosts || []).filter(p => p.slug !== post.slug);
  const saveOk = await saveBlogPosts(updated);
  if (saveOk) toast('Blog post deleted', 'info');
}

async function saveBlogPosts(arr) {
  try {
    await setDoc(doc(db, 'content', 'blog-posts'),
      { items: arr, _updatedAt: serverTimestamp() },
      { merge: true });
    toast(`✓ Blog posts saved (${arr.length})`, 'success');
    return true;
  } catch (e) {
    console.error('[blog-posts] save failed:', e);
    if (e.code === 'permission-denied' || /permission|denied|rules/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules rejected the write. See Settings tab.', 'error');
      state.rulesOk = false;
      renderRulesStatus();
    } else if (/offline|network|timed out|unreachable/i.test(e.message)) {
      toast('NETWORK — cannot reach Firestore. Try again.', 'error');
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
    return false;
  }
}

// =====================================================================
//  STEP 11.8 — DOWNLOADS editor
//  ---------------------------------------------------------------------
//  3 fixed slots: CV, Corporate Profile, Brand Deck. Static defaults
//  live in site-config.js DOWNLOADS. Admin uploads a PDF (or pastes a
//  URL) for each slot — saved to Firestore `content/downloads`.
// =====================================================================

function buildMergedListDownloads() {
  const byId = new Map();
  DOWNLOADS.forEach(d => { if (d && d.id) byId.set(d.id, d); });
  (state.downloads || []).forEach(d => { if (d && d.id) byId.set(d.id, d); });

  const list = [];
  const seen = new Set();
  DOWNLOADS.forEach(d => {
    if (!d || !d.id) return;
    if (byId.has(d.id)) { list.push(byId.get(d.id)); seen.add(d.id); }
  });
  (state.downloads || []).forEach(d => {
    if (!d || !d.id) return;
    if (seen.has(d.id)) return;
    list.push(byId.get(d.id));
    seen.add(d.id);
  });
  return list;
}

function renderDownloadsEditor() {
  const wrap = $('#downloadsList');
  if (!wrap) return;
  const merged = buildMergedListDownloads();

  if (!merged.length) {
    wrap.innerHTML = '<p class="dash-panel__hint">No download slots configured.</p>';
    return;
  }

  wrap.innerHTML = merged.map(d => {
    const isStatic = DOWNLOADS.some(s => s.id === d.id) && !(state.downloads || []).some(s => s.id === d.id);
    const available = d.available !== false && !!d.fileUrl;
    const fileExt = (d.fileUrl || '').split('.').pop().toUpperCase();
    const format = fileExt && fileExt.length <= 5 ? fileExt : (available ? 'FILE' : '—');
    return `
      <div class="dash-download-card" data-id="${escapeAttr(d.id)}">
        <div class="dash-download-card__head">
          <div>
            <h4 class="dash-download-card__title">${escapeHtml(d.name || '')}</h4>
            <span class="dash-download-card__id">id: ${escapeHtml(d.id || '')} · ${format} · ${available ? '<span style="color:#2ecc71;">Available</span>' : '<span style="color:var(--akay-text-dim);">Coming soon</span>'}</span>
          </div>
          <span class="dash-project-card__section" style="${isStatic ? 'color:#8a8a8a;background:rgba(255,255,255,0.04);border-color:var(--akay-border);' : ''}">${isStatic ? 'Static default' : 'Firestore'}</span>
        </div>
        <label class="dash-field">
          <span>Display name</span>
          <input type="text" data-field="name" value="${escapeAttr(d.name || '')}" />
        </label>
        <label class="dash-field">
          <span>Description</span>
          <textarea data-field="description" rows="2">${escapeHtml(d.description || '')}</textarea>
        </label>
        <label class="dash-field">
          <span>File URL (paste a direct link to the PDF)</span>
          <input type="text" data-field="fileUrl" value="${escapeAttr(d.fileUrl || '')}" placeholder="https://res.cloudinary.com/.../akay-cv.pdf" />
        </label>
        <div class="dash-project-form__upload">
          <button type="button" class="dash-btn dash-btn--primary" data-act="upload">Upload PDF</button>
          <span style="font-size:12px;color:var(--akay-text-mute);">or paste a URL above</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">
          <label class="dash-field" style="flex:0 0 auto;display:flex;align-items:center;gap:8px;flex-direction:row;">
            <input type="checkbox" data-field="available" ${available ? 'checked' : ''} />
            <span style="text-transform:none;letter-spacing:0;font-size:12px;color:var(--akay-text-mute);">Available for download</span>
          </label>
          <button type="button" class="dash-btn dash-btn--primary dash-btn--mini" data-act="save" style="margin-left:auto;">Save</button>
        </div>
      </div>`;
  }).join('');

  // Wire buttons + upload handlers
  wrap.querySelectorAll('.dash-download-card').forEach(card => {
    const id = card.getAttribute('data-id');

    card.querySelector('[data-act="save"]').addEventListener('click', () => {
      const name = card.querySelector('[data-field="name"]').value.trim();
      const description = card.querySelector('[data-field="description"]').value.trim();
      const fileUrl = card.querySelector('[data-field="fileUrl"]').value.trim();
      const available = card.querySelector('[data-field="available"]').checked;
      saveDownloadSlot({ id, name, description, fileUrl, available });
    });

    card.querySelector('[data-act="upload"]').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) { input.remove(); return; }
        if (file.size > 10 * 1024 * 1024) { toast('Max 10MB', 'error'); input.remove(); return; }
        toast('Uploading…', 'info');
        try {
          const url = await uploadToCloudinary(file);
          card.querySelector('[data-field="fileUrl"]').value = url;
          card.querySelector('[data-field="available"]').checked = true;
          toast('File uploaded — click Save to apply', 'success');
        } catch (e) {
          toast('Upload failed: ' + e.message, 'error');
        } finally {
          input.remove();
        }
      });
      input.click();
    });
  });
}

async function saveDownloadSlot(item) {
  // Merge with the existing list (override by id)
  const others = (state.downloads || []).filter(d => d.id !== item.id);
  const updated = [...others, item];
  try {
    await setDoc(doc(db, 'content', 'downloads'),
      { items: updated, _updatedAt: serverTimestamp() },
      { merge: true });
    toast(`✓ "${item.name || item.id}" saved`, 'success');
    return true;
  } catch (e) {
    console.error('[downloads] save failed:', e);
    if (e.code === 'permission-denied' || /permission|denied|rules/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules rejected the write. See Settings tab.', 'error');
      state.rulesOk = false;
      renderRulesStatus();
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
    return false;
  }
}

// =====================================================================
//  STEP 11.9 — SITE CONTENT editor
//  ---------------------------------------------------------------------
//  Flat key/value overrides on top of SITE_CONTENT_DEFAULTS. Saved to
//  Firestore `content/site-content` as a flat object. The homepage
//  reads from the same doc at load time and overrides the static
//  defaults. The admin form groups fields by section for clarity.
// =====================================================================

// Define the editable fields, grouped by section. Each field knows its
// label, type (text/textarea/number), and help text.
const SITE_CONTENT_FIELDS = [
  {
    section: 'Homepage Hero',
    fields: [
      { key: 'heroBadge',     label: 'Hero badge text',      type: 'text',    help: 'Small pill above the H1 (e.g. "Available for Work")' },
      { key: 'heroName',      label: 'Hero name line',       type: 'text',    help: 'Greeting line under the badge' },
      { key: 'heroTitleLead', label: 'Hero title (lead)',    type: 'text',    help: 'The fixed part of the H1 before the rotating word' },
      { key: 'heroRotatingWords', label: 'Rotating words',   type: 'text',    help: 'Pipe-separated list of words that rotate in the H1' },
      { key: 'heroTagline',   label: 'Hero tagline',         type: 'textarea',help: 'Paragraph below the H1' }
    ]
  },
  {
    section: 'Stats',
    fields: [
      { key: 'statProjects',  label: 'Projects delivered',   type: 'number',  help: 'Number shown on the homepage stats bar' },
      { key: 'statClients',   label: 'Happy clients',        type: 'number',  help: 'Number shown on the homepage stats bar' },
      { key: 'statYears',     label: 'Years experience',     type: 'number',  help: 'Number shown on the homepage stats bar' },
      { key: 'statAwards',    label: 'Awards & features',    type: 'number',  help: 'Number shown on the homepage stats bar' }
    ]
  },
  {
    section: 'CTA Band',
    fields: [
      { key: 'ctaTitle',      label: 'CTA title',            type: 'text',    help: 'Heading on the bottom CTA band' },
      { key: 'ctaDesc',       label: 'CTA description',      type: 'textarea',help: 'Paragraph on the bottom CTA band' }
    ]
  }
];

function getSiteContentValue(key) {
  if (Object.prototype.hasOwnProperty.call(state.siteContent, key)) {
    return state.siteContent[key];
  }
  if (Object.prototype.hasOwnProperty.call(SITE_CONTENT_DEFAULTS, key)) {
    return SITE_CONTENT_DEFAULTS[key];
  }
  return '';
}

function renderSiteContentEditor() {
  const wrap = $('#siteContentForm');
  if (!wrap) return;

  wrap.innerHTML = SITE_CONTENT_FIELDS.map(group => `
    <div class="dash-section">
      <div class="dash-section__head">
        <div class="dash-section__bar"></div>
        <h4 class="dash-section__title">${escapeHtml(group.section)}</h4>
      </div>
      <div class="dash-sitecontent-grid">
        ${group.fields.map(f => {
          const val = getSiteContentValue(f.key);
          const isCustom = Object.prototype.hasOwnProperty.call(state.siteContent, f.key) && state.siteContent[f.key] !== SITE_CONTENT_DEFAULTS[f.key];
          const inputId = `sc-${f.key}`;
          if (f.type === 'textarea') {
            return `
              <div class="dash-textcard ${isCustom ? 'is-custom' : ''}" data-key="${escapeAttr(f.key)}" style="grid-template-columns:1fr;">
                <div>
                  <div class="dash-textcard__slot">${escapeHtml(f.label)}<small>${escapeHtml(f.help || '')}</small></div>
                </div>
                <textarea class="dash-textcard__input" id="${inputId}" rows="3">${escapeHtml(val)}</textarea>
                <div class="dash-textcard__btns">
                  <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="save">Save</button>
                  <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="reset">Reset</button>
                </div>
              </div>`;
          }
          return `
            <div class="dash-textcard ${isCustom ? 'is-custom' : ''}" data-key="${escapeAttr(f.key)}" style="grid-template-columns:1fr;">
              <div>
                <div class="dash-textcard__slot">${escapeHtml(f.label)}<small>${escapeHtml(f.help || '')}</small></div>
              </div>
              <input type="${f.type === 'number' ? 'number' : 'text'}" class="dash-textcard__input" id="${inputId}" value="${escapeAttr(val)}" />
              <div class="dash-textcard__btns">
                <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="save">Save</button>
                <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="reset">Reset</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `).join('') + `
    <div class="dash-section">
      <div class="dash-section__head">
        <div class="dash-section__bar" style="background:linear-gradient(180deg,#ff5252,#c41414);"></div>
        <h4 class="dash-section__title">Reset all site content</h4>
      </div>
      <p class="dash-panel__hint" style="margin:0 0 12px;">
        Wipe every override on this page and revert to the defaults baked into <code>site-config.js</code>.
        Useful if you've made lots of experimental edits and want to start fresh.
      </p>
      <button class="dash-btn dash-btn--danger" id="btnResetSiteContent">Reset ALL site content overrides</button>
    </div>
  `;

  // Wire save/reset buttons
  wrap.querySelectorAll('.dash-textcard').forEach(card => {
    const key = card.getAttribute('data-key');
    const input = card.querySelector('input, textarea');
    card.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const val = input.value;
      const ok = await saveSiteContentKey(key, val);
      if (ok) toast(`✓ ${key} saved`, 'success');
    });
    card.querySelector('[data-act="reset"]').addEventListener('click', async () => {
      const ok = await saveSiteContentKey(key, '');
      if (ok) {
        const def = Object.prototype.hasOwnProperty.call(SITE_CONTENT_DEFAULTS, key) ? SITE_CONTENT_DEFAULTS[key] : '';
        input.value = def;
        toast(`${key} reset to default`, 'info');
      }
    });
    if (input.tagName === 'INPUT') {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); card.querySelector('[data-act="save"]').click(); }
      });
    }
  });

  // Wire the reset-all button
  const btnReset = $('#btnResetSiteContent');
  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      const ok = await new Promise(resolve => {
        showConfirm('Reset ALL site content overrides? This wipes every custom value on this page and reverts to the defaults in site-config.js.', resolve);
      });
      if (!ok) return;
      // Build a blank object with every key set to ''
      const blank = {};
      Object.keys(SITE_CONTENT_DEFAULTS).forEach(k => { blank[k] = ''; });
      blank._updatedAt = serverTimestamp();
      try {
        await setDoc(doc(db, 'content', 'site-content'), blank, { merge: true });
        toast('✓ All site content reset to defaults', 'success');
      } catch (e) {
        toast('Reset failed: ' + e.message, 'error');
      }
    });
  }
}

async function saveSiteContentKey(key, value) {
  try {
    await setDoc(doc(db, 'content', 'site-content'),
      { [key]: value, _updatedAt: serverTimestamp() },
      { merge: true });
    return true;
  } catch (e) {
    console.error('[site-content] save failed:', e);
    if (e.code === 'permission-denied' || /permission|denied|rules/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules rejected the write. See Settings tab.', 'error');
      state.rulesOk = false;
      renderRulesStatus();
    } else if (/offline|network|timed out|unreachable/i.test(e.message)) {
      toast('NETWORK — cannot reach Firestore. Try again.', 'error');
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
    return false;
  }
}

// =====================================================================
//  STEP 11.10 — ADD-ONS CRUD
//  ---------------------------------------------------------------------
//  À la carte pricing for single items — logo only, extra page, business
//  card, etc. Static defaults live in site-config.js ADDONS. Admin-
//  curated add-ons live in Firestore `content/addons`. The public
//  services.html page renders the merged list (static + Firestore, with
//  Firestore overriding any static entry with the same id; new ids are
//  appended after the static list).
// =====================================================================

// Merge static ADDONS with Firestore state.addons. Static entries come
// first (in their declared order); Firestore entries override any static
// entry with the same id, and new ids are appended at the end.
function buildMergedListAddons() {
  const byId = new Map();

  ADDONS.forEach(a => { if (a && a.id) byId.set(a.id, a); });
  (state.addons || []).forEach(a => { if (a && a.id) byId.set(a.id, a); });

  const list = [];
  const seen = new Set();
  ADDONS.forEach(a => {
    if (!a || !a.id) return;
    if (byId.has(a.id)) { list.push(byId.get(a.id)); seen.add(a.id); }
  });
  (state.addons || []).forEach(a => {
    if (!a || !a.id) return;
    if (seen.has(a.id)) return;
    list.push(byId.get(a.id));
    seen.add(a.id);
  });
  return list;
}

function renderAddons() {
  const list = $('#addonsList');
  if (!list) return;
  const merged = buildMergedListAddons();

  if (!merged.length) {
    list.innerHTML = `
      <div class="dash-card dash-card--empty">
        <div class="dash-card__body">
          <p>No add-ons yet.</p>
          <p style="margin-top:6px;font-size:12px;">Click <strong>+ Add Add-on</strong> to create one, or <strong>Seed default add-ons</strong> to start with the 6 built-in defaults.</p>
        </div>
      </div>`;
    return;
  }

  list.innerHTML = merged.map(a => {
    const isStatic = ADDONS.some(s => s.id === a.id) && !(state.addons || []).some(s => s.id === a.id);
    const originTag = isStatic
      ? '<span class="dash-project-card__section" style="color:#8a8a8a;background:rgba(255,255,255,0.04);border-color:var(--akay-border);">Static default</span>'
      : '<span class="dash-project-card__section">Firestore</span>';
    const cat = a.category || '';
    const catPillStyle = cat === 'Brand'
      ? 'color:#ff8a3d;background:rgba(255,138,61,0.10);border:1px solid rgba(255,138,61,0.30);'
      : cat === 'Print'
      ? 'color:#2ecc71;background:rgba(46,204,113,0.10);border:1px solid rgba(46,204,113,0.30);'
      : 'color:var(--akay-accent,#5b5bf5);background:rgba(91,91,245,0.10);border:1px solid rgba(91,91,245,0.30);';
    return `
      <div class="dash-project-card" data-id="${escapeAttr(a.id)}" style="grid-template-columns:1fr;">
        <div class="dash-project-card__body">
          <div class="dash-project-card__head">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${cat ? `<span class="dash-project-card__tag" style="${catPillStyle}">${escapeHtml(cat)}</span>` : ''}
              ${originTag}
            </div>
            <div class="dash-project-card__btns">
              <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="edit">Edit</button>
              <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="delete" ${isStatic ? 'disabled title="Static defaults can be overridden by editing — but not deleted from here."' : ''}>Delete</button>
            </div>
          </div>
          <h4 class="dash-project-card__title">${escapeHtml(a.name || 'Untitled add-on')}</h4>
          <p class="dash-project-card__desc">${escapeHtml(a.description || '')}</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--akay-text-mute);margin-top:4px;align-items:baseline;">
            <span style="font:800 18px/1 'Montserrat',sans-serif;color:var(--text);">
              <span style="color:var(--akay-accent,#5b5bf5);font-size:14px;">${escapeHtml(a.symbol || '₦')}</span>${escapeHtml(a.price || '')}
            </span>
            <span style="font-size:11px;">id: <code>${escapeHtml(a.id || '')}</code></span>
          </div>
        </div>
      </div>`;
  }).join('');

  // Wire buttons
  list.querySelectorAll('.dash-project-card').forEach(card => {
    const id = card.getAttribute('data-id');
    card.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-act');
        const addon = merged.find(a => a.id === id);
        if (!addon) return;
        if (act === 'edit') showAddonForm(addon);
        if (act === 'delete') deleteAddon(addon);
      });
    });
  });
}

function showAddonForm(addon) {
  const isEdit = !!addon;
  const base = addon || {
    id: '', name: '', price: '', symbol: '₦', description: '', category: 'Web'
  };

  let modal = $('#addonFormModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'addonFormModal';
  modal.className = 'akay-modal is-open';
  modal.innerHTML = `
    <div class="akay-modal__panel dash-project-form-modal" style="max-width:460px;max-height:90vh;overflow-y:auto;">
      <button class="akay-modal__close" type="button" id="adClose">×</button>
      <h2 class="akay-modal__title">${isEdit ? 'Edit Add-on' : 'Add New Add-on'}</h2>
      <form id="addonForm" class="dash-form">
        <label class="dash-field">
          <span>Name *</span>
          <input type="text" id="ad-name" required value="${escapeAttr(base.name)}" placeholder="e.g. Extra Page" />
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <label class="dash-field">
            <span>Price *</span>
            <input type="text" id="ad-price" required value="${escapeAttr(base.price)}" placeholder="10,000" />
          </label>
          <label class="dash-field">
            <span>Currency symbol</span>
            <input type="text" id="ad-symbol" value="${escapeAttr(base.symbol || '₦')}" placeholder="₦" maxlength="3" />
          </label>
        </div>
        <label class="dash-field">
          <span>Category *</span>
          <select id="ad-category" required>
            <option value="Web"   ${(base.category || 'Web')   === 'Web'   ? 'selected' : ''}>Web — websites, landing pages, dashboards</option>
            <option value="Brand" ${base.category === 'Brand' ? 'selected' : ''}>Brand — logos, identity kits, flyers, social graphics</option>
            <option value="Print" ${base.category === 'Print' ? 'selected' : ''}>Print — business cards, banners, bags, merch</option>
          </select>
        </label>
        <label class="dash-field">
          <span>Description *</span>
          <textarea id="ad-description" rows="3" required placeholder="One-line description shown under the price">${escapeHtml(base.description || '')}</textarea>
        </label>
        <label class="dash-field">
          <span>Slug / id ${isEdit ? '' : '*'}</span>
          <input type="text" id="ad-id" value="${escapeAttr(base.id)}" placeholder="extra-page" ${isEdit ? 'readonly' : ''} />
          <small style="display:block;margin-top:4px;font-size:11px;color:var(--akay-text-mute);">
            Lowercase, hyphen-separated. Used as the unique key — must be unique across all add-ons.
          </small>
        </label>
        <button type="submit" class="dash-btn dash-btn--primary dash-btn--block" style="margin-top:16px;">${isEdit ? 'Save Changes' : 'Add Add-on'}</button>
        <p class="dash-form__err" id="ad-err"></p>
      </form>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('#adClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Auto-slug from name (only on create, not edit)
  if (!isEdit) {
    modal.querySelector('#ad-name').addEventListener('input', e => {
      const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      modal.querySelector('#ad-id').value = slug;
    });
  }

  // Submit
  modal.querySelector('#addonForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = modal.querySelector('#ad-name').value.trim();
    const price = modal.querySelector('#ad-price').value.trim();
    const symbol = modal.querySelector('#ad-symbol').value.trim() || '₦';
    const category = modal.querySelector('#ad-category').value;
    const description = modal.querySelector('#ad-description').value.trim();
    const id = modal.querySelector('#ad-id').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const errEl = modal.querySelector('#ad-err');

    if (!name) { errEl.textContent = 'Name is required'; return; }
    if (!price) { errEl.textContent = 'Price is required'; return; }
    if (!description) { errEl.textContent = 'Description is required'; return; }
    if (!id) { errEl.textContent = 'Slug / id is required'; return; }
    if (!['Web', 'Brand', 'Print'].includes(category)) {
      errEl.textContent = 'Category must be Web, Brand, or Print';
      return;
    }

    errEl.textContent = '';

    const item = { id, name, price, symbol, category, description };

    let updated;
    if (isEdit) {
      // If we're editing a static default, push it as a Firestore override
      const existing = (state.addons || []).findIndex(a => a.id === id);
      if (existing >= 0) {
        updated = [...state.addons];
        updated[existing] = item;
      } else {
        // Editing a static default — create a Firestore override
        updated = [...(state.addons || []), item];
      }
    } else {
      // New — check id uniqueness against both static and Firestore
      const allIds = new Set([
        ...ADDONS.map(a => a.id),
        ...(state.addons || []).map(a => a.id)
      ]);
      if (allIds.has(id)) {
        errEl.textContent = `Slug "${id}" already exists. Choose a different slug.`;
        return;
      }
      updated = [...(state.addons || []), item];
    }

    const ok = await saveAddons(updated);
    if (ok) { toast(isEdit ? 'Add-on updated' : 'Add-on added', 'success'); modal.remove(); }
  });
}

async function deleteAddon(addon) {
  if (!addon || !addon.id) return;
  const ok = await new Promise(resolve => {
    showConfirm(`Delete add-on "${addon.name}"?\n\nThis removes it from /services.html immediately. Static defaults can be re-added by editing site-config.js.`, resolve);
  });
  if (!ok) return;
  const updated = (state.addons || []).filter(a => a.id !== addon.id);
  const saveOk = await saveAddons(updated);
  if (saveOk) toast('Add-on deleted', 'info');
}

async function saveAddons(arr) {
  try {
    await setDoc(doc(db, 'content', 'addons'),
      { items: arr, _updatedAt: serverTimestamp() },
      { merge: true });
    toast(`✓ Add-ons saved (${arr.length})`, 'success');
    return true;
  } catch (e) {
    console.error('[addons] save failed:', e);
    if (e.code === 'permission-denied' || /permission|denied|rules/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules rejected the write. See Settings tab.', 'error');
      state.rulesOk = false;
      renderRulesStatus();
    } else if (/offline|network|timed out|unreachable/i.test(e.message)) {
      toast('NETWORK — cannot reach Firestore. Try again.', 'error');
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
    return false;
  }
}

// Seed the 6 default add-ons into Firestore so they become editable from
// the dashboard. Existing Firestore add-ons with the same id are
// overridden; everything else is preserved.
async function seedDefaultAddons() {
  const ok = await new Promise(resolve => {
    showConfirm('Copy the 6 default add-ons into Firestore so they become editable from the dashboard? Existing edits to those ids will be overwritten; any custom add-ons you added will be preserved.', resolve);
  });
  if (!ok) return;

  toast('Seeding default add-ons…', 'info');
  // Build a map of current Firestore items by id so we keep custom ones.
  const byId = new Map();
  (state.addons || []).forEach(a => { if (a && a.id) byId.set(a.id, a); });
  // Overlay the static defaults — they win.
  ADDONS.forEach(a => { byId.set(a.id, { ...a }); });
  const updated = Array.from(byId.values());

  const saveOk = await saveAddons(updated);
  if (saveOk) toast(`✓ ${ADDONS.length} default add-ons are now editable`, 'success');
}

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

  // Project buttons
  const btnAddProject = $('#btnAddProject');
  if (btnAddProject) btnAddProject.addEventListener('click', addNewProject);
  const btnSeedProjects = $('#btnSeedProjects');
  if (btnSeedProjects) btnSeedProjects.addEventListener('click', seedDefaultProjects);
  const btnSeedWebPortfolio = $('#btnSeedWebPortfolio');
  if (btnSeedWebPortfolio) btnSeedWebPortfolio.addEventListener('click', seedWebPortfolioDefaults);
  const btnSeedDesign = $('#btnSeedDesign');
  if (btnSeedDesign) btnSeedDesign.addEventListener('click', seedDesignProjects);
  const btnSeedPrint = $('#btnSeedPrint');
  if (btnSeedPrint) btnSeedPrint.addEventListener('click', seedPrintProjects);
  const btnRefreshProjects = $('#btnRefreshProjects');
  if (btnRefreshProjects) btnRefreshProjects.addEventListener('click', () => {
    renderProjects();
    toast('Refreshed', 'info');
  });

  // Project search + bulk delete
  const projectSearch = $('#projectSearch');
  if (projectSearch) {
    let searchTimer = null;
    projectSearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderProjects(), 150);
    });
  }
  const btnDeleteMarked = $('#btnDeleteMarked');
  if (btnDeleteMarked) btnDeleteMarked.addEventListener('click', deleteMarkedProjects);
  const btnClearMarks = $('#btnClearMarks');
  if (btnClearMarks) btnClearMarks.addEventListener('click', clearAllMarks);

  // Case Studies buttons
  const btnAddCaseStudy = $('#btnAddCaseStudy');
  if (btnAddCaseStudy) btnAddCaseStudy.addEventListener('click', () => showCaseStudyForm(null));
  const btnRefreshCaseStudies = $('#btnRefreshCaseStudies');
  if (btnRefreshCaseStudies) btnRefreshCaseStudies.addEventListener('click', () => {
    renderCaseStudies();
    toast('Refreshed', 'info');
  });

  // Blog Posts buttons
  const btnAddBlogPost = $('#btnAddBlogPost');
  if (btnAddBlogPost) btnAddBlogPost.addEventListener('click', () => showBlogPostForm(null));
  const btnRefreshBlogPosts = $('#btnRefreshBlogPosts');
  if (btnRefreshBlogPosts) btnRefreshBlogPosts.addEventListener('click', () => {
    renderBlogPosts();
    toast('Refreshed', 'info');
  });

  // Downloads buttons
  const btnRefreshDownloads = $('#btnRefreshDownloads');
  if (btnRefreshDownloads) btnRefreshDownloads.addEventListener('click', () => {
    renderDownloadsEditor();
    toast('Refreshed', 'info');
  });

  // Site Content buttons
  const btnRefreshSiteContent = $('#btnRefreshSiteContent');
  if (btnRefreshSiteContent) btnRefreshSiteContent.addEventListener('click', () => {
    renderSiteContentEditor();
    toast('Refreshed', 'info');
  });

  // Add-ons buttons
  const btnAddAddon = $('#btnAddAddon');
  if (btnAddAddon) btnAddAddon.addEventListener('click', () => showAddonForm(null));
  const btnSeedAddons = $('#btnSeedAddons');
  if (btnSeedAddons) btnSeedAddons.addEventListener('click', seedDefaultAddons);

  // Show the delete endpoint in Settings
  const ep = $('#settingsDeleteEndpoint');
  if (ep) ep.textContent = cloudinaryDeleteEndpoint;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
