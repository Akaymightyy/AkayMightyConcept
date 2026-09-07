// =====================================================================
//  cloudinary-config.js
//  ---------------------------------------------------------------------
//  PUBLIC Cloudinary config for the admin dashboard.
//
//  - cloudName        : your Cloudinary cloud name
//  - unsignedPreset   : the name of an UNSIGNED upload preset you create
//                       in the Cloudinary console (Settings → Upload →
//                       Upload presets → Add upload preset → Signing
//                       mode = "Unsigned"). Used by admin.js to upload
//                       images straight from the browser without ever
//                       exposing your API secret.
//
//  The values below are safe to ship in client-side code — an unsigned
//  preset only allows uploads, never deletes or list operations.
// =====================================================================

export const cloudinaryConfig = {
  cloudName: "dfd1bgdam",
  unsignedPreset: "akaymightyconcept",   // ← your unsigned preset (verified in Cloudinary dashboard)
  folder: "akay-site"                    // optional subfolder in your Cloudinary account
};

// Helper: builds the upload endpoint URL.
export function cloudinaryUploadUrl() {
  return `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
}

// Helper: builds the public delivery URL for an uploaded public_id.
export function cloudinaryDeliveryUrl(publicId, transformations = "") {
  const t = transformations ? `${transformations}/` : "";
  return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/${t}${publicId}`;
}

// ---------------------------------------------------------------------
//  Server-side delete endpoint (deployed at /api/delete-image).
//  - On Vercel/Netlify, just use the relative path "/api/delete-image".
//  - If you're hosting on a static-only host (cPanel, GitHub Pages) and
//    deployed the function elsewhere, paste that URL here.
// ---------------------------------------------------------------------
export const cloudinaryDeleteEndpoint = "/api/delete-image";

// Extract Cloudinary public_id from a delivery URL.
// "https://res.cloudinary.com/dafd1bgdam/image/upload/v123/akay-site/abc.jpg"
//   → "akay-site/abc"
export function publicIdFromCloudinaryUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('cloudinary.com')) return null;
    const m = u.pathname.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z]+)?$/);
    return m ? m[1] : null;
  } catch { return null; }
}
