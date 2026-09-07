// =====================================================================
//  /api/delete-image.js
//  ---------------------------------------------------------------------
//  Vercel / Netlify serverless function.
//  Hard-deletes an image from Cloudinary (using the API secret which
//  NEVER appears in the browser).
//
//  SECURITY
//    1. Receives the admin's Firebase ID token in the Authorization header.
//    2. Verifies it via Google identityToolkit REST endpoint (no SDK deps).
//    3. Only allows the request through if the signed-in email is
//       "akay@concept.com" (your single admin).
//    4. Calls Cloudinary's destroy API server-side.
//
//  REQUIRED ENV VARS (set on Vercel/Netlify dashboard → Settings → Env):
//    CLOUDINARY_CLOUD_NAME   = dfd1bgdam
//    CLOUDINARY_API_KEY      = 365594332316261
//    CLOUDINARY_API_SECRET   = Nz5Vv7rsLyLy4O6LL9bMl3bd3wo
//
//  DEPLOY (recommended — Vercel):
//    1. Push the akay-site folder to a GitHub repo
//    2. Import the repo on https://vercel.com → done
//    3. Add the 3 env vars above in Vercel → Settings → Environment Variables
//
//  CALL FROM BROWSER (admin.js does this for you):
//    fetch('/api/delete-image', {
//      method: 'POST',
//      headers: { 'Content-Type': 'application/json',
//                 'Authorization': 'Bearer <firebase-id-token>' },
//      body: JSON.stringify({ publicId: 'akay-site/abc123' })
//    })
// =====================================================================

const crypto = require('crypto');

const ADMIN_EMAIL = 'akay@concept.com';

// ---------- Firebase ID-token verification via REST (no SDK deps) ----------
async function verifyFirebaseToken(idToken) {
  const verifyUrl = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo';
  const resp = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Token verify failed: ${resp.status} ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const user = data.users && data.users[0];
  if (!user) throw new Error('No user for token');
  return {
    email: user.email,
    emailVerified: !!user.emailVerified,
    localId: user.localId
  };
}

// ---------- Cloudinary destroy (signed server-side) ----------
async function deleteFromCloudinary(publicId) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary env vars missing on server');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');

  const body = new URLSearchParams();
  body.append('public_id', publicId);
  body.append('signature', signature);
  body.append('api_key', apiKey);
  body.append('timestamp', String(timestamp));

  const resp = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    { method: 'POST', body }
  );
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Cloudinary destroy ${resp.status}: ${t.slice(0, 200)}`);
  }
  return await resp.json();
}

// Extract public_id from a Cloudinary delivery URL.
// URL: https://res.cloudinary.com/<cloud>/image/upload/[v123/]<public_id>.<ext>
function publicIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('cloudinary.com')) return null;
    const m = u.pathname.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z]+)?$/);
    return m ? m[1] : null;
  } catch { return null; }
}

// =====================================================================
//  Handler (Vercel-style — works on Netlify too)
// =====================================================================
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const userInfo = await verifyFirebaseToken(token);
    if (userInfo.email !== ADMIN_EMAIL || !userInfo.emailVerified) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }

    const { publicId, url } = req.body || {};
    const finalPublicId = publicId || (url ? publicIdFromUrl(url) : null);
    if (!finalPublicId) {
      return res.status(400).json({ error: 'publicId or url required' });
    }

    const result = await deleteFromCloudinary(finalPublicId);
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error('[delete-image]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
