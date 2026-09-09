// =====================================================================
//  firebase-config.js  v14
//  ---------------------------------------------------------------------
//  Aggressive reconnection: Firestore SDK gets stuck in "offline" mode
//  after transient failures. This version forces enableNetwork() every
//  15 seconds, on tab focus, and after any "offline" error.
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

setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("[firebase] auth persistence failed:", err.message);
});

// ---- Initialize Firestore with long-polling + cache ----
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    localCache: { kind: 'indexedDB' }
  });
  console.log('[firebase] Firestore initialized (long-polling + IndexedDB)');
} catch (e) {
  console.warn('[firebase] init failed, falling back:', e.message);
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js");
  db = getFirestore(app);
}

// ---- Aggressive reconnection logic ----
let _lastReconnect = 0;
let _isReconnecting = false;

async function forceOnline() {
  if (_isReconnecting) return;
  const now = Date.now();
  if (now - _lastReconnect < 3000) return; // throttle: max once per 3s
  _isReconnecting = true;
  _lastReconnect = now;
  try {
    await enableNetwork(db);
    console.log('[firebase] enableNetwork OK');
  } catch (e) {
    console.warn('[firebase] enableNetwork failed:', e.message);
  } finally {
    _isReconnecting = false;
  }
}

// 1. Force online on page load
forceOnline();

// 2. Heartbeat: reconnect every 15 seconds
setInterval(() => {
  forceOnline();
}, 15000);

// 3. Reconnect when tab regains focus
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('[firebase] tab focused — reconnecting');
    forceOnline();
  }
});

// 4. Reconnect on browser online event
window.addEventListener('online', () => {
  console.log('[firebase] browser online — reconnecting');
  forceOnline();
});
window.addEventListener('offline', () => {
  console.log('[firebase] browser offline');
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
