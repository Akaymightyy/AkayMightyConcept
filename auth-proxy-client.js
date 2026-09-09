// =====================================================================
//  auth-proxy-client.js  v19
//  ---------------------------------------------------------------------
//  Updated with new Firebase API key for project `akaymightyconcept`.
// =====================================================================

const AUTH_PROXY_URL = '/api/firebase-auth-proxy';
const FIREBASE_API_KEY = 'AIzaSyBpyyasdx-xwp9vyf-XpcFgXmzAWjGJgvA';
const STORAGE_KEY = 'akay_auth_user';

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

const _listeners = [];
function notifyAuthListeners(user) {
  _listeners.forEach(cb => {
    try { cb(user); } catch (e) { console.warn('[auth-proxy] listener error:', e.message); }
  });
}

export function proxyOnAuthChanged(callback) {
  _listeners.push(callback);
  try { callback(getStoredUser()); } catch (e) {}
  return () => {
    const i = _listeners.indexOf(callback);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

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

export function proxySignOut() {
  clearStoredUser();
}

export function proxyGetCurrentUser() {
  return getStoredUser();
}

export async function proxyGetIdToken() {
  const user = getStoredUser();
  if (!user) return null;

  if (user.expiresAt && Date.now() < user.expiresAt - 60000) {
    return user.idToken;
  }

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

  clearStoredUser();
  return null;
}
