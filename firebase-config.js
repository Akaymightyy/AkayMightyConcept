// =====================================================================
//  firebase-config.js  v16  (PROXY MODE)
//  ---------------------------------------------------------------------
//  This file REPLACES the Firebase SDK with proxy-based equivalents.
//  All calls go through /api/firestore-proxy and /api/firebase-auth-proxy
//  (Vercel serverless functions), bypassing carrier DNS blocks on
//  googleapis.com domains.
//
//  Exports the SAME API the existing admin.js / admin-dashboard.js expect:
//    auth  — { signInWithEmailAndPassword, signOut, onAuthStateChanged, currentUser }
//    db    — { doc, setDoc, getDoc, onSnapshot }
//    forceOnline, waitForServer — no-ops (kept for backwards compat)
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
// The real Firestore SDK returns a special sentinel value. We use a
// string marker that proxySetDoc recognizes and converts to a
// fieldTransform (setToServerValue: REQUEST_TIME).
export function serverTimestamp() {
  return { __serverTimestamp: true };
}

// ---- Auth compat layer ----
// Matches the Firebase Auth SDK API used by admin.js / admin-dashboard.js
export const auth = {
  currentUser: null,  // updated by onAuthStateChanged

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

// Initialize currentUser from storage
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
// Matches the Firestore SDK API used by admin.js / admin-dashboard.js
// doc(db, 'content', 'images') → { path: 'images' }
export function db_fn() {}  // placeholder, not used

export const db = {
  // doc(db, 'content', 'images') → returns a doc ref object
  // We ignore the first arg (db) and use the last two as collection + id
};

// Helper: create a doc reference. Called as doc(db, 'content', 'images')
export function doc(_db, collection, id) {
  return { _collection: collection, _id: id };
}

// setDoc(docRef, data, options)
// Matches Firebase SDK. The 'merge: true' option is always assumed (we
// always patch, never replace).
export async function setDoc(docRef, data, options) {
  // Strip serverTimestamp markers and track them for fieldTransforms
  const cleanData = {};
  const transforms = [];
  for (const [key, val] of Object.entries(data)) {
    if (val && val.__serverTimestamp) {
      transforms.push({ fieldPath: key, setToServerValue: 'REQUEST_TIME' });
    } else {
      cleanData[key] = val;
    }
  }
  return proxySetDocWithTransforms(docRef._id, cleanData, transforms);
}

// getDoc(docRef)
export async function getDoc(docRef) {
  const result = await proxyGetDoc(docRef._id);
  return {
    exists: () => result.exists,
    data: () => result.data,
    id: docRef._id,
    ref: docRef
  };
}

// onSnapshot(docRef, callback, errorCallback)
// Uses polling (every 3 seconds) instead of WebSockets.
export function onSnapshot(docRef, callback, errorCallback) {
  return proxyOnSnapshot(
    docRef._id,
    (snapshot) => {
      // Wrap to match Firebase SDK snapshot API
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

// ---- No-op helpers (kept for backwards compat) ----
export function forceOnline() {
  return Promise.resolve();
}
export function waitForServer(timeoutMs) {
  return Promise.resolve();
}

// ---- Internal: setDoc with field transforms (serverTimestamp) ----
// Calls the proxy with the proper Firestore REST API format
async function proxySetDocWithTransforms(docName, data, transforms) {
  const token = await proxyGetIdToken();
  if (!token) {
    const err = new Error('Not authenticated — sign in first');
    err.code = 'permission-denied';
    throw err;
  }

  // Convert data to Firestore REST format
  const fields = objToFields(data);
  const body = { fields };
  if (transforms.length) body.transforms = transforms;

  // Build updateMask for merge behavior
  const fieldPaths = Object.keys(fields);
  const maskParams = fieldPaths.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');

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

// ---- Helpers: convert JS values to/from Firestore REST format ----
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
    if (val.__serverTimestamp) return { nullValue: null }; // handled by transforms
    return { mapValue: { fields: objToFields(val) } };
  }
  return { stringValue: String(val) };
}
