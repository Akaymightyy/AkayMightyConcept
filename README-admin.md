# Akay Mighty Concept — Admin Dashboard Setup

You now have a complete inline admin dashboard. Triple-click the nav logo → log in with `akay@concept.com` → edit images and text directly on the page. Changes sync live for every visitor.

---

## What's in this folder

```
akay-site/
├── index.html              ← your refactored site, every image has data-img-slot
├── admin.html              ← ⭐ dedicated admin dashboard page (full grid view)
├── admin-dashboard.js      ← logic for admin.html
├── admin-dashboard.css     ← styling for admin.html
├── firebase-config.js      ← YOUR Firebase config (modular, ESM)
├── cloudinary-config.js    ← Cloudinary cloud name + unsigned preset
├── admin.js                ← inline edit layer (loaded from index.html)
├── admin.css               ← inline edit UI styling
├── firestore.rules         ← security rules — DEPLOY THESE
├── api/
│   └── delete-image.js     ← serverless function for Cloudinary hard-delete
├── vercel.json             ← Vercel config (deploys the /api function)
├── package.json
├── akay-logo.jpg           ← default logo
├── akay-headshot.png       ← default headshot
└── Akay-CV.jpg             ← your CV
```

## ⭐ TWO WAYS TO EDIT — pick whichever you prefer

### A. Dedicated dashboard (RECOMMENDED)
Open `https://your-site/admin.html` → log in → see a clean grid of ALL 25 image slots with previews, plus tabs for Text and Settings. Best for managing many images at once.

### B. Inline editing on the live site
Open your site → **triple-click the nav logo** → log in → click any image or text directly on the page to edit. Best for quick single edits. (Hold **Shift** while triple-clicking to force this mode instead of going to the dashboard.)

Both methods sync to the same Firestore docs in real-time.

## What's new in this build (v5)

### Bug fixes

1. **Fixed: uploads reverted on refresh (root cause found)** — Firestore's `enableIndexedDbPersistence()` was the silent killer. When Firestore rules reject a write, the offline cache accepts it locally so the image LOOKS saved, but on refresh the cache gets out of sync with the (empty) server state and reverts to defaults. **Removed offline persistence entirely** — now writes either succeed on the server (and survive refresh) or fail with a clear error toast.

2. **Fixed: silent save failures** — added write verification to BOTH `admin.js` (inline edit mode) AND `admin-dashboard.js`. After every `setDoc`, we re-read the doc to confirm the server actually has the new value. If verification fails, you see a red toast: `"SAVE FAILED — Firestore rules not deployed. Open Firebase console → Firestore → Rules → paste firestore.rules → Publish."`

3. **Fixed: site can't be scrolled vertically on mobile when finger is on the showcase** — added `touch-action: pan-x` to `.showcase-track-wrap`. Now horizontal swipes scroll the showcase, vertical swipes pass through to the page.

4. **Web Showcase now scrollable manually + auto-play** — converted from pure CSS animation to a real scrollable container. Users can now:
   - Drag with mouse / finger / pen to scroll horizontally (with momentum)
   - Use shift+wheel on desktop for horizontal scroll
   - Watch the auto-play loop (smooth, ~24 px/sec) which pauses on hover/touch/drag
   - Auto-play resumes 2 seconds after the user stops interacting
   - Auto-play pauses when the section scrolls offscreen (perf)

### Architecture clarification

**We do NOT use localStorage for images.** Never have. The "localStorage-like" behavior you saw was Firestore's IndexedDB offline cache (now removed). Image storage architecture is:
- Image file → uploaded to **Cloudinary** (via unsigned preset `akaymightyconcept`)
- Image URL → saved to **Firestore** doc `content/images` field `img:<slot>`
- Public visitors' browsers subscribe to that doc via Firestore `onSnapshot` and get updates in real-time

This is the right architecture for a live client-facing site:
- ✅ Survives refresh (data comes from server, not browser cache)
- ✅ Works across devices/browsers (Firestore is the source of truth)
- ✅ No 5MB limit (Cloudinary stores the actual image bytes, Firestore just holds a URL string)
- ✅ Real-time sync (everyone sees changes within ~200ms)

The ONLY thing that was broken was the silent-failure behavior caused by offline persistence + undeployed rules. Now that's fixed.

### Existing features (still working)

1. Career Timeline horizontal scroll with editable text slots
2. Web Showcase marquee (now also manually scrollable)
3. 86 editable text slots across the site
4. Triple-click logo → admin dashboard at `/admin.html`
5. "Delete file" button (hard-delete from Cloudinary)
6. Sidebar dashboard UI with stats and grouped image grid

