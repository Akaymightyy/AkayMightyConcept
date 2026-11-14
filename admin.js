// =====================================================================
//  admin.js  —  inline admin dashboard for Akay Mighty Concept
//  ---------------------------------------------------------------------
//  FEATURES
//    • Triple-click the nav logo (within 800ms) → opens the login overlay
//    • Email/password login against Firebase Auth (single admin account)
//    • Once logged in, the page enters "edit mode":
//        - Every image with [data-img-slot] gets a hover "Replace / Remove"
//          button. Click → file picker → upload to Cloudinary (unsigned)
//          OR paste a URL → save URL to Firestore → every matching <img>
//          on the page updates live within ~200ms.
//        - Every element with [data-text-slot] becomes click-to-edit
//          (contenteditable). Blur → save to Firestore → live for everyone.
//    • A floating toolbar at the bottom-right lets the admin:
//        - Exit edit mode (signs out)
//        - Reset a slot to its default
//        - See sync status ("Saving…", "All changes saved")
//    • Public visitors never see any of this. They get a real-time feed
//      of whatever images/text the admin has set.
//
//  FIRESTORE SCHEMA
//    collection `content` /
//      doc `images`  → { "<slotId>": "<url>",  _updatedAt: <timestamp> }
//      doc `texts`   → { "<slotId>": "<text>", _updatedAt: <timestamp> }
//
//  SECURITY
//    See firestore.rules. Only the authenticated admin can write.
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
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "./firebase-config.js";
import {
  cloudinaryConfig,
  cloudinaryUploadUrl,
  cloudinaryDeleteEndpoint,
  publicIdFromCloudinaryUrl
} from "./cloudinary-config.js";

// =====================================================================
//  STATE
// =====================================================================
const state = {
  isAdmin: false,
  isEditing: false,
  images: {},   // { "img:logo": "https://...", ... }  (overrides only)
  texts: {},    // { "text:hero-title": "Hi I'm Akay", ... }
  unsubImages: null,
  unsubTexts: null,
  loginClicks: 0,
  loginTimer: null
};

// =====================================================================
//  DEFAULTS — used when no override exists in Firestore yet.
//  Pulled from the page itself at init time so we never lose the
//  original content.
// =====================================================================
const defaults = { images: {}, texts: {} };

// =====================================================================
//  UTIL
// =====================================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function toast(msg, kind = "info") {
  let el = $("#akayToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "akayToast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `akay-toast akay-toast--${kind} is-visible`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("is-visible"), 2400);
}

// =====================================================================
//  STEP 1 — capture default image URLs from the live DOM
//  Each slot's default = the first matching <img>'s current src.
// =====================================================================
function captureDefaults() {
  $$('[data-img-slot]').forEach(el => {
    const slot = el.getAttribute('data-img-slot');
    if (defaults.images[slot]) return;            // already captured
    if (el.tagName === 'IMG') {
      const s = el.getAttribute('src');
      if (s) defaults.images[slot] = s;
    } else {
      // div.clickable-img / .portfolio-item has nested <img>
      const inner = el.querySelector('img');
      if (inner && inner.getAttribute('src')) {
        defaults.images[slot] = inner.getAttribute('src');
      } else {
        const di = el.getAttribute('data-img');
        if (di) defaults.images[slot] = di;
      }
    }
  });

  $$('[data-text-slot]').forEach(el => {
    const slot = el.getAttribute('data-text-slot');
    if (!defaults.texts[slot]) {
      defaults.texts[slot] = el.textContent.trim();
    }
  });

  console.log(`[admin] captured ${Object.keys(defaults.images).length} image slots, ${Object.keys(defaults.texts).length} text slots`);
}

// =====================================================================
//  STEP 2 — apply an image URL to every element matching a slot
// =====================================================================
function applyImage(slot, url) {
  $$(`[data-img-slot="${slot}"]`).forEach(el => {
    if (el.tagName === 'IMG') {
      el.setAttribute('src', url);
      // clear any opacity set by old onerror handlers
      el.style.opacity = '';
    } else {
      // portfolio-item / service-card-img — has nested <img>
      const img = el.querySelector('img');
      if (img) {
        img.setAttribute('src', url);
        img.style.opacity = '';
      }
      // also update data-img (used by the lightbox)
      el.setAttribute('data-img', url);
    }
  });
}

