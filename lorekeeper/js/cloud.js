/* ============================================================
   Lorekeeper — accounts & cloud sync (Stage 6)

   Offline-first: the browser copy is always the working state.
   When a Supabase project is connected and the user signs in:
     - new/changed worlds auto-upload (debounced)
     - sign-in merges cloud + local (newest edit wins per world)
     - deletions are remembered as tombstones so a sync from
       another device can't resurrect a world you deleted
   Without configuration nothing changes: the app stays local-only.
   ============================================================ */
(function () {
  const LK = (window.LK = window.LK || {});
  const { icon, field, toast, openModal } = LK.ui;
  const { timeAgo, fmtBytes, esc } = LK.util;

  const CONFIG_KEY = 'lorekeeper:cloud';
  const SYNC_KEY = 'lorekeeper:sync';
  const LIB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

  let client = null;        // supabase client (lazy)
  let libPromise = null;    // script-injection promise
  let session = null;
  let status = 'off';       // off | signed-out | syncing | synced | offline
  let lastSyncedAt = 0;
  let snapshot = loadSnapshot();   // { [worldId]: updatedAtMs last pushed/pulled }
  let dirtyTimer = null;
  let syncPromise = null;
  let warnedUploadFail = false;

  /* ---------- configuration ---------- */
  function readConfig() {
    const baked = window.LOREKEEPER_CLOUD || {};
    if (baked.url && baked.anonKey) return { url: baked.url, anonKey: baked.anonKey };
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  function clearConfig() {
    localStorage.removeItem(CONFIG_KEY);
    try { localStorage.removeItem('lorekeeper:auth'); } catch (e) { /* ignore */ }
  }

  /* ---------- supabase library (lazy-loaded only when configured) ---------- */
  function loadLibrary() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = LIB_URL;
      s.onload = resolve;
      s.onerror = () => {
        libPromise = null;
        reject(new Error('Could not load the cloud library — check your connection.'));
      };
      document.head.appendChild(s);
    });
    return libPromise;
  }

  async function ensureClient() {
    const cfg = readConfig();
    if (!cfg || !cfg.url || !cfg.anonKey) return null;
    if (client) return client;
    await loadLibrary();
    client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, storageKey: 'lorekeeper:auth' },
    });
    return client;
  }

  /* ---------- sync snapshot ---------- */
  function loadSnapshot() {
    try {
      return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function persistSnapshot() {
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(snapshot)); } catch (e) { /* ignore */ }
  }

  /* ---------- status pill ---------- */
  function setStatus(s) {
    status = s;
    paintPills();
  }

  function pillHTML() {
    let dot = '';
    let label = 'Local';
    let title = 'Cloud sync is not set up — click to learn more.';
    if (status === 'signed-out') { dot = 'idle'; label = 'Sign in'; title = 'Cloud sync is set up — click to sign in.'; }
    if (status === 'syncing') { dot = 'spin'; label = 'Syncing…'; title = 'Talking to the cloud…'; }
    if (status === 'synced') { dot = 'ok'; label = 'Cloud'; title = `Synced ${timeAgo(lastSyncedAt)} — click for details.`; }
    if (status === 'offline') { dot = 'err'; label = 'Offline'; title = 'Could not reach the cloud — will retry. Click for details.'; }
    return `<span class="cloud-dot ${dot}"></span><span>${label}</span>`;
  }

  function paintPills() {
    document.querySelectorAll('[data-cloud-pill]').forEach((el) => {
      el.innerHTML = pillHTML();
      el.title = {
        off: 'Cloud sync is not set up — click to learn more.',
        'signed-out': 'Cloud sync is set up — click to sign in.',
        syncing: 'Talking to the cloud…',
        synced: `Synced ${timeAgo(lastSyncedAt)} — click for details.`,
        offline: 'Could not reach the cloud — will retry. Click for details.',
      }[status] || '';
    });
  }

  /** One-line description for world settings. */
  function describe() {
    const email = session && session.user ? session.user.email : null;
    if (status === 'off') return 'not connected — open the account menu (top bar) to set it up';
    if (!email) return 'ready — sign in from the account menu (top bar)';
    if (status === 'syncing') return `connected as ${email} — syncing…`;
    if (status === 'synced') return `connected as ${email} — last sync ${timeAgo(lastSyncedAt)}`;
    if (status === 'offline') return `connected as ${email} — offline, will retry on the next change`;
    return `connected as ${email}`;
  }

  /* ============================================================
     Merge planning (pure — no I/O, unit-testable)
     ============================================================ */
  /**
   * Decide how to reconcile local worlds with cloud rows.
   * @param {Array} localWorlds
   * @param {Array} cloudRows  [{ id, data, updated_at }]
   * @param {Map}  tombstones  Map(worldId -> deletedAtMs)
   * @returns {{ download: Array, upload: Array, removeLocal: string[], removeCloud: string[] }}
   */
  function mergePlan(localWorlds, cloudRows, tombstones) {
    const plan = { download: [], upload: [], removeLocal: [], removeCloud: [] };
    const localById = new Map(localWorlds.map((w) => [w.id, w]));
    const cloudById = new Map(cloudRows.map((r) => [r.id, r]));

    for (const id of tombstones.keys()) {
      if (localById.has(id)) plan.removeLocal.push(id);
      if (cloudById.has(id)) plan.removeCloud.push(id);
    }
    for (const row of cloudRows) {
      if (tombstones.has(row.id)) continue;
      const lw = localById.get(row.id);
      const cloudAt = Date.parse(row.updated_at) || 0;
      if (!lw || cloudAt > (lw.updatedAt || 0)) plan.download.push(row);
      else if ((lw.updatedAt || 0) > cloudAt) plan.upload.push(lw);
    }
    for (const w of localWorlds) {
      if (tombstones.has(w.id)) continue;
      if (!cloudById.has(w.id)) plan.upload.push(w);
    }
    return plan;
  }

  /* ============================================================
     Sync engine
     ============================================================ */
  async function uploadWorld(w) {
    const payload = {
      id: w.id,
      user_id: session.user.id,
      name: w.name,
      data: w,
      updated_at: new Date(w.updatedAt || Date.now()).toISOString(),
      is_public: !!w.isPublic,
    };
    const { error } = await client.from('worlds').upsert(payload);
    if (error) {
      console.warn('[cloud] upload failed for world', w.name, error.message);
      return error;
    }
    return null;
  }

  function syncAll(silent = true) {
    if (syncPromise) return syncPromise;
    syncPromise = doSyncAll(silent).finally(() => { syncPromise = null; });
    return syncPromise;
  }

  /** Human explanations for the sync errors people actually hit. */
  function friendlySyncError(err) {
    const msg = (err && (err.message || err.error_description || err.msg)) || 'unknown error';
    if (/permission denied/i.test(msg)) {
      return 'The database refused access ("permission denied"). Fix: open Supabase → SQL Editor, re-run the updated supabase-schema.sql (it now grants the app permission to its tables), then press Sync again.';
    }
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return 'Could not reach the cloud — check your connection, and that the Project URL in the account menu matches Supabase → Settings → API.';
    }
    if (/invalid api key|invalid api key|jwt/i.test(msg)) {
      return 'Supabase rejected the API key — copy the anon/publishable key again (Settings → API) and reconnect from the account menu.';
    }
    if (/row-level security/i.test(msg)) {
      return 'The database blocked the change (row-level security). Make sure you ran the latest supabase-schema.sql, then try again.';
    }
    return 'Cloud sync failed: ' + msg;
  }

  /** Human explanations for auth errors people actually hit. */
  function friendlyAuthError(err) {
    const msg = (err && (err.message || err.error_description || err.msg)) || 'unknown error';
    if (/rate limit|too many/i.test(msg)) {
      return "Email rate limit reached — the free built-in Supabase email service allows only a few messages per hour. Wait a while and retry, or set up custom SMTP under Supabase → Authentication → SMTP.";
    }
    if (/redirect/i.test(msg)) {
      return "Supabase refused the return address. In Supabase → Authentication → URL Configuration, add this site's exact address to Redirect URLs, then retry.";
    }
    if (/invalid api key|apikey|jwt|token.*invalid/i.test(msg)) {
      return "Supabase rejected the API key — re-copy the anon/publishable key (Project Settings → API) and reconnect from the account menu.";
    }
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return "Could not reach Supabase — check the Project URL in the account menu matches Settings → API, and that your connection is up.";
    }
    if (/not enabled|disabled|unsupported_provider/i.test(msg)) {
      return "Email sign-in is switched off for this project — enable the Email provider under Supabase → Authentication → Providers.";
    }
    if (/smtp/i.test(msg)) {
      return "The email service refused to send — configure a mail server under Supabase → Authentication → SMTP, or wait and retry.";
    }
    return "Sign-in failed: " + msg;
  }

  async function doSyncAll(silent) {
    if (!client || !session) { setStatus('signed-out'); return { uploaded: 0, downloaded: 0, removed: 0, failed: 0 }; }
    setStatus('syncing');
    try {
      const [wRes, tRes] = await Promise.all([
        client.from('worlds').select('id, data, updated_at'),
        client.from('deleted_worlds').select('world_id, deleted_at'),
      ]);
      if (wRes.error) throw wRes.error;
      if (tRes.error) throw tRes.error;

      const tombstones = new Map((tRes.data || []).map((t) => [t.world_id, Date.parse(t.deleted_at) || 0]));
      const plan = mergePlan(LK.store.state.worlds, wRes.data || [], tombstones);

      let added = 0;
      let updated = 0;
      for (const row of plan.download) {
        const clean = LK.store.migrateWorld(row.data);
        if (!clean) continue;
        const existing = LK.store.state.worlds.find((w) => w.id === clean.id);
        if (existing) Object.assign(existing, clean, { id: row.id });
        else LK.store.state.worlds.push(clean);
        snapshot[clean.id] = clean.updatedAt;
        existing ? updated++ : added++;
      }

      for (const id of plan.removeLocal) {
        LK.store.state.worlds = LK.store.state.worlds.filter((w) => w.id !== id);
        delete snapshot[id];
      }
      for (const id of plan.removeCloud) {
        await client.from('worlds').delete().eq('id', id);
      }

      let uploaded = 0;
      let failed = 0;
      for (const w of plan.upload) {
        const err = await uploadWorld(w);
        if (err) failed++;
        else { uploaded++; snapshot[w.id] = w.updatedAt || Date.now(); }
      }

      persistSnapshot();
      LK.store.save(); // persist merged local state (snapshot already matches → no re-upload)
      lastSyncedAt = Date.now();
      setStatus(failed ? 'offline' : 'synced');
      warnedUploadFail = false;

      const counts = { uploaded, downloaded: added + updated, removed: plan.removeLocal.length + plan.removeCloud.length, failed };
      if (!silent) {
        if (failed) toast(`Sync finished with ${failed} upload failure(s) — check your connection.`, 'error');
        else if (!counts.uploaded && !counts.downloaded && !counts.removed) toast('Everything is already in sync.');
        else toast(`Cloud synced: ${[counts.uploaded ? `${counts.uploaded} uploaded` : '', counts.downloaded ? `${counts.downloaded} downloaded` : '', counts.removed ? `${counts.removed} cleaned up` : ''].filter(Boolean).join(', ')}.`);
      }
      return counts;
    } catch (err) {
      setStatus('offline');
      if (!silent) toast(friendlySyncError(err), 'error');
      return { error: err, uploaded: 0, downloaded: 0, removed: 0, failed: 0 };
    }
  }

  /* ---------- autosync hooks (wired into store below) ---------- */
  function onLocalChange() {
    if (!client || !session) return;
    clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(() => { syncDirty().catch(() => {}); }, 1500);
  }

  async function syncDirty() {
    if (!client || !session) return;
    const dirty = LK.store.state.worlds.filter((w) => snapshot[w.id] !== (w.updatedAt || 0));
    if (!dirty.length) return;
    setStatus('syncing');
    let failed = 0;
    for (const w of dirty) {
      const err = await uploadWorld(w);
      if (err) failed++;
      else snapshot[w.id] = w.updatedAt || Date.now();
    }
    persistSnapshot();
    setStatus(failed ? 'offline' : 'synced');
    if (failed && !warnedUploadFail) {
      warnedUploadFail = true;
      toast('Could not reach the cloud — your edits are safe on this device and will retry.', 'error');
    }
  }

  async function onWorldDeleted(id) {
    delete snapshot[id];
    persistSnapshot();
    if (!client || !session) return;
    try {
      await client.from('deleted_worlds').upsert({
        world_id: id,
        user_id: session.user.id,
        deleted_at: new Date().toISOString(),
      });
      await client.from('worlds').delete().eq('id', id);
    } catch (e) {
      console.warn('[cloud] tombstone failed:', e.message);
    }
  }

  /* ============================================================
     Auth bootstrap
     ============================================================ */
  async function init() {
    if (!readConfig()) { setStatus('off'); return; }
    setStatus('signed-out');
    try {
      const c = await ensureClient();
      const { data } = await c.auth.getSession();
      session = data.session || null;
      if (session) await syncAll(true);

      c.auth.onAuthStateChange((event, s) => {
        session = s;
        if (event === 'SIGNED_IN') {
          toast(`Signed in as ${session.user.email} — syncing your worlds…`);
          setStatus('syncing');
          syncAll(true).then((res) => {
            if (res && !res.error) {
              const n = res.uploaded + res.downloaded;
              toast(n ? `Cloud ready — ${n} world${n === 1 ? '' : 's'} in sync.` : 'Cloud ready — everything in sync.');
            }
          });
        }
        if (event === 'SIGNED_OUT') {
          setStatus('signed-out');
          toast('Signed out — your worlds stay on this device.');
        }
        paintPills();
      });
    } catch (e) {
      console.warn('[cloud] init failed:', e.message);
      setStatus('offline');
    }
  }

  async function syncNow() {
    try {
      const c = await ensureClient();
      if (!c) { toast('Cloud sync is not set up yet.', 'error'); openAccount(); return; }
      if (!session) { toast('Sign in first — open the account menu.', 'error'); openAccount(); return; }
      await syncAll(false);
    } catch (e) {
      toast('Cloud sync failed: ' + (e.message || 'unknown error'), 'error');
    }
  }

  async function signOut() {
    if (!client) return;
    try { await client.auth.signOut(); } catch (e) { /* ignore */ }
  }

  function disconnect() {
    clearConfig();
    client = null;
    session = null;
    setStatus('off');
    toast('Cloud disconnected — your worlds remain on this device.');
  }

  /* ============================================================
     Account modal
     ============================================================ */
  function bodyHTML() {
    const cfg = readConfig();
    if (!cfg) {
      return `
        <p class="muted">Cloud sync keeps your worlds safe online, syncs them across devices, and lifts the browser's ~5 MB storage limit. It needs a free <a href="https://supabase.com" target="_blank" rel="noopener">Supabase</a> project — about three minutes to set up (see <code>README.md</code> and <code>supabase-schema.sql</code>).</p>
        <div class="form-grid">
          ${field('Project URL', `<input class="input" name="sb-url" placeholder="https://xxxxxxxx.supabase.co">`)}
          ${field('Anon public key', `<input class="input" name="sb-key" placeholder="eyJhbGciOiJIUzI1NiIs…">`)}
        </div>
        <div class="row gap-s mt-m">
          <button type="button" class="btn primary" data-x="connect">${icon('link', 15)} Connect</button>
        </div>
        <p class="muted xsmall mt-s">These values are stored only in this browser. The anon key is designed to be public — Row Level Security keeps every user's worlds private.</p>
        <p class="muted xsmall">This browser currently holds ~${fmtBytes(LK.store.usage())} of lore against the ~5 MB local limit.</p>`;
    }
    if (!session) {
      return `
        <p class="muted">Enter your email and we'll send you a one-time sign-in link — no password needed. Click the link on this device to sign in.</p>
        <div class="form-grid">
          ${field('Email', `<input class="input" type="email" name="email" placeholder="you@example.com">`, 'span-2')}
        </div>
        <div class="row gap-s mt-m wrap">
          <button type="button" class="btn primary" data-x="magic">${icon('sparkles', 15)} Email me a sign-in link</button>
          <button type="button" class="btn ghost sm" data-x="disconnect">Use a different project</button>
        </div>
        <p class="muted xsmall mt-s">Status: ${esc(describe())}</p>`;
    }
    return `
      <div class="rel-row">
        <span class="avatar avatar-fallback">${esc((session.user.email || '?')[0].toUpperCase())}</span>
        <strong class="min-w-0">${esc(session.user.email || 'Signed in')}</strong>
        <span class="chip chip-accent">${status === 'syncing' ? 'Syncing…' : status === 'offline' ? 'Offline' : 'Synced'}</span>
      </div>
      <p class="muted small mt-s">Your worlds live both on this device and in the cloud. Changes sync automatically; if the same world is edited in two places, the most recent edit wins.</p>
      <p class="muted small">Local cache: ~${fmtBytes(LK.store.usage())} · Last sync: ${lastSyncedAt ? timeAgo(lastSyncedAt) : 'never'}</p>
      <div class="row gap-s mt-m wrap">
        <button type="button" class="btn primary" data-x="sync">${icon('check', 15)} Sync now</button>
        <button type="button" class="btn ghost" data-x="signout">Sign out</button>
      </div>`;
  }

  function openAccount() {
    openModal({
      title: 'Account & cloud sync',
      body: '<div class="account-body"></div>',
      onMount(overlay, close) {
        const host = overlay.querySelector('.account-body');
        const repaint = () => {
          host.innerHTML = bodyHTML();
          wire(host, repaint, close);
        };
        repaint();
      },
    });
  }

  function wire(host, repaint, close) {
    const connectBtn = host.querySelector('[data-x="connect"]');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        const url = host.querySelector('[name="sb-url"]').value.trim().replace(/\/+$/, '');
        const anonKey = host.querySelector('[name="sb-key"]').value.trim();
        if (!/^https:\/\/.+\.supabase\.co/.test(url)) { toast('The project URL should look like https://xxxx.supabase.co', 'error'); return; }
        if (anonKey.length < 20) { toast('That anon key looks too short — copy it from Supabase → Settings → API.', 'error'); return; }
        saveConfig({ url, anonKey });
        client = null;
        session = null;
        setStatus('signed-out');
        toast('Cloud connected — now sign in with your email.');
        repaint();
      });
    }

    const magicBtn = host.querySelector('[data-x="magic"]');
    if (magicBtn) {
      magicBtn.addEventListener('click', async () => {
        const emailInput = host.querySelector('[name="email"]');
        const email = emailInput.value.trim();
        if (!/.+@.+\..+/.test(email)) { emailInput.classList.add('invalid'); emailInput.focus(); return; }
        magicBtn.disabled = true;
        magicBtn.textContent = 'Sending…';
        try {
          const c = await ensureClient();
          const { error } = await c.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: location.origin + location.pathname },
          });
          if (error) throw error;
          host.innerHTML = `
            <p>${icon('check', 18)} <strong>Check your inbox!</strong></p>
            <p class="muted">We sent a one-time sign-in link to <strong>${esc(email)}</strong>. Open it on this device and you'll be signed in and synced automatically.</p>
            <div class="row gap-s mt-m"><button type="button" class="btn ghost" data-x="back">Back</button></div>`;
          host.querySelector('[data-x="back"]').addEventListener('click', repaint);
        } catch (e) {
          magicBtn.disabled = false;
          magicBtn.innerHTML = `${icon('sparkles', 15)} Email me a sign-in link`;
          toast(friendlyAuthError(e), 'error');
        }
      });
    }

    const disconnectBtn = host.querySelector('[data-x="disconnect"]');
    if (disconnectBtn) disconnectBtn.addEventListener('click', () => { disconnect(); repaint(); });

    const syncBtn = host.querySelector('[data-x="sync"]');
    if (syncBtn) syncBtn.addEventListener('click', async () => { await syncNow(); repaint(); });

    const signoutBtn = host.querySelector('[data-x="signout"]');
    if (signoutBtn) signoutBtn.addEventListener('click', async () => { await signOut(); close(); });
  }

  /* ---------- hook local mutations so they auto-upload ---------- */
  (function patchStore() {
    const origSave = LK.store.save.bind(LK.store);
    LK.store.save = function (...args) {
      const r = origSave(...args);
      onLocalChange();
      return r;
    };
    const origDeleteWorld = LK.store.deleteWorld.bind(LK.store);
    LK.store.deleteWorld = function (id) {
      const r = origDeleteWorld(id);
      onWorldDeleted(id);
      return r;
    };
  })();

  LK.cloud = {
    init, syncNow, signOut, disconnect, openAccount,
    paintPills, describe, mergePlan,
    get status() { return status; },
    get session() { return session; },
  };
})();
