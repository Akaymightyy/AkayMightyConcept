// =====================================================================
//  admin-dashboard.js  —  logic for the dedicated /admin.html page
//  ---------------------------------------------------------------------
//  Provides a grid view of ALL image + text slots, with bulk actions.
//  Shares Firebase + Cloudinary config with the inline admin layer.
// =====================================================================

import { auth, db } from "./firebase-config.js";
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
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// =====================================================================
//  REGISTRY — every image slot we know about.
//  Defaults are read from the main site (we open a hidden iframe to ./)
//  so we always know what the "default" URL is for each slot.
// =====================================================================
const IMAGE_SLOTS = [
  { id: 'img:logo',           label: 'Site Logo (nav, preloader, footer)' },
  { id: 'img:headshot',       label: 'Akay Headshot (hero + about)' },
  { id: 'img:logo-design',    label: 'Logo Design sample' },
  { id: 'img:ads-flyer',      label: 'Ads Flyer sample' },
  { id: 'img:food-flyer',     label: 'Food Flyer sample' },
  { id: 'img:business-flyer', label: 'Business Flyer sample' },
  { id: 'img:club-flyer',     label: 'Club Flyer sample' },
  { id: 'img:web3-flyer',     label: 'Web3 / Crypto Flyer sample' },
  { id: 'img:business-card',  label: 'Business Card sample' },
  { id: 'img:leather-print',  label: 'Leather Print sample' },
  { id: 'img:paper-bag',      label: 'Paper Bag sample' },
  { id: 'img:custom-bag',     label: 'Custom Bag sample' },
  { id: 'img:branded-merch',  label: 'Branded Merch sample' },
  { id: 'img:web-1',  label: 'Web Showcase Row 1 · Card 1' },
  { id: 'img:web-2',  label: 'Web Showcase Row 1 · Card 2' },
  { id: 'img:web-3',  label: 'Web Showcase Row 1 · Card 3' },
  { id: 'img:web-4',  label: 'Web Showcase Row 1 · Card 4' },
  { id: 'img:web-5',  label: 'Web Showcase Row 1 · Card 5' },
  { id: 'img:web-6',  label: 'Web Showcase Row 1 · Card 6' },
  { id: 'img:web-7',  label: 'Web Showcase Row 2 · Card 1' },
  { id: 'img:web-8',  label: 'Web Showcase Row 2 · Card 2' },
  { id: 'img:web-9',  label: 'Web Showcase Row 2 · Card 3' },
  { id: 'img:web-10', label: 'Web Showcase Row 2 · Card 4' },
  { id: 'img:web-11', label: 'Web Showcase Row 2 · Card 5' },
  { id: 'img:web-12', label: 'Web Showcase Row 2 · Card 6' }
];

// =====================================================================
//  STATE
// =====================================================================
const state = {
  images: {},      // current overrides from Firestore
  texts: {},
  defaults: {},    // captured from main site iframe
  defaultsReady: false,
  unsubImages: null,
  unsubTexts: null
};

const $ = (s, r = document) => r.querySelector(s);
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
  el._t = setTimeout(() => el.classList.remove('is-visible'), 2800);
}

// =====================================================================
//  STEP 1 — capture default image URLs from the live site
//  We open a hidden iframe to ./ (same origin) and read every
//  [data-img-slot] element's src. This guarantees the dashboard's
//  "default" matches whatever the site currently ships with.
// =====================================================================
function captureDefaultsFromSite() {
  return new Promise(resolve => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0;';
    iframe.src = './';
    iframe.onload = () => {
      try {
        const idoc = iframe.contentDocument;
        if (!idoc) throw new Error('No iframe document');
        $$('#index.html, body', idoc);
        idoc.querySelectorAll('[data-img-slot]').forEach(el => {
          const slot = el.getAttribute('data-img-slot');
          if (state.defaults[slot]) return;
          if (el.tagName === 'IMG') {
            const s = el.getAttribute('src');
            if (s) state.defaults[slot] = new URL(s, iframe.src).href;
          } else {
            const inner = el.querySelector('img');
            if (inner && inner.getAttribute('src')) {
              state.defaults[slot] = new URL(inner.getAttribute('src'), iframe.src).href;
            }
          }
        });
        state.defaultsReady = true;
        console.log('[dash] captured defaults:', Object.keys(state.defaults).length);
      } catch (e) {
        console.warn('[dash] iframe defaults capture failed:', e.message);
      } finally {
        iframe.remove();
        resolve();
      }
    };
    iframe.onerror = () => { iframe.remove(); resolve(); };
    document.body.appendChild(iframe);
    // Safety timeout in case onload never fires
    setTimeout(() => { if (iframe.parentNode) iframe.remove(); resolve(); }, 4000);
  });
}

