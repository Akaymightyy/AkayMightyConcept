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
  unsignedPreset: "akay_unsigned",   // ← change if you named it differently
  folder: "akay-site"                // optional subfolder in your Cloudinary account
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
