// /api/firebase-auth-proxy.js  v19
// Updated with new Firebase API key for project `akaymightyconcept`.

const IDENTITY_BASE = 'https://identitytoolkit.googleapis.com/v1';
const SECURE_TOKEN_BASE = 'https://securetoken.googleapis.com/v1';

const FIREBASE_API_KEY = 'AIzaSyBpyyasdx-xwp9vyf-XpcFgXmzAWjGJgvA';

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

  let baseUrl;
  if (endpoint.indexOf('/token') >= 0 || endpoint.indexOf('securetoken') >= 0) {
    baseUrl = SECURE_TOKEN_BASE;
  } else {
    baseUrl = IDENTITY_BASE;
  }

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