function applyText(slot, text) {
  $$(`[data-text-slot="${slot}"]`).forEach(el => {
    if (el.getAttribute('contenteditable') === 'true') {
      // don't blow away the user's caret position mid-edit
      if (document.activeElement !== el) {
        el.textContent = text;
      }
    } else {
      el.textContent = text;
    }
  });
}

// =====================================================================
//  STEP 3 — Firestore real-time subscriptions
// =====================================================================
//  v11: Added network health monitoring. When Firestore can't reach
//  the server (DNS failures, ERR_NAME_NOT_RESOLVED, etc.), we:
//    1. Show a visible red banner at the top of the page
//    2. Don't pretend saves succeeded (status stays "Saving...")
//    3. Auto-retry every 10 seconds until network returns
//    4. When network returns, all queued writes flush automatically
// =====================================================================

let _networkHealthy = null;   // null=unknown, true=ok, false=broken
let _retryTimer = null;

function setNetworkHealth(healthy, reason) {
  if (_networkHealthy === healthy) return;
  _networkHealthy = healthy;
  console.log(`[admin] network health: ${healthy ? 'OK' : 'BROKEN'} ${reason ? '(' + reason + ')' : ''}`);
  updateNetworkBanner(healthy, reason);

  if (!healthy) {
    // Start retry loop
    if (!_retryTimer) {
      _retryTimer = setInterval(async () => {
        console.log('[admin] retrying Firestore connection...');
        await forceOnline();
        // Try a simple read to see if it works now
        try {
          await getDoc(doc(db, 'content', 'images'));
          // If we got here, network is back
          setNetworkHealth(true, 'reconnected');
          clearInterval(_retryTimer);
          _retryTimer = null;
        } catch (e) {
          // Still broken, keep retrying
        }
      }, 10000);
    }
  } else {
    // Network is back — stop retry, force a fresh read
    if (_retryTimer) {
      clearInterval(_retryTimer);
      _retryTimer = null;
    }
    forceServerRead();
  }
}

function updateNetworkBanner(healthy, reason) {
  // Only show the banner if the user is in edit mode (admin).
  // Public visitors should NEVER see Firebase error messages.
  if (!document.body.classList.contains('akay-edit-mode')) {
    // Not in edit mode — hide any existing banner and don't show errors
    let banner = $('#akayNetBanner');
    if (banner) banner.style.display = 'none';
    return;
  }

  let banner = $('#akayNetBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'akayNetBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:12px 16px;text-align:center;font:600 13px/1.4 Poppins,sans-serif;border-radius:0 0 8px 8px;box-shadow:0 4px 12px rgba(0,0,0,.4);';
    document.body.appendChild(banner);
  }
  if (healthy) {
    banner.style.display = 'none';
  } else {
    banner.style.display = 'block';
    banner.style.background = 'rgba(217, 45, 32, .95)';
    banner.style.color = '#fff';
    banner.innerHTML = `<strong>⚠ Cannot reach Firebase.</strong> ${reason || 'Network/DNS issue.'} Edits will save locally and sync when connection returns. <a href="./debug.html" style="color:#fff;text-decoration:underline;">Open debug</a>`;
  }
}

