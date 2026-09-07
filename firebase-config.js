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
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// TODO (optional): getAnalytics was in your snippet — left out here because
// it pulls an extra ~30KB and isn't needed for the admin dashboard. Add it
// back if you want page-view analytics.

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

// Keep the admin logged in across reloads/tabs (within this browser)
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("[firebase] auth persistence failed:", err.message);
});

const db = getFirestore(app);

// Offline cache so edits the admin already loaded still render if the
// network drops mid-session. Failures are non-fatal.
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — fine, just skip persistence.
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support it — fine.
  } else {
    console.warn("[firebase] firestore persistence failed:", err.message);
  }
});

// Export as ES module — admin.js will import these.
export { app, auth, db };
