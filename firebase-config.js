// =====================================================================
//  firebase-config.js
//  ---------------------------------------------------------------------
//  Exposes a globally-initialized Firebase app + auth + firestore so the
//  rest of the site (admin.js) can `import` them.
//
//  This file contains your PUBLIC firebaseConfig — it is SAFE to ship in
//  client-side code. Security is enforced by Firestore Rules (see
//  firestore.rules) and Firebase Authentication, not by hiding these
//  values.
//
//  v7: Re-enabled offline persistence. The "fake save" bug from v4 was
//  NOT actually caused by persistence — it was caused by not waiting for
//  pending writes to reach the server. The right fix is:
//    • Keep persistence ON  → reads work when network blips happen
//    • Call waitForPendingWrites() after every setDoc → catches real
//      failures (writes that never reach the server) instead of fake
//      successes.
//  Together these give us resilience (mobile networks are flaky) AND
//  correctness (real write verification).
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
  enableNetwork,
  disableNetwork,
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

// Keep the admin logged in across reloads/tabs (within this browser).
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("[firebase] auth persistence failed:", err.message);
});

const db = getFirestore(app);

// ---- Re-enable offline persistence ----
// Reads work from cache when network blips happen (critical on mobile).
// Writes get queued locally and retried automatically.
// We pair this with explicit waitForPendingWrites() in admin.js to verify
// each write actually reaches the server before declaring success.
let _persistenceOk = false;
enableIndexedDbPersistence(db).then(() => {
  _persistenceOk = true;
  console.log('[firebase] IndexedDB persistence enabled');
}).catch(err => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence only works in one tab at a time.
    // Reads still work (just from server), writes still queue.
    console.warn('[firebase] persistence skipped (another tab open)');
  } else if (err.code === 'unimplemented') {
    console.warn('[firebase] persistence not supported by browser');
  } else {
    console.warn('[firebase] persistence failed:', err.message);
  }
});

// ---- Force online + expose connection helpers ----
// Sometimes the Firestore SDK starts in "offline" mode (especially on
// mobile after a network change). We explicitly call enableNetwork() to
// force a reconnect attempt.
function forceOnline() {
  return enableNetwork(db).catch(e => {
    console.warn('[firebase] enableNetwork failed:', e.message);
  });
}
forceOnline();

// Listen for browser online/offline events and reconnect
window.addEventListener('online', () => {
  console.log('[firebase] browser online — reconnecting Firestore');
  forceOnline();
});
window.addEventListener('offline', () => {
  console.log('[firebase] browser offline — Firestore will queue writes');
});

// Wait for all pending writes to reach the server.
// Throws if any write can't be confirmed within the timeout.
function waitForServer(timeoutMs = 15000) {
  return Promise.race([
    waitForPendingWrites(db),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timed out waiting for server (network may be offline)')), timeoutMs)
    )
  ]);
}

export { app, auth, db, forceOnline, waitForServer };
