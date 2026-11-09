# Transport Ledger — Setup & Upgrade Guide

Ye software ab ek **bechne wala product** hai: har transporter apna account khud bana sakta hai, 30 din free trial chalata hai, aur aap **Admin** panel se payment milne par account chalu karte hain.

| Cheez | Kaam |
|---|---|
| **Supabase** | Database + login. Har account ka data alag aur mehfooz. |
| **GitHub** | Code yahan rehta hai. |
| **Vercel** | Website chalata hai (aapka link). |

---

## A. Aap pehle se chala rahe hain (MSK) → UPGRADE — 5 qadam

Aapka sara purana data (trips, expenses) mehfooz rahega aur khud naye system mein aa jayega:
- "Yunus Textile Mills Limited" khud ek **Customer** ban jayega, aur purani saari trips us ke naam ho jayengi.
- YTM-01 / YTM-07 aapki "My place" (base) locations rahengi.

**1. Database update (Supabase)**
Supabase → **SQL Editor** → **New query** → `supabase-setup.sql` ka **sara** text paste → **Run** → "Success" aana chahiye.
(Ye file dobara chalana bhi safe hai.)

**2. Khud ko Admin banayein**
`make-me-admin.sql` kholein → `YOUR-EMAIL@example.com` ki jagah **apna login email** likhein → SQL Editor mein paste → **Run**.
"Success. 1 row" aana chahiye. Agar "0 rows" aaye to email ghalat hai (Authentication → Users mein check karein).

**3. Sign-up chalu karein** ⚠️ (pehle hum ne band kiya tha)
Supabase → **Authentication → Sign In / Providers** →
- **Allow new users to sign up** → **ON**
- **Email** provider → **Confirm email** → shuru mein **OFF** rakhein (neeche "Emails" section dekhein) → **Save**

**4. Password-reset link ka address**
Supabase → **Authentication → URL Configuration** →
- **Site URL**: apna Vercel link, jaise `https://msk-trip-billing.vercel.app`
- **Redirect URLs** → **Add URL** → wohi link, aur `http://localhost:3000` bhi → **Save**

