# What changed — v6

## 1. Fixed the fake/duplicate portfolio images
All 25 image slots (`img:web-1`...`img:web-12`, the 6 design-service samples, the 5 print-service samples) now
point to 25 distinct placeholder photos instead of the same 11 images being reused across different labeled
projects (e.g. "Chardonic Oil & Gas" and "Nova Creatives" no longer show the identical picture).

Placeholders use `picsum.photos` (free, royalty-free, no copyright risk) — they're neutral filler, not real
screenshots. **Every one of them is swappable from your admin dashboard exactly like before** — nothing about
the editing workflow changed. The two real case studies (Tawakkal TUFC, AJB Autos) also got their own distinct
placeholder now instead of sharing an image with a flyer sample — **replace those two first** since they're real,
named, verifiable clients and deserve real screenshots.

## 2. Added a Pricing section
New "Packages" section between Web Projects and Print Services (also added to nav — desktop, mobile, footer):
Landing Page / Full Website / Brand + Print, each with turnaround time and feature list.

**The prices I put in (₦50,000 / ₦150,000 / ₦35,000) are placeholders — I don't know your actual rates.**
Every number and word in that section is editable as text via your admin dashboard (auto-discovered, no code
changes needed) — go update them to your real prices before this goes live.

## 3. Tightened the About section
Condensed two generic paragraphs into a shorter, more specific story, and fixed the "4+ Years of Excellence"
badge that contradicted the "8+ years" claim elsewhere on the page — both now say 8+, matching your career
timeline (2017–present) and the stats counter. Also made the About paragraphs and badge editable via
data-text-slot, which they weren't before.

## 4. The upload/refresh problem
I read through `admin.js`, `admin-dashboard.js`, and `firebase-config.js` line by line looking for the actual
bug. **I didn't find one.** The code already:
- Removed `enableIndexedDbPersistence()` (the real root cause of the old "reverts on refresh" bug)
- Verifies every save by re-reading it from the server before confirming success
- Shows a red toast naming the exact failure if a save doesn't stick

Nothing here was left broken in code — which means if uploads are still reverting for you, it's almost
certainly a **deployment/config issue**, not a code issue. Check these in order:

1. **Firestore rules published?** Firebase Console → Firestore Database → Rules → paste `firestore.rules` →
   Publish. This is the #1 cause — undeployed rules silently reject every write.
2. **Admin user exists?** Firebase Console → Authentication → Users → confirm `akay@concept.com` is there.
3. **Same Firebase project everywhere?** Confirm `firebase-config.js` wasn't swapped for a different project
   between your local copy and what's actually deployed live.
4. **Watch for the toast.** Try an upload — if it fails, you'll now see exactly why (e.g. "SAVE FAILED —
   Firestore rules not deployed") instead of a silent revert.

If you go through that checklist and it's still broken, tell me the exact error text from the toast/console —
that'll tell us precisely what's failing instead of guessing.

## Files in this delivery
- `index.html` — updated (images, pricing section, about section)
- Everything else (`admin.js`, `admin-dashboard.js`, `firebase-config.js`, `cloudinary-config.js`,
  `firestore.rules`, `admin.html`, `admin.css`, `admin-dashboard.css`, `api/delete-image.js`, `vercel.json`,
  `package.json`) is **unchanged** — re-use your existing copies of those, only replace `index.html`.