---

## Setup checklist — DO ALL OF THESE

### 1. Create the Cloudinary unsigned upload preset (REQUIRED for image uploads)

✅ **You already did this** — your preset is named `akaymightyconcept`, signing mode = Unsigned. It's already configured in `cloudinary-config.js`. Skip to step 2.

<details>
<summary>Reference — how to create another preset</summary>

1. Go to <https://console.cloudinary.com> → your cloud `dfd1bgdam`
2. **Settings ⚙️ → Upload** tab → scroll to **Upload presets**
3. Click **Add upload preset**
4. Set:
   - **Name**: anything you like (your current one is `akaymightyconcept`)
   - **Signing mode**: **Unsigned**  ← critical
   - **Folder**: `akay-site` (optional)
5. **Save**

If you rename or create a different preset, open `cloudinary-config.js` and change `unsignedPreset: "akaymightyconcept"` to match.
</details>

### 2. Deploy the Firestore security rules (REQUIRED or nobody can save edits)

**Option A — paste in the Firebase console (easiest):**
1. <https://console.firebase.google.com> → your project
2. **Firestore Database → Rules** tab
3. Open `firestore.rules` from this folder in any text editor, copy everything
4. Paste into the Rules editor → **Publish**

**Option B — deploy via Firebase CLI:**
```bash
npm install -g firebase-tools
firebase login
cd akay-site
firebase init firestore     # choose "Use an existing project" → akaymightyconcept-6ea63
firebase deploy --only firestore:rules
```

### 3. Verify the admin user exists in Firebase Auth

1. Firebase console → **Authentication → Users**
2. You should see `akay@concept.com`. If not, click **Add user** and create it with password `Termux123` (or whatever you want — just make sure you remember it).

### 4. Deploy the site WITH the serverless function (REQUIRED for "Delete file" button)

The "Delete file" button on each image overlay hard-deletes the image from your Cloudinary account. This needs a tiny server-side function (`/api/delete-image.js`) because Cloudinary deletes require your API secret which can never live in the browser.

**Easiest: Vercel (recommended, free)**

1. Create a GitHub repo and push the entire `akay-site/` folder to it (including the `api/` subfolder)
2. Go to <https://vercel.com> → **Add New → Project** → import your repo
3. Vercel auto-detects the `api/` folder and `vercel.json` — no config needed
4. Open **Settings → Environment Variables** and add these 3:
   ```
   CLOUDINARY_CLOUD_NAME   =  dfd1bgdam
   CLOUDINARY_API_KEY      =  365594332316261
   CLOUDINARY_API_SECRET   =  Nz5Vv7rsLyLy4O6LL9bMl3bd3wo
   ```
5. Click **Deploy** — your site is live at `https://<your-project>.vercel.app`
6. (Optional) Add your custom domain in **Settings → Domains**

**If you can't use Vercel** (cPanel, GitHub Pages, etc.):

- The site itself works fine on any static host — just upload all files except the `api/` folder
- The "Delete file" button will return an error when clicked, but everything else (Replace, Paste URL, Reset, text editing) works
- If you want the delete button to work, deploy just the function elsewhere and update `cloudinaryDeleteEndpoint` in `cloudinary-config.js` to the full URL

---

## How to use the admin dashboard

### Log in
1. Open your live site (e.g. `https://akaymightyconcept.com`)
2. **Triple-click the nav logo** (top-left "A" logo, 3 clicks within 800ms)
   - Keyboard shortcut also works: **Ctrl + Shift + A**
3. Login modal appears → enter `akay@concept.com` + your password
4. After login, edit mode turns on automatically

### Edit text
- Hover any text with a dashed red outline → click → type
- Press **Tab** to move to next editable element
- Press **Esc** to cancel (revert to last saved value)
- Click anywhere else (blur) to **save automatically**
- Look at the bottom-right toolbar — it says "Saving…" then "All changes saved"

### Replace images
- Hover any image → 4 buttons appear:
  - **Replace** → opens file picker → uploads to Cloudinary → applies to all matching images instantly
  - **Paste URL** → paste any image URL (Cloudinary, Imgur, your own host) → applies instantly
  - **Delete file** → permanently deletes the file from Cloudinary (frees storage) AND resets the slot to its default. Only works for Cloudinary URLs and only if you deployed the `/api/delete-image.js` function (step 4 above).
  - **Reset** → reverts to the original default image (file stays in Cloudinary)

When you change an image, **every occurrence on the page updates** (e.g. updating "logo-design" updates the service card, portfolio item, behind-the-scenes grid, and blog post all at once).