// =====================================================================
//  STEP 2 — Firestore real-time subscriptions
// =====================================================================
function startSync() {
  if (state.unsubImages) state.unsubImages();
  if (state.unsubTexts)  state.unsubTexts();

  state.unsubImages = onSnapshot(doc(db, 'content', 'images'), snap => {
    state.images = snap.exists() ? snap.data() : {};
    delete state.images._updatedAt;
    renderImages();
    renderStats();
  }, err => {
    console.error('[dash] images sync error:', err);
    toast('Image sync failed — check Firestore rules', 'error');
  });

  state.unsubTexts = onSnapshot(doc(db, 'content', 'texts'), snap => {
    state.texts = snap.exists() ? snap.data() : {};
    delete state.texts._updatedAt;
    renderTexts();
  }, err => console.error('[dash] texts sync error:', err));
}

// =====================================================================
//  STEP 3 — render the image grid
// =====================================================================
function renderImages() {
  const grid = $('#imgGrid');
  if (!grid) return;

  if (!IMAGE_SLOTS.length) {
    grid.innerHTML = '<p class="dash-panel__hint">No image slots registered.</p>';
    return;
  }

  grid.innerHTML = IMAGE_SLOTS.map(slot => {
    const override = state.images[slot.id];
    const isCustom = !!override && override.length > 0;
    const url = isCustom ? override : (state.defaults[slot.id] || '');
    const isDefault = !isCustom;
    const urlLabel = url ? url.replace(/^https?:\/\//, '') : '(no default set)';

    return `
      <div class="dash-card ${isCustom ? 'is-custom' : ''}" data-slot="${slot.id}">
        <div class="dash-card__preview ${url ? '' : 'dash-card__preview--empty'}">
          ${url
            ? `<img src="${url}" alt="${slot.label}" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('dash-card__preview--empty'); this.parentElement.innerHTML='No preview';" />`
            : 'No image'
          }
        </div>
        <div class="dash-card__body">
          <div>
            <div class="dash-card__slot">${slot.id}</div>
            <div class="dash-card__url" title="${url}">${urlLabel}</div>
          </div>
          <div class="dash-card__btns">
            <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="upload">Replace</button>
            <button class="dash-btn dash-btn--ghost dash-btn--mini" data-act="url">Paste URL</button>
            <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="delete" ${!isCustom || !publicIdFromCloudinaryUrl(url) ? 'disabled title="Only available for Cloudinary-hosted custom images"' : ''}>Delete file</button>
            <button class="dash-btn dash-btn--ghost dash-btn--mini" data-act="reset" ${isDefault ? 'disabled' : ''}>Reset</button>
          </div>
          <div style="font-size:11px;color:#5a5a5a;margin-top:4px;">${slot.label}</div>
        </div>
      </div>
    `;
  }).join('');

  // wire buttons
  grid.querySelectorAll('.dash-card').forEach(card => {
    const slot = card.getAttribute('data-slot');
    card.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => handleImageAction(slot, btn.getAttribute('data-act'), card));
    });
  });
}

// =====================================================================
//  STEP 4 — render the text grid
// =====================================================================
function renderTexts() {
  const grid = $('#textGrid');
  if (!grid) return;
  const slots = Object.keys(state.texts).filter(k => k.startsWith('text:')).sort();
  if (!slots.length) {
    grid.innerHTML = `
      <div class="dash-textcard">
        <div></div>
        <div style="color:#8a8a8a;font-size:13px;">
          No text slots saved yet. Add <code>data-text-slot="text:slot-name"</code> attributes
          to elements in <code>index.html</code>, then edit them inline on the site
          (triple-click the logo to enter edit mode). They'll appear here automatically.
        </div>
        <div></div>
      </div>
    `;
    return;
  }
  grid.innerHTML = slots.map(slot => {
    const val = state.texts[slot] || '';
    return `
      <div class="dash-textcard" data-slot="${slot}">
        <div class="dash-textcard__slot">${slot}</div>
        <input type="text" class="dash-textcard__input" value="${escapeAttr(val)}" data-original="${escapeAttr(val)}" />
        <div class="dash-textcard__btns">
          <button class="dash-btn dash-btn--primary dash-btn--mini" data-act="save">Save</button>
          <button class="dash-btn dash-btn--danger dash-btn--mini" data-act="delete">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.dash-textcard').forEach(card => {
    const slot = card.getAttribute('data-slot');
    const input = card.querySelector('input');
    card.querySelector('[data-act="save"]').addEventListener('click', async () => {
      const val = input.value.trim();
      if (val === input.dataset.original) return;
      await saveText(slot, val);
      toast(`Saved ${slot}`, 'success');
    });
    card.querySelector('[data-act="delete"]').addEventListener('click', async () => {
      if (!confirm(`Delete ${slot}?`)) return;
      await deleteText(slot);
      toast(`Deleted ${slot}`, 'info');
    });
    // Enter key saves
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        card.querySelector('[data-act="save"]').click();
      }
    });
  });
}

function escapeAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// =====================================================================
//  STEP 5 — render stats
// =====================================================================
function renderStats() {
  const total = IMAGE_SLOTS.length;
  const custom = Object.values(state.images).filter(v => v && v.length > 0).length;
  $('#statSlots').textContent  = total;
  $('#statCustom').textContent = custom;
  $('#statDefaults').textContent = total - custom;
  $('#statSaved').textContent = new Date().toLocaleTimeString();
}

