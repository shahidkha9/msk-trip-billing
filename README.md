# Transport Ledger

Multi-account (SaaS) trip billing and fleet accounting for transporters: trips with automatic fares, customer-wise bills (PDF), customer payments and balances, fleet with owners and drivers, owner payouts, expenses, and reports (trip profit → expenses → net profit, per vehicle, per driver). Self sign-up with a 30-day free trial; the admin activates paid accounts.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Auth + Postgres with row-level security) · jsPDF

## Setup
See **[SETUP-GUIDE.md](./SETUP-GUIDE.md)**.

1. Run `supabase-setup.sql` in the Supabase SQL Editor (safe to re-run; upgrades older installs).
2. Sign up in the app, then run `make-me-admin.sql` with your email.
3. Set env vars (Vercel → Settings → Environment Variables, or `.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
4. Edit product name, support number and price in `src/lib/brand.ts`.

## How access works
- `profiles` row per account (created by a trigger on sign-up) with `trial_ends_at`, `paid_until`, `status`, `is_admin`.
- Row-level security: users read only their own rows; insert/update/delete also require `can_write()` (admin, or trial/paid period active and not suspended).
- Admin uses `admin_list_users()` / `admin_update_user()` (security-definer functions that check `is_admin()`).

## Structure
```
src/lib/        types, defaults + migrations, db (Supabase), access (subscription),
                reports (profit, per vehicle/driver, balances), pdf, utils, brand
src/components/ TripBillingApp (shell), AuthScreens, SetupWizard, EntryTab, RecordsTab,
                CustomersTab, FleetTab, ExpensesTab, PaymentsTab, ReportsTab,
                SettingsTab, BackupTab, AdminTab, TripTable, ui
```

## Local development
```bash
cp .env.example .env.local   # fill in your values
npm install
npm run dev
```
