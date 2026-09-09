// /api/firestore-proxy.js
// Server-side proxy for Firestore REST API calls.
//
// WHY THIS EXISTS
// --------------
// Some mobile carriers (especially in Nigeria) block or fail to resolve
// direct browser requests to firestore.googleapis.com. This makes all
// Firestore reads/writes fail with ERR_NAME_NOT_RESOLVED or "client is
// offline" — even though the site itself loads fine.
//
// This function runs on Vercel's servers (which have reliable internet)
// and forwards Firestore requests on behalf of the browser. The browser
// calls /api/firestore-proxy (a URL on the SAME domain as the site,
// which the carrier does NOT block) and Vercel calls Google's Firestore
// API reliably.
//
// USAGE
// -----
// GET    /api/firestore-proxy?path=/content/images
// PATCH  /api/firestore-proxy?path=/content/images   body={fields...}
//
// For PATCH/POST, include x-firebase-token header (the user's ID token).

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/akaymightyconcept-6ea63/databases/(default)/documents';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-firebase-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path, method } = req.query;
  if (!path) {
    return res.status(400).json({ message: 'Missing ?path= parameter' });
  }

  const firestoreMethod = (method || req.method || 'GET').toUpperCase();

  // Re-serialize extra query params (e.g. updateMask.fieldPaths)
  const extraParams = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key === 'path' || key === 'method') continue;
    if (Array.isArray(val)) {
      val.forEach(v => extraParams.append(key, v));
    } else {
      extraParams.append(key, val);
    }
  }
  const qs = extraParams.toString();

  // Build the upstream Firestore URL
  const url = FIRESTORE_BASE + path + (qs ? (path.includes('?') ? '&' : '?') + qs : '');

  // Forward the Firebase auth token
  const headers = { 'Content-Type': 'application/json' };
  const firebaseToken = req.headers['x-firebase-token'] || req.query.token;
  if (firebaseToken) {
    headers['Authorization'] = 'Bearer ' + firebaseToken;
  }

  const upstreamOpts = { method: firestoreMethod, headers };

  // Attach body for write operations
  if ((firestoreMethod === 'PATCH' || firestoreMethod === 'POST') && req.body) {
    upstreamOpts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(url, upstreamOpts);
    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch { payload = { raw: text }; }
    return res.status(upstream.status).json(payload);
  } catch (err) {
    return res.status(502).json({
      message: 'Could not reach Firestore via proxy: ' + (err && err.message ? err.message : err),
      error: 'PROXY_ERROR',
    });
  }
}
