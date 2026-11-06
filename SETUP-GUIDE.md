# MSK Trip Billing — Setup Guide (Next.js version)

Ye guide aapko step-by-step batati hai ke software **Vercel** par kaise lagana hai, taake laptop aur mobile dono par **ek hi data** chale.

**Pehli baar kul waqt: 30–45 minute. Sab kuch free hai.**

| Cheez | Kaam |
|---|---|
| **Supabase** | Online database. Aapka sara data yahan save hota hai. |
| **GitHub** | Aapke software ki files yahan rehti hain. |
| **Vercel** | GitHub se files le kar website chalata hai (aapka link). |

> **Pehle wala online version (HTML) bana chuke hain?** Agar aap pichhli guide se Supabase setup kar chuke hain to **Step 1 skip karein**. Same database chalega, aur aapka purana data khud nayi version mein aa jayega. Software khud **Mazda 20 ft** ke rates aur **Detention Rs 2,500** add kar dega.

---

## Step 1 — Supabase (database) banayein

1. **supabase.com** → **Start your project** → GitHub ya email se sign up karein.
2. **New project**:
   - Name: `msk-trip-billing`
   - Database password: mazboot password (likh kar rakh lein)
   - Region: **Singapore** ya **Mumbai**
3. 1–2 minute intezar karein.
4. Left menu → **SQL Editor** → **New query**. Project folder mein `supabase-setup.sql` Notepad mein kholein, **sara** text copy karein, paste karein → **Run**. "Success" aana chahiye.
5. **Apna login banayein:** **Authentication** → **Users** → **Add user** → **Create new user** → email + password daalein → **"Auto Confirm User"** par tick → Create.
6. **Kisi aur ko account banane se rokein:** **Authentication** → **Sign In / Providers** → **"Allow new users to sign up"** ko **OFF** karein → Save.
7. **Do cheezein copy karke Notepad mein rakh lein** — **Project Settings** (⚙️) mein:
   - **Project URL** — jaise `https://abcdxyz.supabase.co` (Data API / General section mein)
   - **Publishable key** — `sb_publishable_...` se shuru hoti hai (API Keys section). Purane projects mein iska naam **anon public** hota hai (`eyJ...`).

   ⚠️ **"secret" ya "service_role" key kabhi copy na karein.**

---

## Step 2 — GitHub par files upload karein

1. **github.com** par account banayein (agar nahi hai).
2. Upar **+** → **New repository**
   - Name: `msk-trip-billing`
   - **Private** chunein
   - Baaqi sab waise hi chhor dein → **Create repository**
3. Nayi page par **"uploading an existing file"** link dabayein.
4. Zip file **extract** karein. `msk-trip-billing` folder **ke andar** jayein, aur andar ki **sari files aur folders** (`src`, `public`, `package.json` waghaira) select karke GitHub page par drag karein.
   - ⚠️ Folder khud drag na karein — uske **andar** ki cheezein drag karein. GitHub par `package.json` sab se upar wali list mein nazar aana chahiye, kisi folder ke andar nahi.
5. Neeche **Commit changes** dabayein.

---

## Step 3 — Vercel par deploy karein

1. **vercel.com** → **Sign Up** → **Continue with GitHub**.
2. **Add New… → Project** → `msk-trip-billing` ke saamne **Import**.
3. **Framework Preset** khud **Next.js** aa jayega. Kuch na badlein.
4. **Environment Variables** section kholein aur **do** variables add karein:

| Key (Name) | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Aapka Project URL (Step 1.7) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Aapki Publishable key (Step 1.7) |

   Naam bilkul aise hi likhein — capital letters aur underscore ( _ ) ke saath. Value ke aage/peechhe space na ho.

5. **Deploy** dabayein. 1–2 minute baad link milega, jaise `https://msk-trip-billing.vercel.app`.

