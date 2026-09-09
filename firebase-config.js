// =====================================================================
//  firebase-config.js  v13
//  ---------------------------------------------------------------------
//  FIX: Added experimentalForceLongPolling + experimentalAutoDetectLongPolling
//  to Firestore settings. This forces HTTP long-polling instead of
//  WebSockets, which can bypass DNS/network issues on some ISPs.
//  Also switched to initializeFirestore() with cache settings (the
//  new API that replaces enableIndexedDbPersistence).
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  initializeFirestore,
  enableNetwork,
  waitForPendingWrites
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVU0NiXklVK0XSBSzT418GiLrW1lz0uhw",
  authDomain: "akaymightyconcept-6ea63.firebaseapp.com",
  projectId: "akaymightyconcept-6ea63",
  storageBucket: "akaymightyconcept-6ea63.firebasestorage.app",
  messagingSenderId: "338256804436",
  appId: "1:338256804436:web:664832344c5c7615a54bc1",
  measurementId: "G-PD9KN8F9L9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("[firebase] auth persistence failed:", err.message);
});

// ---- Initialize Firestore with long-polling + cache ----
// experimentalForceLongPolling: uses HTTP long-polling instead of
//   WebSockets. This helps on networks that block/interfere with
//   WebSocket connections (common on some Nigerian ISPs).
// localCache: IndexedDB cache for offline reads (replaces the
//   deprecated enableIndexedDbPersistence).
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    localCache: { kind: 'indexedDB' }
  });
  console.log('[firebase] Firestore initialized with long-polling + IndexedDB cache');
} catch (e) {
  console.warn('[firebase] initializeFirestore failed, falling back to getFirestore:', e.message);
  // Fallback: import getFirestore dynamically
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js");
  db = getFirestore(app);
}

// ---- Force online + expose connection helpers ----
function forceOnline() {
  return enableNetwork(db).catch(e => {
    console.warn('[firebase] enableNetwork failed:', e.message);
  });
}
forceOnline();

window.addEventListener('online', () => {
  console.log('[firebase] browser online — reconnecting Firestore');
  forceOnline();
});
window.addEventListener('offline', () => {
  console.log('[firebase] browser offline — Firestore will queue writes');
});

function waitForServer(timeoutMs = 15000) {
  return Promise.race([
    waitForPendingWrites(db),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timed out waiting for server')), timeoutMs)
    )
  ]);
}

export { app, auth, db, forceOnline, waitForServer };
