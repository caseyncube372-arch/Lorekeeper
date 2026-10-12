/* ============================================================
   Lorekeeper — persistence layer (localStorage)
   All mutations go through here so saving stays consistent.
   ============================================================ */
(function () {
  const LK = (window.LK = window.LK || {});
  const { uid } = LK.util;

  const KEY = 'lorekeeper:v1';
  const ENTRY_TYPES = ['character', 'location', 'kingdom', 'faction'];
  const REL_KINDS = ['ally', 'family', 'rival', 'enemy', 'romance', 'mentor', 'other'];
  const MAX_IMAGE_CHARS = 900000; // ~675 KB binary — keeps worlds inside the 5 MB quota

  const now = () => Date.now();

  /** Only accept reasonable inline image payloads. */
  function img(value) {
    if (typeof value !== 'string') return '';
    if (value.length > MAX_IMAGE_CHARS) return '';
    return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(value) ? value : '';
  }

  function str(value, max = 200) {
    return String(value ?? '').slice(0, max);
  }

  function sanitizeEntry(e) {
    e = e && typeof e === 'object' ? e : {};
    const t = ENTRY_TYPES.includes(e.type) ? e.type : 'character';
    return {
      id: e.id || uid(),
      type: t,
      name: str(e.name, 120) || 'Untitled',
      summary: str(e.summary, 300),
      description: str(e.description, 20000),
      tags: Array.isArray(e.tags) ? e.tags.map((x) => str(x, 30)).filter(Boolean).slice(0, 12) : [],
      image: img(e.image),
      role: str(e.role, 120),
      age: str(e.age, 40),
      pronouns: str(e.pronouns, 40),
      kind: str(e.kind, 80),
      ruler: str(e.ruler, 120),
      capital: str(e.capital, 40),
      founded: str(e.founded, 80),
      leader: str(e.leader, 120),
      createdAt: +e.createdAt || now(),
      updatedAt: +e.updatedAt || now(),
    };
  }

  function sanitizeEvent(ev) {
    ev = ev && typeof ev === 'object' ? ev : {};
    let year = ev.year;
    if (typeof year !== 'number' || Number.isNaN(year)) year = null;
    return {
      id: ev.id || uid(),
      title: str(ev.title, 160) || 'Untitled event',
      era: str(ev.era, 80),
      year,
      dateText: str(ev.dateText, 80),
      description: str(ev.description, 20000),
      importance: LK.util.clamp(+ev.importance || 1, 0, 2),
      links: Array.isArray(ev.links) ? ev.links.map((x) => String(x).slice(0, 40)).slice(0, 50) : [],
      createdAt: +ev.createdAt || now(),
      updatedAt: +ev.updatedAt || now(),
    };
  }

  function sanitizeRelationship(r) {
    r = r && typeof r === 'object' ? r : {};
    if (!r.from || !r.to || r.from === r.to) return null;
    return {
      id: r.id || uid(),
      from: str(r.from, 40),
      to: str(r.to, 40),
      label: str(r.label, 80),
      kind: REL_KINDS.includes(r.kind) ? r.kind : 'other',
    };
  }

  /** Coerce unknown/old data into a known-good shape. */
  function migrate(data) {
    const out = { v: 1, worlds: [] };
    if (!data || typeof data !== 'object' || !Array.isArray(data.worlds)) return out;
    for (const w of data.worlds) {
      if (!w || typeof w !== 'object') continue;
      const world = {
        id: w.id || uid(),
        name: str(w.name, 60) || 'Untitled world',
        tagline: str(w.tagline, 160),
        genre: str(w.genre, 40),
        theme: LK.themes && LK.themes.get(w.theme) ? w.theme : 'arcane',
        accent: typeof w.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(w.accent) ? w.accent : '',
        cover: img(w.cover),
        createdAt: +w.createdAt || now(),
        updatedAt: +w.updatedAt || now(),
        entries: Array.isArray(w.entries) ? w.entries.map(sanitizeEntry) : [],
        events: Array.isArray(w.events) ? w.events.map(sanitizeEvent) : [],
        relationships: Array.isArray(w.relationships)
          ? w.relationships.map(sanitizeRelationship).filter(Boolean)
          : [],
      };
      out.worlds.push(world);
    }
    return out;
  }

  const store = {
    state: null,
    KEY,

    load() {
      let raw = null;
      try {
        raw = localStorage.getItem(KEY);
      } catch (e) {
        /* storage unavailable (private mode) — run in-memory */
      }
      try {
        this.state = migrate(raw ? JSON.parse(raw) : null);
      } catch (e) {
        this.state = migrate(null);
      }
      return this.state;
    },

    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
        if (LK.app && LK.app.savedFlash) LK.app.savedFlash();
      } catch (e) {
        if (LK.ui) LK.ui.toast('Browser storage is full — remove some images or export a backup.', 'error');
      }
    },

    // ---------- worlds ----------
    createWorld(data = {}) {
      const t = now();
      const world = {
        id: uid(),
        name: str(data.name, 60) || 'Untitled world',
        tagline: str(data.tagline, 160),
        genre: str(data.genre, 40),
        theme: LK.themes && LK.themes.get(data.theme) ? data.theme : 'arcane',
        accent: typeof data.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.accent) ? data.accent : '',
        cover: img(data.cover),
        createdAt: t,
        updatedAt: t,
        entries: [],
        events: [],
        relationships: [],
      };
      this.state.worlds.push(world);
      this.save();
      return world;
    },

    getWorld(id) {
      return this.state.worlds.find((w) => w.id === id) || null;
    },

    updateWorld(id, patch) {
      const w = this.getWorld(id);
      if (!w) return;
      const allowed = ['name', 'tagline', 'genre', 'theme', 'accent', 'cover'];
      for (const k of allowed) {
        if (k in patch) {
          if (k === 'cover') w.cover = img(patch.cover);
          else if (k === 'accent') w.accent = /^#[0-9a-fA-F]{6}$/.test(patch.accent || '') ? patch.accent : '';
          else if (k === 'name') w.name = str(patch.name, 60) || w.name;
          else w[k] = str(patch[k], k === 'tagline' ? 160 : 40);
        }
      }
      w.updatedAt = now();
      this.save();
    },

    deleteWorld(id) {
      this.state.worlds = this.state.worlds.filter((w) => w.id !== id);
      this.save();
    },

    // ---------- entries ----------
    addEntry(worldId, data = {}) {
      const w = this.getWorld(worldId);
      if (!w) return null;
      const e = sanitizeEntry({ ...data, id: uid(), createdAt: now(), updatedAt: now() });
      w.entries.push(e);
      w.updatedAt = now();
      this.save();
      return e;
    },

    getEntry(worldId, entryId) {
      const w = this.getWorld(worldId);
      return w ? w.entries.find((e) => e.id === entryId) || null : null;
    },

    updateEntry(worldId, entryId, patch) {
      const w = this.getWorld(worldId);
      if (!w) return;
      const e = w.entries.find((x) => x.id === entryId);
      if (!e) return;
      const clean = sanitizeEntry({ ...e, ...patch, id: e.id, type: e.type, createdAt: e.createdAt });
      Object.assign(e, clean, { updatedAt: now() });
      w.updatedAt = now();
      this.save();
    },

    deleteEntry(worldId, entryId) {
      const w = this.getWorld(worldId);
      if (!w) return;
      w.entries = w.entries.filter((e) => e.id !== entryId);
      w.relationships = w.relationships.filter((r) => r.from !== entryId && r.to !== entryId);
      w.events.forEach((ev) => {
        ev.links = (ev.links || []).filter((l) => l !== entryId);
      });
      w.updatedAt = now();
      this.save();
    },

    entriesByType(worldId, type) {
      const w = this.getWorld(worldId);
      return w ? w.entries.filter((e) => e.type === type) : [];
    },

    // ---------- events ----------
    addEvent(worldId, data = {}) {
      const w = this.getWorld(worldId);
      if (!w) return null;
      const ev = sanitizeEvent({ ...data, id: uid(), createdAt: now(), updatedAt: now() });
      w.events.push(ev);
      w.updatedAt = now();
      this.save();
      return ev;
    },

    getEvent(worldId, eventId) {
      const w = this.getWorld(worldId);
      return w ? w.events.find((e) => e.id === eventId) || null : null;
    },

    updateEvent(worldId, eventId, patch) {
      const w = this.getWorld(worldId);
      if (!w) return;
      const ev = w.events.find((x) => x.id === eventId);
      if (!ev) return;
      Object.assign(ev, sanitizeEvent({ ...ev, ...patch, id: ev.id, createdAt: ev.createdAt }), {
        updatedAt: now(),
      });
      w.updatedAt = now();
      this.save();
    },

    deleteEvent(worldId, eventId) {
      const w = this.getWorld(worldId);
      if (!w) return;
      w.events = w.events.filter((e) => e.id !== eventId);
      w.updatedAt = now();
      this.save();
    },

    // ---------- relationships ----------
    addRelationship(worldId, { from, to, label, kind }) {
      const w = this.getWorld(worldId);
      if (!w || !from || !to || from === to) return null;
      if (w.relationships.some((r) => r.from === from && r.to === to && r.kind === kind)) return null;
      const rel = {
        id: uid(),
        from,
        to,
        label: str(label, 80),
        kind: REL_KINDS.includes(kind) ? kind : 'other',
      };
      w.relationships.push(rel);
      w.updatedAt = now();
      this.save();
      return rel;
    },

    deleteRelationship(worldId, relId) {
      const w = this.getWorld(worldId);
      if (!w) return;
      w.relationships = w.relationships.filter((r) => r.id !== relId);
      w.updatedAt = now();
      this.save();
    },

    // ---------- import / export ----------
    exportWorld(world) {
      return JSON.stringify({ kind: 'lorekeeper-world', v: 1, world }, null, 2);
    },

    exportAll() {
      return JSON.stringify({ kind: 'lorekeeper-backup', v: 1, ...this.state }, null, 2);
    },

    /** Import a world (or full backup) file. Returns number of worlds added. */
    importJSON(text) {
      const data = JSON.parse(text);
      let worlds = [];
      if (data && data.kind === 'lorekeeper-world' && data.world) worlds = [data.world];
      else if (data && data.kind === 'lorekeeper-backup' && Array.isArray(data.worlds)) worlds = data.worlds;
      else if (data && Array.isArray(data.worlds)) worlds = data.worlds;
      else if (data && Array.isArray(data.entries) && Array.isArray(data.events)) worlds = [data];
      if (!worlds.length) throw new Error('No worlds found in this file');
      const existing = new Set(this.state.worlds.map((w) => w.id));
      const clean = migrate({ worlds }).worlds;
      for (const w of clean) {
        if (existing.has(w.id)) w.id = uid();
        this.state.worlds.push(w);
      }
      this.save();
      return clean.length;
    },

    /** Rough byte usage of this app's localStorage key. */
    usage() {
      try {
        return (localStorage.getItem(KEY) || '').length * 2;
      } catch (e) {
        return 0;
      }
    },
  };

  LK.store = store;
  LK.store.ENTRY_TYPES = ENTRY_TYPES;
  LK.store.REL_KINDS = REL_KINDS;
  /** Sanitise a single (untrusted) world object — used by cloud sync downloads. */
  LK.store.migrateWorld = (raw) => migrate({ worlds: [raw] }).worlds[0] || null;
})();