**5. Code update + upload**
Apne project folder mein **purana `src` folder pehle DELETE karein** (sirf copy-replace na karein — purani `ProfitTab.tsx` file reh gayi to Vercel build fail ho jayega). Phir zip ka naya **`src`** folder paste karein. Saath mein `supabase-setup.sql`, `make-me-admin.sql`, `SETUP-GUIDE.md`, `README.md` aur `public/icon.svg` bhi copy karein, aur purani `expenses-setup.sql` delete kar dein.
⚠️ `.env.local`, `node_modules`, `.git` ko **mat chhuein**.
```
npm run dev
```
Test karein (http://localhost:3000), phir:
```
git add .
git commit -m "SaaS: sign-up, customers, fleet, reports, admin"
git push
```

> **Pehle `src/lib/brand.ts` zaroor badlein** (neeche section C).

---

## B. Bilkul naya setup (naye Supabase project ke saath)

1. **supabase.com** → New project (Region: Singapore / Mumbai).
2. **SQL Editor** → `supabase-setup.sql` paste → **Run**.
3. Apni **website par Sign up** karein (apne business ke naam se).
4. `make-me-admin.sql` mein apna email likh kar **Run** karein → aap Admin ban gaye.
5. Section A ke qadam **3 aur 4** (sign-up ON, URL Configuration).
6. **Vercel** → Project → Settings → **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Publishable key (`sb_publishable_...`) — **kabhi bhi secret/service_role key nahi**
   - Phir **Deployments → Redeploy**

---

## C. Apne product ki details — `src/lib/brand.ts`

Ye ek hi file hai jahan aapke product ka naam aur contact likha hai. Login page, sign-up page aur "trial khatam" message par yahi nazar aata hai:

```ts
export const PRODUCT_NAME = "Transport Ledger";   // apne product ka naam
export const SUPPORT_PHONE = "03XX-XXXXXXX";       // ⚠️ apna WhatsApp number zaroor daalein
export const PRICE_TEXT = "Rs 1,000 per month";     // apni qeemat
export const PAYMENT_METHODS = "JazzCash / Easypaisa / Bank transfer";
```

---

## D. Customer ko bechne ka tareeqa (roz ka kaam)

1. Transporter ko apna link dein → woh **"Create a free account"** se khud sign-up karta hai.
2. 3-qadam **Setup Wizard**: business naam → gaariyon ki types + charges → pehla customer + rates.
3. **30 din free.** Upar banner mein din ginte rehte hain aur aapka number/qeemat dikhti hai.
4. Woh aapko JazzCash/Easypaisa par paisa bhejta hai → aap **👑 Admin** tab → uski line mein **+1 month** (ya +3 / +12) dabate hain. Bas.
5. Paisa na aaye to trial/subscription khatam hote hi account **read-only** ho jata hai: data dekh aur download kar sakta hai, nayi entry nahi. (Ye rule **database** mein laga hai, sirf screen par nahi.)
6. **Note** button se likh lein: "5 Nov — Rs 1000 JazzCash".

---

## E. Software mein kya hai

| Tab | Kaam |
|---|---|
| ➕ **New Trip** | Customer chunein, gaari number likhein → fleet se type, driver aur owner khud bhar jata hai. Owner ka hissa (%) bhi khud. |
| 📋 **Trips & Bills** | Customer-wise filter, PDF bill (customer ka naam + address), Print, Excel. Bill par owner/aapka margin **nahi** dikhta. |
| 🏢 **Customers** | Har company: kitna bill, kitna mila, **kitna baqi**. Payment receive karein (cash/cheque), statement Excel. |
| 🚚 **Fleet & Drivers** | Har gaari: owner (aap / abbu / bhai / bahar wala + %), driver, phone, salary. **Pay salary** button → expense mein chala jata hai. |
| 💸 **Expenses** | Har kharcha; gaari ke hisaab se filter. |
| 🤝 **Owner Payments** | Kis owner ka kitna baqi, **Mark Paid** / **Mark all paid**. |
| 📊 **Reports** | ① **Trip Profit** (income − owners) ② **Expenses** ③ **Net Profit** — aur **har gaari** aur **har driver** ka alag hisaab. |
| ⚙️ **Settings** | Account/plan, password badlein, business details, charges, vehicle types, rate card, locations ("My place"), expense types. |
| 💾 **Backup** | Sara data ek file mein download/restore. |
| 👑 **Admin** | Sirf aap: saare accounts, trial/paid status, +1/+3/+12 months, suspend, note. |

---

## F. Zaroori baatein jo bechne se pehle jaan lein

- **Emails:** Supabase ka muft email system bohat kam emails bhejta hai (ghante mein sirf chand). Isliye shuru mein "Confirm email" **OFF** rakhein. Jab customers barhein to free **Resend** (resend.com) jaisa SMTP jor dein: Supabase → Authentication → **Emails → SMTP Settings**. Tab "Confirm email" ON kar sakte hain aur password-reset emails bharosemand ho jayengi.
- **Supabase free plan:** 500 MB database (hazaron trips ke liye kaafi). Agar poore project mein **7 din koi activity na ho** to pause ho jata hai. Jab paying customers aa jayein, **Pro plan ($25/month)** lein: pause nahi hota aur roz ka automatic backup milta hai. Ye aapki zimmedari hai kyunki doosron ka data aapke paas hai.
- **Password bhool jaye:** customer khud "Forgot password?" se reset kar sakta hai (email zaroori). Aap Supabase → Authentication → Users se bhi user ka password badal sakte hain.
- **Privacy:** customers ko seedha batayein ke unka data sirf unhe nazar aata hai, aap kisi ko nahi dete, aur woh kabhi bhi Backup se download kar sakte hain.

---

## G. Masle aur hal

| Masla | Hal |
|---|---|
| "Database update needed" screen | `supabase-setup.sql` chalana reh gaya → Section A, qadam 1. |
| Admin tab nazar nahi aata | `make-me-admin.sql` mein email theek likh kar chalayein, phir ⟳ Sync / log out-in. |
| Naya user sign-up nahi kar pa raha | "Allow new users to sign up" ON? (A-3) |
| Sign-up ke baad "check your email" aur email nahi aayi | "Confirm email" OFF karein (A-3) ya SMTP lagayein (F). |
| Reset link localhost ya ghalat jagah khulta hai | URL Configuration (A-4). |
| "Your account cannot save right now" | Trial/subscription khatam → Admin se +1 month. |
| "Setup needed" screen | Vercel Environment Variables + Redeploy (B-6). |
| Build error: `ProfitTab` / `saveTrip` / `expensesReady` | Purana `src` folder delete kiye baghair naya copy kiya. `src/components/ProfitTab.tsx` delete karein (A-5). |

---

## H. Apne computer par chalana
```
npm install
npm run dev
```
`.env.local` mein do lines (URL aur Publishable key) honi chahiyein. Browser: **http://localhost:3000**
