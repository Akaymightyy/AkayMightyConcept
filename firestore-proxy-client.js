// =====================================================================
//  firestore-proxy-client.js
//  ---------------------------------------------------------------------
//  Drop-in replacement for Firestore SDK that uses the /api/firestore-proxy
//  serverless function instead of calling firestore.googleapis.com
//  directly. This bypasses DNS/network issues on Nigerian mobile carriers.
//
//  The browser calls /api/firestore-proxy (same domain as the site,
//  which carriers don't block). Vercel's server then calls Google's
//  Firestore API reliably.
//
//  Public API (matches what admin.js / admin-dashboard.js need):
//    proxyGetDoc('images')           → { exists, data }
//    proxySetDoc('images', data)     → true
//    subscribeDoc('images', cb)      → unsubscribe function (polls every 3s)
// =====================================================================

const PROXY_URL = '/api/firestore-proxy';

// Get the current user's Firebase ID token (for authenticated writes)
async function getIdToken() {
  // Firebase Auth stores the user in localStorage. We can extract the token
  // from there without importing the auth SDK.
  try {
    // The Firebase Auth SDK stores user info in localStorage under various keys.
    // We try the most common patterns.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('firebase:authUser:') && key.includes('akaymightyconcept-6ea63')) {
        const stored = JSON.parse(localStorage.getItem(key));
        if (stored && stored.stsTokenManager && stored.stsTokenManager.accessToken) {
          // Check if token is still valid
          const expiresAt = stored.stsTokenManager.expirationTime;
          if (expiresAt && Date.now() < expiresAt) {
            return stored.stsTokenManager.accessToken;
          }
          // Token expired — try to refresh via proxy
          if (stored.stsTokenManager.refreshToken) {
            const fresh = await refreshIdToken(stored.stsTokenManager.refreshToken);
            if (fresh) {
              // Update stored token
              stored.stsTokenManager.accessToken = fresh.id_token;
              stored.stsTokenManager.refreshToken = fresh.refresh_token;
              stored.stsTokenManager.expirationTime = Date.now() + (parseInt(fresh.expires_in) * 1000);
              localStorage.setItem(key, JSON.stringify(stored));
              return fresh.id_token;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[proxy] getIdToken failed:', e.message);
  }
  return null;
}

async function refreshIdToken(refreshToken) {
  try {
    const resp = await fetch('/api/firebase-auth-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: '/token',
        body: 'grant_type=refresh_token&refresh_token=' + refreshToken,
        contentType: 'application/x-www-form-urlencoded'
      })
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    console.warn('[proxy] token refresh failed:', e.message);
    return null;
  }
}

// Convert a Firestore REST API document to a plain JS object
function fieldsToObj(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    obj[key] = valueFromFirestore(val);
  }
  return obj;
}

function valueFromFirestore(val) {
  if (val === null) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.timestampValue !== undefined) return new Date(val.timestampValue);
  if (val.arrayValue !== undefined) {
    return (val.arrayValue.values || []).map(valueFromFirestore);
  }
  if (val.mapValue !== undefined) {
    return fieldsToObj(val.mapValue.fields || {});
  }
  if (val.nullValue !== undefined) return null;
  return val;
}

// Convert a plain JS value to Firestore REST API format
function valueToFirestore(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(valueToFirestore) } };
  }
  if (typeof val === 'object') {
    return { mapValue: { fields: objToFields(val) } };
  }
  return { stringValue: String(val) };
}

function objToFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    fields[key] = valueToFirestore(val);
  }
  return fields;
}

// ---- Public API ----

// Read a document from content/{name}
export async function proxyGetDoc(docName) {
  try {
    const resp = await fetch(`${PROXY_URL}?path=/content/${docName}`);
    if (resp.status === 404) {
      return { exists: false, data: {} };
    }
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }
    const doc = await resp.json();
    return { exists: true, data: fieldsToObj(doc.fields || {}) };
  } catch (e) {
    throw new Error('proxyGetDoc failed: ' + e.message);
  }
}

// Write (merge) a document to content/{name}
export async function proxySetDoc(docName, data) {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated — sign in first');
  }

  // Build the Firestore REST API patch body
  // We use fieldTransforms for serverTimestamp
  const fields = objToFields(data);
  const body = {
    fields,
    transforms: data._updatedAt === 'SERVER_TIMESTAMP'
      ? [{ fieldPath: '_updatedAt', setToServerValue: 'REQUEST_TIME' }]
      : undefined
  };
  delete fields._updatedAt;

  // Build updateMask for merge behavior (only update the fields we're changing)
  const fieldPaths = Object.keys(fields);
  const maskParams = fieldPaths.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');

  const resp = await fetch(`${PROXY_URL}?path=/content/${docName}&method=PATCH&${maskParams}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-firebase-token': token
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  return true;
}

// Polling-based "real-time" subscription.
// Firestore SDK uses WebSockets, but those are unreliable on mobile.
// We poll every 3 seconds instead — for admin editing, this is fine.
export function proxyOnSnapshot(docName, callback, onError) {
  let active = true;
  let lastData = null;

  async function poll() {
    if (!active) return;
    try {
      const { exists, data } = await proxyGetDoc(docName);
      // Only fire callback if data actually changed
      const serialized = JSON.stringify(data);
      if (serialized !== lastData) {
        lastData = serialized;
        callback({ exists, data });
      }
    } catch (e) {
      if (onError) onError(e);
    }
    if (active) {
      setTimeout(poll, 3000);
    }
  }

  poll();

  return () => { active = false; };
}