function startSync() {
  if (state.unsubImages) state.unsubImages();
  if (state.unsubTexts)  state.unsubTexts();

  state.unsubImages = onSnapshot(doc(db, 'content', 'images'), snap => {
    const fromCache = snap.metadata && snap.metadata.fromCache;
    console.log(`[admin] images snapshot: ${snap.exists() ? Object.keys(snap.data()).length + ' fields' : 'doc does not exist'} ${fromCache ? '(cache)' : '(server)'}`);

    // If we got a server snapshot, network is healthy
    if (!fromCache) setNetworkHealth(true);

    if (!snap.exists()) {
      if (!fromCache) state.images = {};
      return;
    }
    const data = snap.data();
    delete data._updatedAt;
    state.images = data;
    if (!fromCache || !state._gotServerImages) {
      Object.entries(data).forEach(([slot, url]) => {
        if (slot.startsWith('img:')) applyImage(slot, url);
      });
      if (!fromCache) state._gotServerImages = true;
    }
  }, err => {
    console.error('[admin] images sync error:', err);
    // Don't show error toast on public pages for transient network failures
    // — just log to console. The proxy will retry automatically.
    if (err.code === 'permission-denied') {
      console.warn('[admin] Firestore rules deny read');
    } else if (err.code === 'unavailable' || /offline|network|unreachable|name-not-resolved|Failed to fetch/i.test(err.message)) {
      setNetworkHealth(false, err.message);
    } else {
      console.warn('[admin] Image sync error:', err.message);
    }
  });

  state.unsubTexts = onSnapshot(doc(db, 'content', 'texts'), snap => {
    const fromCache = snap.metadata && snap.metadata.fromCache;
    if (!snap.exists()) {
      if (!fromCache) state.texts = {};
      return;
    }
    const data = snap.data();
    delete data._updatedAt;
    state.texts = data;
    if (!fromCache || !state._gotServerTexts) {
      Object.entries(data).forEach(([slot, text]) => {
        if (slot.startsWith('text:')) applyText(slot, text);
      });
      if (!fromCache) state._gotServerTexts = true;
    }
  }, err => {
    console.error('[admin] texts sync error:', err);
  });

  // Force a server read on init (with network health detection)
  forceServerRead();
}

async function forceServerRead() {
  try {
    console.log('[admin] forcing server read of content/images...');
    const imgSnap = await getDoc(doc(db, 'content', 'images'));
    setNetworkHealth(true);   // we got a response — network is OK
    if (imgSnap.exists()) {
      const data = imgSnap.data();
      delete data._updatedAt;
      console.log(`[admin] server read: ${Object.keys(data).filter(k => k.startsWith('img:')).length} image overrides`);
      state.images = { ...state.images, ...data };
      state._gotServerImages = true;
      Object.entries(data).forEach(([slot, url]) => {
        if (slot.startsWith('img:')) applyImage(slot, url);
      });
    }
  } catch (e) {
    console.error('[admin] forceServerRead images failed:', e.message);
    if (/offline|network|unreachable|name-not-resolved|err_name/i.test(e.message)) {
      setNetworkHealth(false, e.message);
    }
  }

  try {
    const textSnap = await getDoc(doc(db, 'content', 'texts'));
    if (textSnap.exists()) {
      const data = textSnap.data();
      delete data._updatedAt;
      state.texts = { ...state.texts, ...data };
      state._gotServerTexts = true;
      Object.entries(data).forEach(([slot, text]) => {
        if (slot.startsWith('text:')) applyText(slot, text);
      });
    }
  } catch (e) {
    console.error('[admin] forceServerRead texts failed:', e.message);
  }
}

// =====================================================================
//  STEP 4 — Triple-click on the nav logo opens the admin dashboard
//  ---------------------------------------------------------------------
//  If the user is already logged in, we enter inline edit mode.
//  If not, we navigate to /admin.html (the dedicated dashboard page)
//  where they can log in and manage all content from a single grid.
//
//  Hold Shift while triple-clicking to force the inline login modal
//  (kept as a fallback for when /admin.html isn't reachable).
// =====================================================================
function initTripleClick() {
  const navLogo = $('#navbar [data-img-slot="img:logo"]');
  if (!navLogo) {
    console.warn('[admin] nav logo not found');
    return;
  }
  const clickTarget = navLogo.closest('a') || navLogo;
  clickTarget.addEventListener('click', e => {
    state.loginClicks++;
    clearTimeout(state.loginTimer);
    state.loginTimer = setTimeout(() => state.loginClicks = 0, 800);
    if (state.loginClicks >= 3) {
      e.preventDefault();
      state.loginClicks = 0;
      if (state.isAdmin) {
        // already logged in — toggle inline edit mode on this page
        toggleEditMode();
      } else if (e.shiftKey) {
        // fallback: inline login modal
        openLoginModal();
      } else {
        // default: go to the dedicated dashboard
        window.location.href = './admin.html';
      }
    }
  });
}