> **"Setup needed" screen aaye?** Iska matlab variables theek se add nahi hue. Vercel → Project → **Settings → Environment Variables** mein check karein → phir **Deployments** → sab se upar wali deployment ke **⋯** → **Redeploy**. (Variables badalne ke baad hamesha Redeploy karna zaroori hai.)

---

## Step 4 — Laptop aur mobile par chalayein

- **Laptop:** link Chrome mein kholein → login → bookmark kar lein.
- **Android:** Chrome mein link → login → menu (⋮) → **Add to Home screen**. App ki tarah icon ban jayega.
- **iPhone:** Safari mein link → Share → **Add to Home Screen**.

Har device par sirf ek dafa login karna hai.

**Bilkul pehli offline file (Trip_Billing.html) ka data laana ho:** purani file kholein → Backup → **Download Backup**. Phir naye software mein → Backup → **Restore Backup** → wo file chunein.

---

## Is version mein kya naya hai

- **Mazda 20 ft** — rate 17 ft se Rs 2,000 zyada: Landhi **8,000**, Korangi **9,500**, SITE **17,000**.
- **Detention** — har trip par checkbox, **+ Rs 2,500**. Rate "Rates & Locations" tab se badal sakte hain.
- PDF bill, Records aur Excel (CSV) mein **Detention** ka alag column aur total.
- Poora software English mein.
- Code Next.js + TypeScript + Tailwind CSS mein — professional aur aage badhane mein aasaan.

---

## Roz ka istemal — zaroori baatein

- **Entry save karne ke liye internet zaroori hai.** Internet na ho to software purana data dikhata hai lekin nayi entry save nahi hoti, aur saaf message deta hai.
- Doosre device par **⟳ Sync** dabayein (ya app dobara kholein — khud sync ho jata hai).
- **Mahine mein ek baar** Backup tab se **Download Backup** karke file Google Drive/WhatsApp par rakh lein.
- **Supabase free plan:** agar project 7 din tak bilkul istemal na ho to "pause" ho jata hai. Roz use karenge to masla nahi. Pause ho jaye to supabase.com par login karke **Restore project** dabayein — data mehfooz rehta hai.

---

## Baad mein code mein tabdeeli

GitHub par file kholein → ✏️ (pencil) → tabdeeli → **Commit changes**. Vercel 1–2 minute mein khud nayi version live kar deta hai.

Kaunsi file kya karti hai:

| File | Kaam |
|---|---|
| `src/lib/defaults.ts` | Default rates, gaariyan, locations, charges |
| `src/components/EntryTab.tsx` | Nayi entry ka form |
| `src/components/RecordsTab.tsx` | Records, filter, PDF/Print/CSV |
| `src/components/SettingsTab.tsx` | Rates & Locations screen |
| `src/components/BackupTab.tsx` | Backup / Restore |
| `src/components/TripBillingApp.tsx` | Login, tabs, database se save/load |
| `src/lib/pdf.ts` | PDF bill ka design |
| `src/lib/utils.ts` | Hisaab (totals), gaari number format |

---

## Masle aur hal

| Masla | Hal |
|---|---|
| Vercel par build fail | Check karein `package.json` GitHub repository ke **sab se upar** hai, kisi folder ke andar nahi (Step 2.4). |
| "Setup needed" screen | Environment Variables check karein, phir **Redeploy** (Step 3). |
| "Wrong email or password" | Supabase → Authentication → Users mein user bana hai aur confirmed hai? |
| "Could not save … check internet" | Internet check karein; Supabase project paused to nahi? |
| Login ke baad "No connection" | `supabase-setup.sql` chalana reh gaya (Step 1.4). Dobara Run karein. |

---

## Apne computer par chalana (optional — seekhne ke liye)

1. **nodejs.org** se Node.js (LTS) install karein.
2. Project folder mein `.env.example` ki copy banayein, naam `.env.local` rakhein, aur apni URL/key daalein.
3. Folder mein terminal kholein:
   ```
   npm install
   npm run dev
   ```
4. Browser mein **http://localhost:3000** kholein.