// =====================================================================
//  STEP 6 — image actions
// =====================================================================
async function handleImageAction(slot, act, card) {
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
    toast('Uploading…', 'info');
    try {
      const url = await uploadToCloudinary(file);
      await saveImage(slot, url);
      toast(`Updated ${slot}`, 'success');
    } catch (e) {
      toast('Upload failed: ' + e.message, 'error');
    } finally {
      input.remove();
    }
  });
  input.click();
}

function triggerUrlPaste(slot) {
  const current = state.images[slot] || state.defaults[slot] || '';
  const url = prompt(`Paste image URL for ${slot}:`, current);
  if (url === null) return;
  if (!url.trim()) { toast('No URL entered', 'error'); return; }
  try { new URL(url.trim()); } catch { toast('Invalid URL', 'error'); return; }
  saveImage(slot, url.trim()).then(() => toast(`Updated ${slot}`, 'success'));
}

async function resetSlot(slot) {
  if (!confirm(`Reset ${slot} to default?`)) return;
  try {
    await setDoc(doc(db, 'content', 'images'),
      { [slot]: '', _updatedAt: serverTimestamp() },
      { merge: true });
    toast(`${slot} reset`, 'info');
  } catch (e) {
    toast('Reset failed: ' + e.message, 'error');
  }
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
  toast('Deleting…', 'info');
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
    await setDoc(doc(db, 'content', 'images'),
      { [slot]: '', _updatedAt: serverTimestamp() },
      { merge: true });
    toast(`Deleted ${publicId}`, 'success');
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

async function saveImage(slot, url) {
  await setDoc(doc(db, 'content', 'images'),
    { [slot]: url, _updatedAt: serverTimestamp() },
    { merge: true });
}

async function saveText(slot, text) {
  await setDoc(doc(db, 'content', 'texts'),
    { [slot]: text, _updatedAt: serverTimestamp() },
    { merge: true });
}

async function deleteText(slot) {
  await setDoc(doc(db, 'content', 'texts'),
    { [slot]: '', _updatedAt: serverTimestamp() },
    { merge: true });
}

async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', cloudinaryConfig.unsignedPreset);
  if (cloudinaryConfig.folder) fd.append('folder', cloudinaryConfig.folder);
  const resp = await fetch(cloudinaryUploadUrl(), { method: 'POST', body: fd });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Cloudinary ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (!data.secure_url) throw new Error('Cloudinary response missing secure_url');
  return data.secure_url;
}

// =====================================================================
//  STEP 7 — Reset ALL
// =====================================================================
async function resetAll() {
  if (!confirm('Reset ALL image slots to defaults? This wipes every override in Firestore.')) return;
  const blank = Object.fromEntries(IMAGE_SLOTS.map(s => [s.id, '']));
  blank._updatedAt = serverTimestamp();
  try {
    await setDoc(doc(db, 'content', 'images'), blank, { merge: true });
    toast('All images reset to defaults', 'success');
  } catch (e) {
    toast('Reset failed: ' + e.message, 'error');
  }
}

// =====================================================================
//  STEP 8 — tabs
// =====================================================================
function initTabs() {
  $$('.dash-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      $$('.dash-tab').forEach(t => t.classList.toggle('is-active', t === tab));
      $$('.dash-panel').forEach(p => {
        p.classList.toggle('is-active', p.id === `tab-${target}`);
        p.hidden = p.id !== `tab-${target}`;
      });
    });
  });
}

// =====================================================================
//  STEP 9 — login
// =====================================================================
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
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will swap UI
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
//  STEP 10 — auth state → swap UI
// =====================================================================
onAuthStateChanged(auth, async user => {
  if (user) {
    $('#dashLogin').hidden = true;
    $('#dashApp').hidden = false;
    $('#dashEmail').value = '';
    $('#dashPass').value = '';
    if (!state.defaultsReady) await captureDefaultsFromSite();
    if (!state.unsubImages)   startSync();
    toast(`Welcome, ${user.email}`, 'success');
  } else {
    $('#dashLogin').hidden = false;
    $('#dashApp').hidden = true;
    if (state.unsubImages) { state.unsubImages(); state.unsubImages = null; }
    if (state.unsubTexts)  { state.unsubTexts();  state.unsubTexts  = null; }
  }
});

// =====================================================================
//  STEP 11 — wire buttons + boot
// =====================================================================
function boot() {
  initLogin();
  initTabs();
  $('#btnRefresh').addEventListener('click', () => {
    renderImages();
    renderTexts();
    renderStats();
    toast('Refreshed', 'info');
  });
  $('#btnResetAll').addEventListener('click', resetAll);
  // Settings tab — show the delete endpoint
  const ep = $('#settingsDeleteEndpoint');
  if (ep) ep.textContent = cloudinaryDeleteEndpoint;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