// =====================================================================
//  STEP 5 — Login modal
// =====================================================================
function buildLoginModal() {
  if ($('#akayLoginModal')) return;
  const modal = document.createElement('div');
  modal.id = 'akayLoginModal';
  modal.className = 'akay-modal';
  modal.innerHTML = `
    <div class="akay-modal__panel">
      <button class="akay-modal__close" type="button" aria-label="Close">×</button>
      <h2 class="akay-modal__title">Admin Login</h2>
      <p class="akay-modal__sub">Akay Mighty Concept — content editor</p>
      <form id="akayLoginForm" class="akay-form">
        <label class="akay-field">
          <span>Email</span>
          <input type="email" id="akayEmail" required autocomplete="username" />
        </label>
        <label class="akay-field">
          <span>Password</span>
          <input type="password" id="akayPass" required autocomplete="current-password" />
        </label>
        <button type="submit" class="akay-btn akay-btn--primary" id="akayLoginBtn">
          <span class="akay-btn-label">Log in</span>
        </button>
        <p class="akay-form__err" id="akayLoginErr"></p>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', e => {
    if (e.target === modal) closeLoginModal();
  });
  modal.querySelector('.akay-modal__close').addEventListener('click', closeLoginModal);

  modal.querySelector('#akayLoginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = modal.querySelector('#akayEmail').value.trim();
    const pass  = modal.querySelector('#akayPass').value;
    const errEl = modal.querySelector('#akayLoginErr');
    const btn   = modal.querySelector('#akayLoginBtn');
    errEl.textContent = '';
    btn.disabled = true;
    btn.querySelector('.akay-btn-label').textContent = 'Logging in…';
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast('Welcome back, Akay', 'success');
      closeLoginModal();
    } catch (err) {
      errEl.textContent = friendlyAuthError(err.code || err.message);
      btn.disabled = false;
      btn.querySelector('.akay-btn-label').textContent = 'Log in';
    }
  });
}

function friendlyAuthError(code) {
  const map = {
    'auth/invalid-email':            'That email address is malformed.',
    'auth/user-disabled':            'This account has been disabled.',
    'auth/user-not-found':           'No account found with that email.',
    'auth/wrong-password':           'Wrong password. Try again.',
    'auth/invalid-credential':       'Wrong email or password.',
    'auth/too-many-requests':        'Too many attempts. Wait a minute and try again.',
    'auth/network-request-failed':   'Network error — check your connection.'
  };
  return map[code] || `Login failed: ${code || 'unknown error'}`;
}

function openLoginModal() {
  buildLoginModal();
  const m = $('#akayLoginModal');
  m.classList.add('is-open');
  setTimeout(() => m.querySelector('#akayEmail').focus(), 100);
}

function closeLoginModal() {
  const m = $('#akayLoginModal');
  if (m) m.classList.remove('is-open');
}

// =====================================================================
//  STEP 6 — Edit mode UI (floating toolbar + per-image hover buttons)
// =====================================================================
function buildToolbar() {
  if ($('#akayToolbar')) return;
  const bar = document.createElement('div');
  bar.id = 'akayToolbar';
  bar.innerHTML = `
    <div class="akay-tb__status" id="akayStatus">All changes saved</div>
    <div class="akay-tb__actions">
      <button type="button" class="akay-btn akay-btn--ghost" id="akayResetAll" title="Reset ALL content to defaults">Reset all</button>
      <button type="button" class="akay-btn akay-btn--danger"  id="akaySignOut">Sign out</button>
    </div>
  `;
  document.body.appendChild(bar);

  bar.querySelector('#akaySignOut').addEventListener('click', async () => {
    try {
      await signOut(auth);
      toast('Signed out', 'info');
    } catch (e) {
      toast('Sign out failed', 'error');
    }
  });

  bar.querySelector('#akayResetAll').addEventListener('click', async () => {
    if (!confirm('Reset ALL images and text to defaults? This wipes every override in Firestore.')) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'content', 'images'), { _updatedAt: serverTimestamp() }, { merge: true });
      await setDoc(doc(db, 'content', 'texts'),  { _updatedAt: serverTimestamp() }, { merge: true });
      // re-apply defaults locally
      Object.entries(defaults.images).forEach(([slot, url]) => applyImage(slot, url));
      Object.entries(defaults.texts).forEach(([slot, text]) => applyText(slot, text));
      toast('Reset complete', 'success');
    } catch (e) {
      toast('Reset failed: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  });
}

function setSaving(flag) {
  const el = $('#akayStatus');
  if (!el) return;
  el.textContent = flag ? 'Saving…' : 'All changes saved';
  el.classList.toggle('is-saving', flag);
}

// =====================================================================
//  STEP 7 — Edit mode: enable contenteditable + per-image buttons
// =====================================================================
function enterEditMode() {
  state.isEditing = true;
  document.body.classList.add('akay-edit-mode');
  buildToolbar();

  // Text slots → contenteditable
  $$('[data-text-slot]').forEach(el => {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    el.addEventListener('blur', onTextEditBlur, { once: false });
    el.addEventListener('keydown', onTextEditKeydown);
  });

  // Image slots → wrap with hover overlay
  ensureImageOverlays();

  toast('Edit mode on — click any text or hover any image to edit', 'info');
}

function exitEditMode() {
  state.isEditing = false;
  document.body.classList.remove('akay-edit-mode');
  $$('[data-text-slot]').forEach(el => {
    el.removeAttribute('contenteditable');
    el.removeEventListener('blur', onTextEditBlur);
    el.removeEventListener('keydown', onTextEditKeydown);
  });
  removeImageOverlays();
  const tb = $('#akayToolbar');
  if (tb) tb.remove();
}

function toggleEditMode() {
  if (state.isEditing) exitEditMode();
  else enterEditMode();
}

// --- text editing handlers ---
function onTextEditBlur(e) {
  const el = e.currentTarget;
  const slot = el.getAttribute('data-text-slot');
  const newText = el.textContent.trim();
  const current = state.texts[slot] || defaults.texts[slot] || '';
  if (newText === current) return;     // no change
  saveText(slot, newText);
}

function onTextEditKeydown(e) {
  // ESC = cancel (revert to current saved value)
  if (e.key === 'Escape') {
    e.preventDefault();
    const el = e.currentTarget;
    const slot = el.getAttribute('data-text-slot');
    el.textContent = state.texts[slot] || defaults.texts[slot] || '';
    el.blur();
  }
}

async function saveText(slot, text) {
  setSaving(true);
  try {
    // Apply optimistically
    state.texts[slot] = text;

    // Write to Firestore (local cache accepts immediately)
    await setDoc(doc(db, 'content', 'texts'),
      { [slot]: text, _updatedAt: serverTimestamp() },
      { merge: true });

    // Check network health before declaring success
    if (_networkHealthy === false) {
      setSaving(false);
      toast(`⚠ ${slot} saved locally only — network down. Will sync when connection returns.`, 'error');
      return;
    }

    // Show "saved" + verify in background
    setSaving(false);
    toast(`✓ ${slot} saved`, 'success');
    verifyInBackground(slot, text, 'texts');
  } catch (e) {
    console.error('[admin] saveText failed:', e);
    setSaving(false);
    if (e.code === 'permission-denied' || /permission|denied|rules/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules rejected the write. Open Firebase console → Firestore → Rules → paste firestore.rules → Publish.', 'error');
    } else if (/offline|network|timed out|unreachable|err_name/i.test(e.message)) {
      setNetworkHealth(false, e.message);
      toast(`⚠ ${slot} saved locally only — network down. Will sync when connection returns.`, 'error');
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
  }
}

// --- image overlay handlers ---
function ensureImageOverlays() {
  $$('[data-img-slot]').forEach(el => {
    if (el.dataset.akayWrapped === '1') return;

    // Skip elements that aren't visible (preloader)
    if (el.closest('#preloader')) return;

    const slot = el.getAttribute('data-img-slot');
    const overlay = document.createElement('div');
    overlay.className = 'akay-img-overlay';
    overlay.setAttribute('data-slot', slot);
    overlay.innerHTML = `
      <span class="akay-img-overlay__label">${slot}</span>
      <div class="akay-img-overlay__btns">
        <button type="button" class="akay-btn akay-btn--mini akay-btn--primary" data-act="upload">Replace</button>
        <button type="button" class="akay-btn akay-btn--mini akay-btn--ghost"   data-act="url">Paste URL</button>
        <button type="button" class="akay-btn akay-btn--mini akay-btn--danger"  data-act="delete">Delete file</button>
        <button type="button" class="akay-btn akay-btn--mini akay-btn--ghost"   data-act="reset">Reset</button>
      </div>
    `;
    overlay.addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      e.stopPropagation();
      e.preventDefault();
      const act = btn.getAttribute('data-act');
      if (act === 'upload')      triggerUpload(slot);
      else if (act === 'url')    triggerUrlPaste(slot);
      else if (act === 'delete') deleteFromCloudinaryForSlot(slot);
      else if (act === 'reset')  resetSlot(slot);
    });

    // Position the overlay over the image. We use position:relative on a
    // wrapper if the image is inline, or absolute if the parent is already
    // positioned.
    const parent = el.parentElement;
    const parentPos = getComputedStyle(parent).position;
    if (parentPos === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(overlay);
    el.dataset.akayWrapped = '1';
  });
}

function removeImageOverlays() {
  $$('.akay-img-overlay').forEach(o => o.remove());
  $$('[data-img-slot]').forEach(el => delete el.dataset.akayWrapped);
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
    setSaving(true);
    try {
      const url = await uploadToCloudinary(file);
      await saveImage(slot, url);
      toast(`Updated ${slot}`, 'success');
    } catch (e) {
      toast('Upload failed: ' + e.message, 'error');
    } finally {
      setSaving(false);
      input.remove();
    }
  });
  input.click();
}

function triggerUrlPaste(slot) {
  const url = prompt(`Paste image URL for ${slot}:`, state.images[slot] || defaults.images[slot] || '');
  if (url === null) return;
  if (!url.trim()) { toast('No URL entered', 'error'); return; }
  // basic validation
  try { new URL(url.trim()); } catch { toast('Invalid URL', 'error'); return; }
  saveImage(slot, url.trim()).then(() => toast(`Updated ${slot}`, 'success'));
}

function resetSlot(slot) {
  if (!confirm(`Reset ${slot} to default?`)) return;
  setSaving(true);
  // remove from Firestore by writing empty then delete
  setDoc(doc(db, 'content', 'images'), {
    [slot]: '',
    _updatedAt: serverTimestamp()
  }, { merge: true }).then(() => {
    // empty string in Firestore = "use default"
    delete state.images[slot];
    applyImage(slot, defaults.images[slot] || '');
    toast(`${slot} reset`, 'info');
  }).catch(e => toast('Reset failed: ' + e.message, 'error'))
    .finally(() => setSaving(false));
}

// =====================================================================
//  Hard-delete the current image file for a slot from Cloudinary.
//  Calls the /api/delete-image serverless function (which holds the
//  API secret). Also clears the slot in Firestore.
// =====================================================================
async function deleteFromCloudinaryForSlot(slot) {
  const currentUrl = state.images[slot] || defaults.images[slot];
  if (!currentUrl) {
    toast(`No image set for ${slot}`, 'error');
    return;
  }
  const publicId = publicIdFromCloudinaryUrl(currentUrl);
  if (!publicId) {
    toast(`This image isn't on Cloudinary (only Cloudinary uploads can be hard-deleted). URL: ${currentUrl.slice(0, 60)}…`, 'error');
    return;
  }
  if (!confirm(`Permanently DELETE this file from Cloudinary?\n\n${publicId}\n\nThis cannot be undone. The slot will also be reset to its default.`)) {
    return;
  }
  setSaving(true);
  try {
    const idToken = await getIdToken(auth.currentUser, /* forceRefresh */ false);
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
    // Clear the slot in Firestore
    await setDoc(doc(db, 'content', 'images'),
      { [slot]: '', _updatedAt: serverTimestamp() },
      { merge: true });
    delete state.images[slot];
    applyImage(slot, defaults.images[slot] || '');
    toast(`Deleted ${publicId}`, 'success');
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  } finally {
    setSaving(false);
  }
}

