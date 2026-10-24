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

- **Design**: neutral-clean system in `src/index.css` — light/dark token
  pairs plus shared primitives (`.field`, `.btn`, `.card`, `.chip`, …);
  components style through tokens, not one-off colors. Restrained color:
  per-section hues (Today violet, Prayers amber, Readings teal) tint active
  tabs, pills, and labels; tag chips get stable hashed pastels. Theme is
  user-controlled (`useTheme`: light/dark toggle in the header, OS default
  until picked, persisted, no first-paint flash). Buttons follow Supabase
  language: small, thin-ring bordered, green primary, red-tint danger;
  deletes confirm through a modal dialog (Escape/outside-click cancels).

- **Auth day-1**: magic-link gate (`src/components/AuthGate.tsx`,
  `src/lib/auth*.tsx`, `src/hooks/useAuth.ts`). Expired/used links show
  the redirect error instead of failing silently.
- Render crashes are caught by `ErrorBoundary` (`main.tsx`) with a
  try-again/reload fallback; data stays safe in Dexie + Supabase.
- Vendor libs are code-split (react/supabase/dexie/motion/dates) so the
  main chunk stays small and caches independently in the PWA precache.
- **Offline-first**: every write goes to Dexie immediately (`dirty: 1`),
  then pushes to Supabase in the background; pulls merge remote rows while
  local dirty rows win (`src/lib/sync.ts`, `src/hooks/use*`). Every hook
  also resyncs on the browser `online` event, so reconnecting catches up
  without waiting for your next tap.
- **Conflict policy (deliberate: local-dirty-wins)**:
    - Push-then-pull order per sync; a row with unsynced local changes is
      never overwritten by remote state.
    - Deletes are tombstones: hidden instantly, purged remotely on next sync
      (works fully offline).
    - Remote deletes propagate to other devices on pull — except rows with
      unsynced local edits, which keep local state and re-upload instead.
    - If an edited row was deleted remotely in the meantime, push detects
      the update-miss (zero rows touched) and re-inserts it, so the offline
      edit resurrects instead of vanishing.
    - Guard rail: propagation only runs when the full remote set was fetched
      (below the 500-row page limit), so pagination can never look like mass
      deletion.
- **Tabs**: Today (timeline of everything, grouped by date), Notes (composer + search + feed), Prayers (active/answered),
  Readings (grouped by date) — `src/components/`. Routes (`react-router-dom`): `/`, `/notes`, `/prayers`, `/readings`, `/read/:kind/:id`; mobile bottom tab bar, desktop segmented tabs.
- Sync failures are never silent: console warning + red banner in the UI.
- Deletes are tombstoned locally and purged remotely on next sync, so
  offline deletes no longer orphan remote rows.
- PWA icons live in `public/pwa-*.png` (rasterized from `favicon.svg`,
  incl. a padded `maskable` variant) plus `apple-touch-icon.png` for iOS
  home-screen install.
- **Export**: header Export button downloads all entries, prayers, and
  readings as `hedraios-export-DATE.json` (sync metadata stripped,
  deleted rows excluded) — your data, your file.

## Project layout

```
supabase/schema.sql      # tables + RLS + GRANTs (run once in dashboard)
supabase/email-templates # magic-link + confirm-signup (paste into dashboard)
src/lib/                 # supabaseClient, Dexie db, sync, streak, reading, toast, export
src/hooks/               # useAuth, useEntries, usePrayers, useReadings, useOnline, useStats, useTheme
src/components/          # AuthGate, Timeline, Notes, Prayers, Readings, ReaderView, etc.
src/App.tsx              # auth gate + header + adaptive nav + routes
vercel.json              # SPA rewrite for deep links
```

## Local-only files (gitignored)

`chats.md` (session memory), `paste.md` (error dropbox), `.env*`, `.vscode/settings.json`.

## Known limitations

- None blocking: last known sync gaps (offline-delete orphans, remote-delete
  propagation, update-miss resurrection) are all fixed and covered above.
