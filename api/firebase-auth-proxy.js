// /api/firebase-auth-proxy.js
// Server-side proxy for Firebase Identity Toolkit + Secure Token API.
//
// WHY THIS EXISTS
// --------------
// Some mobile carriers block or fail to resolve direct browser requests
// to identitytoolkit.googleapis.com and securetoken.googleapis.com.
// This makes admin sign-in fail on those networks even though the site
// itself loads fine.
//
// This function runs on Vercel's servers (which have reliable internet)
// and forwards auth requests on behalf of the browser.
//
// USAGE
// -----
// POST /api/firebase-auth-proxy  with JSON body:
//   { endpoint: "/accounts:signInWithPassword?key=KEY", body: {...} }
//   { endpoint: "/token?key=KEY", body: {...}, contentType: "application/x-www-form-urlencoded" }

const IDENTITY_BASE = 'https://identitytoolkit.googleapis.com/v1';
const SECURE_TOKEN_BASE = 'https://securetoken.googleapis.com/v1';

// Your Firebase Web API key (this is PUBLIC — it's in your firebase-config.js already)
const FIREBASE_API_KEY = 'AIzaSyDVU0NiXklVK0XSBSzT418GiLrW1lz0uhw';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST is supported' });
  }

  const { endpoint, body, contentType } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ message: 'Missing endpoint in body' });
  }

  // Determine which Google API base to use
  let baseUrl;
  if (endpoint.indexOf('/token') >= 0 || endpoint.indexOf('securetoken') >= 0) {
    baseUrl = SECURE_TOKEN_BASE;
  } else {
    baseUrl = IDENTITY_BASE;
  }

  // Auto-append API key if not present
  let finalEndpoint = endpoint;
  if (!finalEndpoint.includes('key=')) {
    finalEndpoint += (finalEndpoint.includes('?') ? '&' : '?') + 'key=' + FIREBASE_API_KEY;
  }

  const url = baseUrl + finalEndpoint;
  const ct = contentType || 'application/json';

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': ct },
      body: typeof body === 'string' ? body : JSON.stringify(body || {}),
    });

    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch { payload = { raw: text }; }

    return res.status(upstream.status).json(payload);
  } catch (err) {
    return res.status(502).json({
      message: 'Could not reach Firebase Auth via proxy: ' + (err && err.message ? err.message : err),
      error: 'PROXY_ERROR',
    });
  }
}