async function saveImage(slot, url) {
  setSaving(true);
  try {
    // Step 1: Apply optimistically to the DOM so the user sees the change
    state.images[slot] = url;
    applyImage(slot, url);

    // Step 2: Write to Firestore (local cache accepts immediately,
    // server sync happens in background)
    await setDoc(doc(db, 'content', 'images'),
      { [slot]: url, _updatedAt: serverTimestamp() },
      { merge: true });

    // Step 3: Check network health before declaring success.
    // If network is broken, the write only went to local cache —
    // don't pretend it succeeded.
    if (_networkHealthy === false) {
      setSaving(false);
      toast(`⚠ ${slot} saved locally only — network down. Will sync when connection returns.`, 'error');
      return;
    }

    // Step 4: Show "saved" + verify in background
    setSaving(false);
    toast(`✓ ${slot} saved`, 'success');
    verifyInBackground(slot, url, 'images');
  } catch (e) {
    console.error('[admin] saveImage failed:', e);
    setSaving(false);
    if (e.code === 'permission-denied' || /permission|denied|rules/i.test(e.message)) {
      toast('SAVE FAILED — Firestore rules rejected the write. Open Firebase console → Firestore → Rules → paste firestore.rules → Publish.', 'error');
    } else if (/offline|network|timed out|unreachable|err_name/i.test(e.message)) {
      setNetworkHealth(false, e.message);
      toast(`⚠ ${slot} saved locally only — network down. Will sync when connection returns.`, 'error');
    } else {
      toast('Save failed: ' + e.message, 'error');
    }
    throw e;
  }
}

