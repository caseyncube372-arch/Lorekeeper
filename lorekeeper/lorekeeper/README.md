# Lorekeeper — Build a Universe

A website where people create fictional universes, organise their lore, and explore their own creations — entirely in the browser, with no backend and no build step.

## Quick start

Any static file server works:

```bash
# option 1 — the included dev server (no dependencies)
node server.js
# → http://localhost:8642

# option 2 — Python
python -m http.server 8642

# option 3 — Node
npx serve .
```

Then open the printed URL. (Double-clicking `index.html` also works in most browsers, but a local server is recommended.)

## Features

- **Worlds** — create multiple fictional universes, each with a name, tagline, genre, cover image, and its own theme.
- **Entries** — characters (role, age, pronouns), locations, kingdoms (with a linked capital), and factions (kind, leader). Each has a summary, long-form description, tags, and an optional image.
- **Relationship maps** — an interactive SVG map of character bonds (ally, family, rival, enemy, romance, mentor). Drag nodes, click one to spotlight its bonds.
- **Timeline** — record historical events with year, era, date label, and importance; link events to entries; filter by era and search.
- **Search & filter** — live filtering in every library (search box, tag filter, sorting) plus a global search across entries and events (`/` shortcut).
- **Themes** — six palettes (Arcane Night, Emberfall, Verdant Wilds, Tidal Depths, Gilded Age, Parchment) plus a custom accent colour per world.
- **Images** — portrait and cover uploads, auto-resized (max 720px) so they fit comfortably in browser storage.
- **Autosave** — every change is saved to `localStorage` instantly; a "Saved" indicator flashes in the world header.
- **Backups** — export any world (or everything) as JSON and import it back, on any browser.

## Project structure

```
lorekeeper/
├── index.html          app shell, loads all scripts in order
├── server.js           tiny dev server (no dependencies)
├── css/styles.css      all styling — theme palettes are CSS variables per body[data-theme]
└── js/
    ├── util.js         helpers (uid, escaping, image resizing, downloads…)
    ├── store.js        localStorage persistence + data sanitisation + import/export
    ├── themes.js       theme presets and swatch picker
    ├── components.js   icons, toasts, modals, confirm dialogs, form helpers
    ├── demo.js         the "Aethermoor" demo world
    ├── world.js        world workspace: overview, libraries, detail views, forms,
    │                   timeline, settings, global search
    ├── map.js          interactive relationship map (SVG, drag + spotlight)
    ├── dashboard.js    world cards, hero, new-world modal
    └── app.js          hash router, global event delegation, keyboard shortcuts
```

No frameworks, no build step — plain HTML/CSS/JS, so it deploys anywhere static files are served.

## Data & privacy

Everything lives in your browser's local storage (key `lorekeeper:v1`). Clearing site data erases your worlds — export JSON backups from **world → settings → data**. The settings page shows a storage meter against the ~5 MB browser quota.

## Roadmap

### Stage 5 — Publish (ready for you)

The folder is a static site — deploy it anywhere: [Netlify Drop](https://app.netlify.com/drop) (drag the folder), GitHub Pages, or Vercel. Then test on phones/tablets — the layout is responsive.

### Stage 6 — Accounts & cloud sync (built, needs 3 minutes of setup)

The app now supports **email sign-in (passwordless magic links)** and **cloud sync** via [Supabase](https://supabase.com)'s free tier, which removes the browser's ~5 MB storage limit (worlds live in a Postgres database — 500 MB free).

Without setup, nothing changes: the app runs entirely offline in each visitor's browser, and the cloud features stay dormant (the Supabase library is only downloaded when a project is connected).

**Setup:**

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the contents of `supabase-schema.sql` (creates the `worlds` + `deleted_worlds` tables and privacy rules).
3. Copy the **Project URL** and **anon public key** from **Settings → API**.
4. Provide them either way:
   - paste into `js/config.js`, **or**
   - in the app: top bar → **Sign in** → "Connect" form.
5. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your deployed address and add `http://localhost:8642` to **Redirect URLs** (for local testing). Magic-link emails redirect here.
6. Deploy (Stage 5). Visitors click **Sign in**, enter their email, click the link — done.

**How sync works:** your browser copy is always the working state (instant, offline-friendly). When signed in, every change auto-uploads (debounced ~1.5 s); signing in merges cloud and local copies, newest edit wins per world; deletions are remembered as tombstones so another device can't resurrect them. Each user's worlds are private (Row Level Security). An `is_public` column already exists for read-only shared world pages — the natural next feature.