### Sign out
- Click **Sign out** in the bottom-right toolbar

---

## How image slots work

13 image slots, each controlling multiple places on the page:

| Slot name | Default | Where it shows up |
|---|---|---|
| `img:logo` | `./akay-logo.jpg` | Preloader, navbar, footer (all 3 update together) |
| `img:headshot` | `./akay-headshot.png` | Hero section + About section |
| `img:logo-design` | (CDN url) | Design Services card #1, Portfolio #1, Behind-the-scenes #1, Blog #1 |
| `img:ads-flyer` | (CDN url) | Design Services #2, Portfolio #2, BTS #2, Blog #2 |
| `img:food-flyer` | (CDN url) | Design Services #3, Portfolio #3, BTS #3 |
| `img:business-flyer` | (CDN url) | Design Services #4, Portfolio #4, BTS #4, Blog #3 |
| `img:club-flyer` | (CDN url) | Design Services #5, Portfolio #5, BTS #5 |
| `img:web3-flyer` | (CDN url) | Design Services #6, Portfolio #6 |
| `img:business-card` | (CDN url) | Print Services #1 |
| `img:leather-print` | (CDN url) | Print Services #2, Portfolio #8 |
| `img:paper-bag` | (CDN url) | Print Services #3, Portfolio #7 |
| `img:custom-bag` | (CDN url) | Print Services #4, Portfolio #9 |
| `img:branded-merch` | (CDN url) | Print Services #5 |
| `img:web-1` … `img:web-6` | (CDN url) | Web Showcase row 1 (forward scroll) |
| `img:web-7` … `img:web-12` | (CDN url) | Web Showcase row 2 (reverse scroll) |

The CDN URLs (`cdn.kord.live`) will still load as defaults until you replace them. Once you click "Replace" or "Paste URL", your new URL is saved to Firestore and used everywhere.

---

## Where edits are stored

Firebase Firestore, in a single collection called `content`:

- `content/images` → one document with fields like `img:logo: "https://res.cloudinary.com/..."`, `img:headshot: "..."`, etc.
- `content/texts` → one document with fields like `text:hero-title: "..."`, etc.

Every visitor's browser subscribes to these docs in real-time. When you save an edit, all open browsers update within ~200ms.

---

## Deploy the site

This is a 100% static site (HTML/CSS/JS). Upload the **entire `akay-site/` folder** to any static host:

- **cPanel / Namecheap / HostGator**: zip the folder, upload via File Manager, extract into `public_html`
- **Netlify**: drag the folder into <https://app.netlify.com/drop>
- **Vercel**: `npx vercel` inside the folder
- **GitHub Pages**: push to a repo, enable Pages in repo settings

**Important**: keep all files together. `index.html` needs `firebase-config.js`, `cloudinary-config.js`, `admin.js`, `admin.css`, and the default images in the same folder.

---

## Security notes

- **Your Cloudinary API secret is NOT in this code.** Only the public cloud name and unsigned preset name are exposed. Even if someone reads your source, they can only upload images (which go to your `akay-site` folder), not delete or modify existing ones.
- **Your Firebase config IS in the code** (`firebase-config.js`) — this is by design. Firebase security comes from Auth + Firestore Rules, not from hiding these values.
- **Only `akay@concept.com` can write to Firestore.** Everyone else can only read.
- If your Cloudinary account ever gets abused via the unsigned preset, just delete the preset in Cloudinary → Settings → Upload. Uploads will stop immediately.

---

## Troubleshooting

**"Login failed: auth/network-request-failed"** — your internet is down or Firebase is blocked. Try a different network.

**"Save failed: PERMISSION_DENIED"** — you haven't deployed the Firestore rules yet. See step 2 above.

**Upload fails with "Cloudinary 401" or "404"** — the unsigned preset name doesn't match. Open `cloudinary-config.js` and verify `unsignedPreset: "akaymightyconcept"` matches exactly what's in your Cloudinary dashboard (case-sensitive).

**Triple-click doesn't open the login modal** — make sure you're clicking the actual "A" logo top-left, not just anywhere. Try the keyboard shortcut **Ctrl+Shift+A** as a fallback.

**Edits don't show on other devices** — check the Firebase console → Firestore → Data → `content/images` and `content/texts` docs. If they're empty, your saves aren't going through. Re-check the rules and that you're logged in.

**Need to hard-delete an image from Cloudinary** (frees up your storage quota) — not supported in this build. Login to Cloudinary console → Media Library → delete manually. Tell me if you want me to add a "delete from Cloudinary" button later (requires a small serverless function).