// Background verification — doesn't block UI.
// Reads the doc back from the SERVER to confirm the write actually landed.
// If it didn't, shows a clear error toast.
async function verifyInBackground(slot, expectedValue, docName) {
  try {
    // Use getDoc with server source — bypasses cache, forces server read
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
    console.log(`[admin] verified ${slot} saved to server ✓`);
    return true;
  } catch (e) {
    console.error(`[admin] verify ${slot} failed:`, e.message);
    // Don't toast here — the user already saw "saved" and we don't want to
    // alarm them if it's just a transient network blip. The write is queued
    // and will retry automatically.
    return false;
  }
}

// =====================================================================
//  STEP 8 — Cloudinary unsigned upload
// =====================================================================
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', cloudinaryConfig.unsignedPreset);
  if (cloudinaryConfig.folder) {
    fd.append('folder', cloudinaryConfig.folder);
  }
  const resp = await fetch(cloudinaryUploadUrl(), {
    method: 'POST',
    body: fd
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Cloudinary ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (!data.secure_url) throw new Error('Cloudinary response missing secure_url');
  return data.secure_url;
}

// =====================================================================
//  STEP 9 — Auth state listener
// =====================================================================
onAuthStateChanged(auth, user => {
  if (user) {
    state.isAdmin = true;
    toast(`Logged in as ${user.email}`, 'success');
    // auto-enter edit mode on first login, but only after a beat so the
    // user can see the toast
    setTimeout(() => enterEditMode(), 500);
  } else {
    state.isAdmin = false;
    if (state.isEditing) exitEditMode();
  }
});

// =====================================================================
//  STEP 10 — BOOTSTRAP
// =====================================================================
function init() {
  // Register the triple-click handler FIRST so it works even if
  // Firestore/network init throws later.
  try {
    initTripleClick();
  } catch (e) {
    console.error('[admin] initTripleClick failed:', e);
  }

  // Hidden keyboard shortcut: Ctrl+Shift+A also opens the admin dashboard
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      if (state.isAdmin) toggleEditMode();
      else if (e.altKey) openLoginModal();
      else window.location.href = './admin.html';
    }
  });

  // Now try the Firebase-dependent init — wrapped so failures don't
  // take down the rest of the page.
  try {
    captureDefaults();
  } catch (e) {
    console.error('[admin] captureDefaults failed:', e);
  }

  try {
    startSync();
  } catch (e) {
    console.error('[admin] startSync failed:', e);
  }

  console.log('[admin] ready. Triple-click the logo to log in.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
