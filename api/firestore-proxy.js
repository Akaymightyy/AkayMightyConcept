// /api/firestore-proxy.js  v19
// Updated to point to project `akaymightyconcept` (NOT -6ea63).
// This project has the Firestore database actually created.

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/akaymightyconcept/databases/(default)/documents';

export default async function handler(req, res) {
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

  const url = FIRESTORE_BASE + path + (qs ? (path.includes('?') ? '&' : '?') + qs : '');

  const headers = { 'Content-Type': 'application/json' };
  const firebaseToken = req.headers['x-firebase-token'] || req.query.token;
  if (firebaseToken) {
    headers['Authorization'] = 'Bearer ' + firebaseToken;
  }

  const upstreamOpts = { method: firestoreMethod, headers };

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
