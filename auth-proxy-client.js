// =====================================================================
//  auth-proxy-client.js
//  ---------------------------------------------------------------------
//  Login + auth-state management via the /api/firebase-auth-proxy
//  serverless function. Bypasses carrier DNS blocks on
//  identitytoolkit.googleapis.com and securetoken.googleapis.com.
//
//  Public API:
//    proxySignIn(email, password)   → { user } or throws
//    proxySignOut()                 → void
//    proxyGetCurrentUser()          → { uid, email, idToken } | null
//    proxyOnAuthChanged(cb)         → unsubscribe function
//    proxyGetIdToken()              → string | null
// =====================================================================

const AUTH_PROXY_URL = '/api/firebase-auth-proxy';
const FIREBASE_API_KEY = 'AIzaSyDVU0NiXklVK0XSBSzT418GiLrW1lz0uhw';
const STORAGE_KEY = 'akay_auth_user';

// ---- Internal: store/retrieve user from localStorage ----
function storeUser(userData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  notifyAuthListeners(userData);
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEY);
  notifyAuthListeners(null);
}

// ---- Auth state listeners ----
const _listeners = [];
function notifyAuthListeners(user) {
  _listeners.forEach(cb => {
    try { cb(user); } catch (e) { console.warn('[auth-proxy] listener error:', e.message); }
  });
}

export function proxyOnAuthChanged(callback) {
  _listeners.push(callback);
  // Fire immediately with current state
  try { callback(getStoredUser()); } catch (e) {}
  return () => {
    const i = _listeners.indexOf(callback);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

// ---- Sign in with email/password via proxy ----
export async function proxySignIn(email, password) {
  const resp = await fetch(AUTH_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: `/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      body: {
        email,
        password,
        returnSecureToken: true
      }
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const code = err.error?.message?.toLowerCase().replace(/_/g, '-') || 'unknown';
    const map = {
      'invalid-email': 'That email address is malformed.',
      'email-not-found': 'No account found with that email.',
      'invalid-password': 'Wrong password. Try again.',
      'invalid-login-credentials': 'Wrong email or password.',
      'user-disabled': 'This account has been disabled.',
      'too-many-requests': 'Too many attempts. Wait a minute and try again.',
      'network-request-failed': 'Network error — check your connection.'
    };
    throw { code: 'auth/' + code, message: map[code] || err.error?.message || 'Login failed' };
  }

  const data = await resp.json();
  const userData = {
    uid: data.localId,
    email: data.email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (parseInt(data.expiresIn) * 1000)
  };
  storeUser(userData);
  return { user: userData };
}

// ---- Sign out ----
export function proxySignOut() {
  clearStoredUser();
}

// ---- Get current user ----
export function proxyGetCurrentUser() {
  return getStoredUser();
}

// ---- Get valid ID token (refresh if expired) ----
export async function proxyGetIdToken() {
  const user = getStoredUser();
  if (!user) return null;

  // If token still valid, use it
  if (user.expiresAt && Date.now() < user.expiresAt - 60000) {
    return user.idToken;
  }

  // Token expired — refresh via proxy
  if (user.refreshToken) {
    try {
      const resp = await fetch(AUTH_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `/token?key=${FIREBASE_API_KEY}`,
          body: 'grant_type=refresh_token&refresh_token=' + user.refreshToken,
          contentType: 'application/x-www-form-urlencoded'
        })
      });
      if (resp.ok) {
        const fresh = await resp.json();
        const updated = {
          ...user,
          idToken: fresh.id_token,
          refreshToken: fresh.refresh_token,
          expiresAt: Date.now() + (parseInt(fresh.expires_in) * 1000)
        };
        storeUser(updated);
        return updated.idToken;
      }
    } catch (e) {
      console.warn('[auth-proxy] token refresh failed:', e.message);
    }
  }

  // Refresh failed — sign out
  clearStoredUser();
  return null;
}

// ---- On page load, check if we have a valid stored user ----
// (This makes the dashboard remember you across refreshes)
