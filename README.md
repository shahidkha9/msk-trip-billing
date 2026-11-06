# MSK Trip Billing

Trip billing app for **MSK Transport Service** — quick trip entry, automatic fares from a rate card, loading/unloading and detention charges, PDF bills, CSV export, and backup/restore. Data syncs between laptop and phone through Supabase.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase · jsPDF

## Setup

See **[SETUP-GUIDE.md](./SETUP-GUIDE.md)** for the full step-by-step guide (Supabase → GitHub → Vercel).

Required environment variables (Vercel → Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Database tables and security rules: run `supabase-setup.sql` once in the Supabase SQL Editor.

## Local development

```bash
cp .env.example .env.local   # then fill in your values
npm install
npm run dev                  # http://localhost:3000
```

## Project structure

```
src/
  app/            layout, page, global styles, web app manifest
  components/     TripBillingApp (login + tabs), EntryTab, RecordsTab,
                  SettingsTab, BackupTab, TripTable, ui
  lib/            types, defaults (rates/charges), utils (totals, formatting),
                  db (Supabase reads/writes), pdf (bill + CSV), supabase client
```
