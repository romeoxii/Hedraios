# Hedraios

Daily documentation + faith tracking. A minimal, calm, offline-first PWA:
multiple journal entries per day (body + mood + tags), a prayer tracker
(active/answered), and a scripture reading log — all synced to Supabase.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4, Framer Motion, date-fns
- Dexie (IndexedDB, offline-first source of truth) + Supabase (auth + sync)
- vite-plugin-pwa (installable, offline shell), Oxlint

## Getting started

Prerequisites: Node 20+ and (on Windows) `bun` — the repo was built with Bun,
but `npm` works too.

```bash
npm install
```

Create a `.env` file (never committed — see `.gitignore`):

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Apply the backend schema once in Supabase Dashboard → SQL Editor
(run the whole file; it is idempotent):

```bash
# file: supabase/schema.sql
```

It creates `entries`, `prayers`, `readings` with owner-only RLS policies
(`auth.uid() = user_id`) **and** the required `GRANT … TO authenticated`
role privileges (tables made via SQL Editor get none by default — without
them every write fails with `42501 permission denied`).

Enable **Authentication → Providers → Email** with magic-link/OTP sign-in,
and add your dev origin (e.g. `http://localhost:5173`) to redirect URLs.

```bash
npm run dev      # start dev server
npm run build    # tsc -b && vite build (also emits the PWA service worker)
npm run lint     # oxlint
npm run preview  # preview the production build
```

## How it works

- **Auth day-1**: magic-link gate (`src/components/AuthGate.tsx`,
  `src/lib/auth*.tsx`, `src/hooks/useAuth.ts`).
- **Offline-first**: every write goes to Dexie immediately (`dirty: 1`),
  then pushes to Supabase in the background; pulls merge remote rows while
  local dirty rows win (`src/lib/sync.ts`, `src/hooks/use*`).
- **Tabs**: Today (journal + search + streak), Prayers (active/answered),
  Readings (grouped by date) — `src/components/`.
- Sync failures are never silent: console warning + red banner in the UI.
- PWA icons live in `public/pwa-*.png` (rasterized from `favicon.svg`).

## Project layout

```
supabase/schema.sql      # tables + RLS + GRANTs (run once in dashboard)
src/lib/                 # supabaseClient, Dexie db, sync, streak
src/hooks/               # useAuth, useEntries, usePrayers, useReadings, useOnline
src/components/          # AuthGate, Journal, Prayers, Readings
src/App.tsx              # auth gate + header (online dot) + tab nav
```

## Local-only files (gitignored)

`chats.md` (session memory), `paste.md` (error dropbox), `.env*`.

## Known limitations

- Deleting a synced entry while offline orphans its remote row (remote
  delete is best-effort); it re-syncs cleanly once online for creates/updates.
- PWA icons use `purpose: any` (no maskable variant yet).
