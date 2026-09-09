// =====================================================================
//  firebase-config.js  v19
//  ---------------------------------------------------------------------
//  Updated to point to project `akaymightyconcept` (NOT -6ea63).
//  This project has the Firestore database actually created.
//
//  This file REPLACES the Firebase SDK with proxy-based equivalents.
//  All calls go through /api/firestore-proxy and /api/firebase-auth-proxy
//  (Vercel serverless functions), bypassing carrier DNS blocks on
//  googleapis.com domains.
// =====================================================================

import {
  proxySignIn,
  proxySignOut,
  proxyOnAuthChanged,
  proxyGetCurrentUser,
  proxyGetIdToken
} from "./auth-proxy-client.js";
import {
  proxyGetDoc,
  proxySetDoc,
  proxyOnSnapshot
} from "./firestore-proxy-client.js";

// ---- serverTimestamp marker ----
export function serverTimestamp() {
  return { __serverTimestamp: true };
}

// ---- Auth compat layer ----
export const auth = {
  currentUser: null,

  signInWithEmailAndPassword: async (email, password) => {
    const result = await proxySignIn(email, password);
    auth.currentUser = result.user;
    return result;
  },

  signOut: async () => {
    proxySignOut();
    auth.currentUser = null;
  },

  onAuthStateChanged: (callback) => {
    return proxyOnAuthChanged((user) => {
      auth.currentUser = user;
      callback(user);
    });
  }
};

auth.currentUser = proxyGetCurrentUser();

// ---- Auth function exports (match Firebase SDK import style) ----
export function signInWithEmailAndPassword(_auth, email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}
export function signOut(_auth) {
  return auth.signOut();
}
export function onAuthStateChanged(_auth, callback) {
  return auth.onAuthStateChanged(callback);
}
export async function getIdToken(_user, forceRefresh) {
  return proxyGetIdToken();
}

// ---- Firestore compat layer ----
export const db = {};

export function doc(_db, collection, id) {
  return { _collection: collection, _id: id };
}

export async function setDoc(docRef, data, options) {
  const cleanData = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && val.__serverTimestamp) continue;
    cleanData[key] = val;
  }
  return proxySetDocSimple(docRef._id, cleanData);
}

export async function getDoc(docRef) {
  const result = await proxyGetDoc(docRef._id);
  return {
    exists: () => result.exists,
    data: () => result.data,
    id: docRef._id,
    ref: docRef
  };
}

export function onSnapshot(docRef, callback, errorCallback) {
  return proxyOnSnapshot(
    docRef._id,
    (snapshot) => {
      callback({
        exists: () => snapshot.exists,
        data: () => snapshot.data,
        id: docRef._id,
        ref: docRef,
        metadata: { fromCache: false, hasPendingWrites: false }
      });
    },
    errorCallback
  );
}

// ---- No-op helpers ----
export function forceOnline() { return Promise.resolve(); }
export function waitForServer(timeoutMs) { return Promise.resolve(); }

// ---- Internal: setDoc (simple, no transforms) ----
async function proxySetDocSimple(docName, data) {
  const token = await proxyGetIdToken();
  if (!token) {
    const err = new Error('Not authenticated — sign in first');
    err.code = 'permission-denied';
    throw err;
  }

  const fields = objToFields(data);
  const body = { fields };

  // CRITICAL: Firestore REST API rejects field paths with special characters
  // (colons, hyphens, etc.) unless they're backtick-quoted in updateMask.
  // Our slot IDs like "img:web-1" contain both ":" and "-".
  // Fix: wrap each field path in backticks if it contains non-alphanumeric chars.
  const fieldPaths = Object.keys(fields);
  const maskParams = fieldPaths.map(f => {
    // If field name contains anything other than [a-zA-Z0-9_], wrap in backticks
    const needsQuoting = !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f);
    const pathValue = needsQuoting ? '`' + f + '`' : f;
    return `updateMask.fieldPaths=${encodeURIComponent(pathValue)}`;
  }).join('&');

  const resp = await fetch('/api/firestore-proxy?path=/content/' + docName + '&method=PATCH&' + maskParams, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-firebase-token': token
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const error = new Error(err.error?.message || `HTTP ${resp.status}`);
    if (resp.status === 403) error.code = 'permission-denied';
    throw error;
  }

  return true;
}

// ---- Helpers ----
function objToFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    fields[key] = valueToFirestore(val);
  }
  return fields;
}

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
    if (val.__serverTimestamp) return { nullValue: null };
    return { mapValue: { fields: objToFields(val) } };
  }
  return { stringValue: String(val) };
}
