# Akay Mighty Concept — Admin Dashboard Setup

You now have a complete inline admin dashboard. Triple-click the nav logo → log in with `akay@concept.com` → edit images and text directly on the page. Changes sync live for every visitor.

---

## What's in this folder

```
akay-site/
├── index.html              ← your refactored site, every image now has a data-img-slot
├── firebase-config.js      ← YOUR Firebase config (modular, ESM)
├── cloudinary-config.js    ← Cloudinary cloud name + unsigned preset
├── admin.js                ← the brain (login, edit mode, sync, uploads)
├── admin.css               ← admin UI styling (dark/red, matches your theme)
├── firestore.rules         ← security rules — DEPLOY THESE
├── akay-logo.jpg           ← default logo (kept as fallback)
├── akay-headshot.png       ← default headshot
└── Akay-CV.jpg             ← your CV
```

---

## Setup checklist — DO ALL OF THESE

### 1. Create the Cloudinary unsigned upload preset (REQUIRED for image uploads)

1. Go to <https://console.cloudinary.com> → your cloud `dfd1bgdam`
2. **Settings ⚙️ → Upload** tab → scroll to **Upload presets**
3. Click **Add upload preset**
4. Set:
   - **Name**: `akay_unsigned`  ← must match what's in `cloudinary-config.js`
   - **Signing mode**: **Unsigned**  ← critical
   - **Folder**: `akay-site` (optional)
5. **Save**

If you name it something else, open `cloudinary-config.js` and change line `unsignedPreset: "akay_unsigned"` to your name.

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
- Hover any image → 3 buttons appear:
  - **Replace** → opens file picker → uploads to Cloudinary → applies to all matching images instantly
  - **Paste URL** → paste any image URL (Cloudinary, Imgur, your own host) → applies instantly
  - **Reset** → reverts to the original default image

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

**Upload fails with "Cloudinary 401" or "404"** — the unsigned preset name doesn't match. Open `cloudinary-config.js` and verify `unsignedPreset` matches exactly what you created in Cloudinary (case-sensitive).

**Triple-click doesn't open the login modal** — make sure you're clicking the actual "A" logo top-left, not just anywhere. Try the keyboard shortcut **Ctrl+Shift+A** as a fallback.

**Edits don't show on other devices** — check the Firebase console → Firestore → Data → `content/images` and `content/texts` docs. If they're empty, your saves aren't going through. Re-check the rules and that you're logged in.

**Need to hard-delete an image from Cloudinary** (frees up your storage quota) — not supported in this build. Login to Cloudinary console → Media Library → delete manually. Tell me if you want me to add a "delete from Cloudinary" button later (requires a small serverless function).
