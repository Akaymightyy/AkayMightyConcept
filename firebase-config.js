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
//  IMPORTANT (v5 fix): we intentionally do NOT call enableIndexedDbPersistence().
//  Offline persistence was the root cause of the "uploads revert on refresh"
//  bug — when Firestore rules reject a write, the offline cache accepts it
//  locally so the image LOOKS saved, but on refresh the cache gets out of
//  sync with the empty server state and reverts to defaults. Without
//  persistence, writes either succeed on the server (and survive refresh)
//  or fail with a clear error the admin can see.
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

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
// This only persists the AUTH SESSION, not data — totally safe.
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("[firebase] auth persistence failed:", err.message);
});

const db = getFirestore(app);

// NO enableIndexedDbPersistence() — see header comment for why.

export { app, auth, db };
