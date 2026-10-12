/* ============================================================
   Lorekeeper — world workspace
   Tabbed workspace for one fictional world: overview, entry
   libraries, timeline, settings, and global search.
   ============================================================ */
(function () {
  const LK = (window.LK = window.LK || {});
  const { esc, escMultiline, timeAgo, plural, parseTags, formatYear, truncate, readImage, debounce } = LK.util;
  const { icon, avatar, field, toast, openModal, confirm, bindSwatches, GENRES, genreDatalist } = LK.ui;

  const TYPES = {
    character: { label: 'Character', plural: 'Characters', icon: 'users', blurb: 'People, heroes, villains, and everyone in between.' },
    location: { label: 'Location', plural: 'Locations', icon: 'pin', blurb: 'Cities, wilds, ruins, and hidden places.' },
    kingdom: { label: 'Kingdom', plural: 'Kingdoms', icon: 'crown', blurb: 'Realms, their rulers, and their banners.' },
    faction: { label: 'Faction', plural: 'Factions', icon: 'flag', blurb: 'Guilds, orders, cults, and companies.' },
  };

  const REL_KINDS = {
    ally: { label: 'Ally', color: '#34d399' },
    family: { label: 'Family', color: '#f472b6' },
    rival: { label: 'Rival', color: '#fbbf24' },
    enemy: { label: 'Enemy', color: '#f87171' },
    romance: { label: 'Romance', color: '#e879f9' },
    mentor: { label: 'Mentor', color: '#60a5fa' },
    other: { label: 'Other', color: '#94a3b8' },
  };

  /* ---------- view state (filters survive tab switches) ---------- */
  let libState = { query: '', tag: '', sort: 'name' };
  let tlState = { query: '', era: '' };
  let stateOwner = null;

  function resetViewStates(world) {
    if (stateOwner === world.id) return;
    libState = { query: '', tag: '', sort: 'name' };
    tlState = { query: '', era: '' };
    stateOwner = world.id;
  }

  /* ---------- shared helpers ---------- */
  function counts(world) {
    const c = { character: 0, location: 0, kingdom: 0, faction: 0, event: 0 };
    world.entries.forEach((e) => { if (c[e.type] !== undefined) c[e.type]++; });
    c.event = world.events.length;
    return c;
  }

  function subtitle(world, e) {
    if (e.type === 'character') return e.role || e.pronouns || '';
    if (e.type === 'location') return e.kind ? e.kind.charAt(0).toUpperCase() + e.kind.slice(1) : '';
    if (e.type === 'kingdom') {
      const cap = world.entries.find((x) => x.id === e.capital);
      if (e.ruler) return `Ruled by ${e.ruler}`;
      if (cap) return `Capital: ${cap.name}`;
      return '';
    }
    if (e.type === 'faction') return e.leader ? `Led by ${e.leader}` : e.kind ? e.kind.charAt(0).toUpperCase() + e.kind.slice(1) : '';
    return '';
  }

  function uniqueTags(world, type) {
    const set = new Set();
    world.entries.filter((e) => e.type === type).forEach((e) => (e.tags || []).forEach((t) => set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  function relationshipsOf(world, characterId) {
    return world.relationships
      .filter((r) => r.from === characterId || r.to === characterId)
      .map((r) => {
        const otherId = r.from === characterId ? r.to : r.from;
        return { rel: r, other: world.entries.find((e) => e.id === otherId) };
      })
      .filter((x) => x.other);
  }

  /* ============================================================
     World shell (header + tabs)
     ============================================================ */
  function render(el, worldId, tab) {
    const world = LK.store.getWorld(worldId);
    if (!world) {
      toast('That world could not be found.', 'error');
      LK.app.go('#/');
      return;
    }
    LK.themes.apply(world.theme, world.accent);
    resetViewStates(world);
    const c = counts(world);

    const tabs = [
      ['overview', 'Overview', 'book'],
      ['characters', 'Characters', 'users'],
      ['locations', 'Locations', 'pin'],
      ['kingdoms', 'Kingdoms', 'crown'],
      ['factions', 'Factions', 'flag'],
      ['timeline', 'Timeline', 'calendar'],
      ['relationships', 'Relationships', 'link'],
      ['settings', 'Settings', 'edit'],
    ];

    el.innerHTML = `
      <header class="topbar">
        <div class="row gap-s min-w-0">
          <a class="icon-btn" href="#/" title="All worlds" aria-label="All worlds">${icon('back')}</a>
          <div class="min-w-0">
            <div class="world-name-row">
              <h2 class="world-title">${esc(world.name)}</h2>
              ${world.genre ? `<span class="chip chip-accent">${esc(world.genre)}</span>` : ''}
            </div>
            <div class="muted small world-sub">
              ${c.character} characters · ${c.location} locations · ${c.kingdom} kingdoms · ${c.faction} factions · ${c.event} events
            </div>
          </div>
        </div>
        <div class="row gap-s">
          <span id="save-indicator" class="save-indicator" title="Changes are saved automatically in this browser">${icon('check', 13)} Saved</span>
          <button class="cloud-pill" data-cloud-pill data-action="open-account"></button>
          <button class="btn ghost" data-action="open-search" title="Search everything (press /)">${icon('search', 15)} Search</button>
        </div>
      </header>
      <nav class="tabs" aria-label="World sections">
        ${tabs.map(([id, label, ic]) => `
          <a class="tab ${tab === id ? 'active' : ''}" href="#/w/${world.id}/${id}">${icon(ic, 15)} ${label}</a>`).join('')}
      </nav>
      <main class="page" id="tab-root"></main>`;

    renderTab(document.getElementById('tab-root'), world, tab);
  }

  const TYPE_BY_TAB = { characters: 'character', locations: 'location', kingdoms: 'kingdom', factions: 'faction' };

  function renderTab(el, world, tab) {
    if (tab === 'overview') return renderOverview(el, world);
    if (TYPE_BY_TAB[tab]) return renderLibrary(el, world, TYPE_BY_TAB[tab]);
    if (tab === 'timeline') return renderTimeline(el, world);
    if (tab === 'relationships') return LK.map.render(el, world);
    if (tab === 'settings') return renderSettings(el, world);
    return renderOverview(el, world);
  }

  /* ============================================================
     Overview
     ============================================================ */
  function renderOverview(el, world) {
    const c = counts(world);
    const total = c.character + c.location + c.kingdom + c.faction;
    const recent = [...world.entries].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
    const latestEvents = [...world.events].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

    el.innerHTML = `
      <div class="tab-head">
        <div>
          <h2>Overview</h2>
          <p class="muted">${world.tagline ? esc(world.tagline) : 'A summary line for this world — add one in settings.'}</p>
        </div>
        <button class="btn ghost" data-action="world-settings" data-id="${world.id}">${icon('edit', 15)} Edit world</button>
      </div>
      <div class="stat-row">
        ${statCard(world, 'users', c.character, 'Characters', 'characters')}
        ${statCard(world, 'pin', c.location, 'Locations', 'locations')}
        ${statCard(world, 'crown', c.kingdom, 'Kingdoms', 'kingdoms')}
        ${statCard(world, 'flag', c.faction, 'Factions', 'factions')}
        ${statCard(world, 'calendar', c.event, 'Events', 'timeline')}
      </div>
      ${total === 0 && c.event === 0 ? welcome(world) : `
      <div class="overview-cols">
        <section>
          <div class="section-head"><h3>Recently updated</h3></div>
          ${recent.length ? `<div class="stack">${recent.map((e) => entryCard(e)).join('')}</div>`
            : `<p class="muted">No entries yet — pick a tab above to start building.</p>`}
        </section>
        <section>
          <div class="section-head"><h3>Latest history</h3></div>
          ${latestEvents.length ? `<div class="stack">${latestEvents.map((ev) => eventRow(world, ev)).join('')}</div>`
            : `<p class="muted">No events recorded yet — visit the timeline.</p>`}
        </section>
      </div>`}
    `;
  }

  function statCard(world, ic, n, label, tabId) {
    return `
      <a class="stat-card" href="#/w/${world.id}/${tabId}">
        ${icon(ic, 18)}<strong>${n}</strong><span>${label}</span>
      </a>`;
  }

  function welcome(world) {
    const steps = [
      ['characters', 'users', 'Add your first character'],
      ['locations', 'pin', 'Place a location on the map of your world'],
      ['timeline', 'calendar', 'Record an event on the timeline'],
      ['relationships', 'link', 'Draw the bonds between your characters'],
      ['settings', 'sparkles', 'Give the world its own theme'],
    ];
    return `
      <div class="panel welcome">
        <h3>${icon('sparkles', 18)} Begin your chronicle</h3>
        <ol class="steps">
          ${steps.map(([tabId, ic, text], i) => `
            <li><a href="#/w/${world.id}/${tabId}"><span class="step-num">${i + 1}</span>${icon(ic, 15)} ${text}</a></li>`).join('')}
        </ol>
      </div>`;
  }

  /* ============================================================
     Entry library (characters / locations / kingdoms / factions)
     ============================================================ */
  function renderLibrary(el, world, type) {
    const t = TYPES[type];
    const tags = uniqueTags(world, type);
    if (libState.tag && !tags.includes(libState.tag)) libState.tag = '';

    el.innerHTML = `
      <div class="tab-head">
        <div><h2>${t.plural}</h2><p class="muted">${t.blurb}</p></div>
        <button class="btn primary" data-action="add-entry" data-type="${type}">${icon('plus', 16)} Add ${t.label.toLowerCase()}</button>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 15)}
          <input id="lib-query" class="input" type="text" placeholder="Search ${t.plural.toLowerCase()}…" value="${esc(libState.query)}">
        </div>
        <select id="lib-tag" class="select" aria-label="Filter by tag">
          <option value="">All tags</option>
          ${tags.map((tg) => `<option value="${esc(tg)}" ${libState.tag === tg ? 'selected' : ''}>${esc(tg)}</option>`).join('')}
        </select>
        <select id="lib-sort" class="select" aria-label="Sort">
          <option value="name" ${libState.sort === 'name' ? 'selected' : ''}>Name A–Z</option>
          <option value="updated" ${libState.sort === 'updated' ? 'selected' : ''}>Recently updated</option>
          <option value="created" ${libState.sort === 'created' ? 'selected' : ''}>Newest</option>
        </select>
      </div>
      <div id="lib-grid" class="grid"></div>`;

    const paint = () => {
      const hasFilter = libState.query.trim() || libState.tag;
      document.getElementById('lib-grid').innerHTML =
        listEntries(world, type) || (hasFilter ? noResults() : emptyLibrary(type));
    };
    paint();
    document.getElementById('lib-query').addEventListener('input', (e) => { libState.query = e.target.value; paint(); });
    document.getElementById('lib-tag').addEventListener('change', (e) => { libState.tag = e.target.value; paint(); });
    document.getElementById('lib-sort').addEventListener('change', (e) => { libState.sort = e.target.value; paint(); });
  }

  function listEntries(world, type) {
    const q = libState.query.trim().toLowerCase();
    let list = world.entries.filter((e) => e.type === type);
    if (libState.tag) list = list.filter((e) => (e.tags || []).includes(libState.tag));
    if (q) {
      list = list.filter((e) => {
        const hay = [e.name, e.summary, e.role, e.kind, e.ruler, e.leader, (e.tags || []).join(' ')]
          .join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    if (libState.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (libState.sort === 'updated') list.sort((a, b) => b.updatedAt - a.updatedAt);
    else list.sort((a, b) => b.createdAt - a.createdAt);
    return list.map((e) => entryCard(e)).join('');
  }

  function entryCard(entry) {
    const t = TYPES[entry.type];
    const world = LK.store.getWorld(LK.app.parseHash().worldId);
    const sub = world ? subtitle(world, entry) : '';
    return `
      <article class="entry-card" data-action="open-entry" data-id="${entry.id}" tabindex="0" role="button">
        <div class="entry-card-top">
          ${avatar(entry)}
          <div class="min-w-0">
            <h3>${esc(entry.name)}</h3>
            ${sub ? `<p class="muted small">${esc(sub)}</p>` : ''}
          </div>
        </div>
        ${entry.summary ? `<p class="entry-summary">${esc(entry.summary)}</p>` : ''}
        ${(entry.tags || []).length ? `<div class="row gap-xs wrap">${entry.tags.map((tg) => `<span class="chip">${esc(tg)}</span>`).join('')}</div>` : ''}
        <div class="entry-card-foot muted small">${icon(t.icon, 13)} ${t.label} · updated ${timeAgo(entry.updatedAt)}</div>
      </article>`;
  }

  function emptyLibrary(type) {
    const t = TYPES[type];
    return `
      <div class="empty">
        <div class="empty-glyph">${icon(t.icon, 26)}</div>
        <h3>No ${t.plural.toLowerCase()} yet</h3>
        <p class="muted">${t.blurb}</p>
        <button class="btn primary mt-s" data-action="add-entry" data-type="${type}">${icon('plus', 16)} Add your first ${t.label.toLowerCase()}</button>
      </div>`;
  }

  function noResults() {
    return `
      <div class="empty">
        <div class="empty-glyph">${icon('search', 24)}</div>
        <h3>No matches</h3>
        <p class="muted">Nothing matches the current search or filter. Try different words, or clear the filters.</p>
      </div>`;
  }

  /* ============================================================
     Entry detail + form
     ============================================================ */
  function factList(world, e) {
    const facts = [];
    if (e.type === 'character') {
      if (e.role) facts.push(['Role / title', e.role]);
      if (e.age) facts.push(['Age', e.age]);
      if (e.pronouns) facts.push(['Pronouns', e.pronouns]);
    }
    if (e.type === 'location' && e.kind) facts.push(['Kind of place', e.kind]);
    if (e.type === 'kingdom') {
      if (e.ruler) facts.push(['Ruler', e.ruler]);
      const cap = world.entries.find((x) => x.id === e.capital);
      if (cap) facts.push(['Capital', cap.name]);
      if (e.founded) facts.push(['Founded', e.founded]);
    }
    if (e.type === 'faction') {
      if (e.kind) facts.push(['Kind', e.kind]);
      if (e.leader) facts.push(['Leader', e.leader]);
    }
    return facts;
  }

  function openEntry(world, entryId) {
    const entry = LK.store.getEntry(world.id, entryId);
    if (!entry) return;
    const t = TYPES[entry.type];
    const facts = factList(world, entry);
    const rels = entry.type === 'character' ? relationshipsOf(world, entry.id) : [];
    const linkedEvents = world.events.filter((ev) => (ev.links || []).includes(entry.id));

    openModal({
      wide: true,
      title: `${icon(t.icon, 15)} <span class="chip chip-accent">${t.label}</span>`,
      body: `
        <div class="detail-head">
          ${avatar(entry, 'lg')}
          <div class="min-w-0">
            <h2 class="detail-name">${esc(entry.name)}</h2>
            ${subtitle(world, entry) ? `<p class="muted">${esc(subtitle(world, entry))}</p>` : ''}
            ${(entry.tags || []).length ? `<div class="row gap-xs wrap mt-s">${entry.tags.map((tg) => `<span class="chip">${esc(tg)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        ${entry.summary ? `<p class="detail-summary">${esc(entry.summary)}</p>` : ''}
        ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
        ${entry.description ? `<div class="detail-description">${escMultiline(entry.description)}</div>` : ''}
        ${rels.length ? `
          <h4 class="detail-section">${icon('link', 14)} Bonds</h4>
          <div class="stack">
            ${rels.map(({ rel, other }) => {
              const k = REL_KINDS[rel.kind] || REL_KINDS.other;
              return `
              <div class="rel-row" data-action="open-entry" data-id="${other.id}" role="button" tabindex="0">
                <span class="dot" style="background:${k.color}"></span>
                ${avatar(other)}
                <strong class="min-w-0">${esc(other.name)}</strong>
                <span class="chip">${esc(rel.label || k.label)}</span>
              </div>`;
            }).join('')}
          </div>` : ''}
        ${linkedEvents.length ? `
          <h4 class="detail-section">${icon('calendar', 14)} Appears in history</h4>
          <div class="stack">
            ${linkedEvents.map((ev) => `
              <div class="rel-row" data-action="open-event" data-id="${ev.id}" role="button" tabindex="0">
                ${icon('calendar', 15)}
                <strong class="min-w-0">${esc(ev.title)}</strong>
                <span class="chip">${esc(formatYear(ev))}</span>
              </div>`).join('')}
          </div>` : ''}`,
      footer: `
        <button class="btn ghost danger" data-x="delete">${icon('trash', 15)} Delete</button>
        <span class="spacer"></span>
        <button class="btn primary" data-x="edit">${icon('edit', 15)} Edit</button>`,
      onMount(overlay, close) {
        overlay.querySelector('[data-x="edit"]').addEventListener('click', () => {
          close();
          openEntryForm(world, entry.type, entry.id);
        });
        overlay.querySelector('[data-x="delete"]').addEventListener('click', async () => {
          close();
          const ok = await confirm({
            title: `Delete ${t.label.toLowerCase()}?`,
            message: `“${esc(entry.name)}” will be removed permanently, along with its relationships and event links.`,
            confirmLabel: 'Delete',
          });
          if (!ok) return;
          LK.store.deleteEntry(world.id, entry.id);
          toast(`${t.label} deleted`);
          LK.app.rerender();
        });
      },
    });
  }

  function imageUploader(value) {
    return `
      <div class="image-uploader">
        <div class="image-preview ${value ? '' : 'empty'}" data-role="img-preview">
          ${value ? `<img src="${value}" alt="Preview">` : `<span class="muted small">${icon('image', 20)}<br>No image yet</span>`}
        </div>
        <div class="row gap-s wrap">
          <label class="btn ghost sm">${icon('upload', 14)} Upload image
            <input type="file" accept="image/*" hidden data-role="img-file">
          </label>
          ${value ? `<button type="button" class="btn ghost sm" data-role="img-remove">${icon('trash', 14)} Remove</button>` : ''}
        </div>
        <p class="muted xsmall">Stored locally in your browser. Large images are resized automatically.</p>
      </div>`;
  }

  function wireImageUploader(overlay, getImage, setImage, opts = {}) {
    const fileSel = opts.fileSel || '[data-role="img-file"]';
    const prevSel = opts.prevSel || '[data-role="img-preview"]';
    const fileInput = overlay.querySelector(fileSel);
    if (!fileInput) return;
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        setImage(await readImage(file, 720));
        const prev = overlay.querySelector(prevSel);
        prev.classList.remove('empty');
        prev.innerHTML = `<img src="${getImage()}" alt="Preview">`;
        toast(opts.message || 'Image attached — remember to save');
      } catch (err) {
        toast(err.message || 'Could not load that image', 'error');
      }
      fileInput.value = '';
    });
    const removeBtn = overlay.querySelector('[data-role="img-remove"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        setImage('');
        const prev = overlay.querySelector(prevSel);
        prev.classList.add('empty');
        prev.innerHTML = `<span class="muted small">${icon('image', 20)}<br>No image yet</span>`;
        removeBtn.remove();
      });
    }
  }

  function openEntryForm(world, type, entryId) {
    const t = TYPES[type];
    const editing = entryId ? LK.store.getEntry(world.id, entryId) : null;
    const e = editing || {
      name: '', summary: '', description: '', tags: [], image: '',
      role: '', age: '', pronouns: '', kind: '', ruler: '', capital: '', founded: '', leader: '',
    };
    let imageValue = e.image || '';
    const locations = LK.store.entriesByType(world.id, 'location');

    const typeFields = [];
    if (type === 'character') {
      typeFields.push(
        field('Role / title', `<input class="input" name="role" value="${esc(e.role)}" maxlength="120" placeholder="Queen, smuggler, archivist…">`),
        field('Age', `<input class="input" name="age" value="${esc(e.age)}" maxlength="40" placeholder="Age or era">`),
        field('Pronouns', `<input class="input" name="pronouns" value="${esc(e.pronouns)}" maxlength="40" placeholder="she/her, they/them…">`)
      );
    } else if (type === 'location') {
      typeFields.push(field('Kind of place', `<input class="input" name="kind" value="${esc(e.kind)}" maxlength="80" placeholder="City, forest, ruin, floating citadel…">`));
    } else if (type === 'kingdom') {
      typeFields.push(
        field('Ruler', `<input class="input" name="ruler" value="${esc(e.ruler)}" maxlength="120" placeholder="Who holds the throne?">`),
        field('Capital', `<select class="select" name="capital">
            <option value="">— none —</option>
            ${locations.map((l) => `<option value="${l.id}" ${e.capital === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
          </select>`),
        field('Founded', `<input class="input" name="founded" value="${esc(e.founded)}" maxlength="80" placeholder="Year or era">`)
      );
    } else if (type === 'faction') {
      typeFields.push(
        field('Kind', `<input class="input" name="kind" value="${esc(e.kind)}" maxlength="80" placeholder="Guild, order, cult, company…">`),
        field('Leader', `<input class="input" name="leader" value="${esc(e.leader)}" maxlength="120" placeholder="Who leads it?">`)
      );
    }

    openModal({
      wide: true,
      title: editing ? `Edit ${t.label.toLowerCase()}` : `New ${t.label.toLowerCase()}`,
      body: `
        <div class="form-grid">
          ${field('Name *', `<input class="input" name="name" value="${esc(e.name)}" maxlength="80" required>`, 'span-2')}
          ${typeFields.join('')}
          ${field('Short summary', `<input class="input" name="summary" value="${esc(e.summary)}" maxlength="160" placeholder="One-line introduction">`, 'span-2')}
          ${field('Tags', `<input class="input" name="tags" value="${esc((e.tags || []).join(', '))}" placeholder="comma, separated, tags">`, 'span-2')}
          ${field('Description', `<textarea class="input" name="description" rows="7" placeholder="History, personality, secrets…">${esc(e.description)}</textarea>`, 'span-2')}
          ${field('Portrait / image', imageUploader(imageValue), 'span-2')}
        </div>`,
      footer: `
        <button type="button" class="btn ghost" data-x="cancel">Cancel</button>
        <button type="button" class="btn primary" data-x="save">${icon('check', 15)} ${editing ? 'Save changes' : `Add ${t.label.toLowerCase()}`}</button>`,
      onMount(overlay, close) {
        wireImageUploader(overlay, () => imageValue, (v) => { imageValue = v; });

        const save = () => {
          const nameInput = overlay.querySelector('[name="name"]');
          const name = nameInput.value.trim();
          if (!name) {
            nameInput.classList.add('invalid');
            nameInput.focus();
            return;
          }
          const val = (n) => {
            const el = overlay.querySelector(`[name="${n}"]`);
            return el ? el.value.trim() : '';
          };
          const patch = {
            name,
            summary: val('summary'),
            description: overlay.querySelector('[name="description"]').value,
            tags: parseTags(val('tags')),
            image: imageValue,
          };
          if (type === 'character') {
            patch.role = val('role');
            patch.age = val('age');
            patch.pronouns = val('pronouns');
          } else if (type === 'location') {
            patch.kind = val('kind');
          } else if (type === 'kingdom') {
            patch.ruler = val('ruler');
            patch.capital = val('capital');
            patch.founded = val('founded');
          } else if (type === 'faction') {
            patch.kind = val('kind');
            patch.leader = val('leader');
          }
          if (editing) LK.store.updateEntry(world.id, editing.id, patch);
          else LK.store.addEntry(world.id, { type, ...patch });
          close();
          toast(editing ? `${t.label} updated` : `${t.label} added`);
          LK.app.rerender();
        };

        overlay.querySelector('[data-x="cancel"]').addEventListener('click', () => close());
        overlay.querySelector('[data-x="save"]').addEventListener('click', save);
        overlay.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && ev.target.type !== 'file') {
            ev.preventDefault();
            save();
          }
        });
      },
    });
  }

  /* ============================================================
     Timeline
     ============================================================ */
  function renderTimeline(el, world) {
    const eras = uniqueEras(world);
    if (tlState.era && !eras.includes(tlState.era)) tlState.era = '';

    el.innerHTML = `
      <div class="tab-head">
        <div><h2>Timeline</h2><p class="muted">The history of ${esc(world.name)}, one event at a time.</p></div>
        <button class="btn primary" data-action="add-event">${icon('plus', 16)} Record event</button>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 15)}
          <input id="tl-query" class="input" type="text" placeholder="Search events…" value="${esc(tlState.query)}">
        </div>
        <select id="tl-era" class="select" aria-label="Filter by era">
          <option value="">All eras</option>
          ${eras.map((era) => `<option value="${esc(era)}" ${tlState.era === era ? 'selected' : ''}>${esc(era)}</option>`).join('')}
        </select>
      </div>
      <div id="tl-list"></div>`;

    const paint = () => {
      const hasFilter = tlState.query.trim() || tlState.era;
      document.getElementById('tl-list').innerHTML =
        listEvents(world) || (hasFilter ? noResults() : emptyTimeline());
    };
    paint();
    document.getElementById('tl-query').addEventListener('input', (e) => { tlState.query = e.target.value; paint(); });
    document.getElementById('tl-era').addEventListener('change', (e) => { tlState.era = e.target.value; paint(); });
  }

  function uniqueEras(world) {
    const set = new Set();
    world.events.forEach((ev) => { if (ev.era) set.add(ev.era); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  function listEvents(world) {
    const q = tlState.query.trim().toLowerCase();
    let list = [...world.events];
    if (tlState.era) list = list.filter((ev) => ev.era === tlState.era);
    if (q) {
      list = list.filter((ev) =>
        [ev.title, ev.description, ev.era, ev.dateText].join(' ').toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const ay = a.year === null ? Number.MAX_SAFE_INTEGER : a.year;
      const by = b.year === null ? Number.MAX_SAFE_INTEGER : b.year;
      return ay - by || a.createdAt - b.createdAt;
    });
    return list.map((ev) => eventItem(world, ev)).join('');
  }

  function eventItem(world, ev) {
    const links = (ev.links || []).map((id) => world.entries.find((e) => e.id === id)).filter(Boolean);
    return `
      <div class="tl-item">
        <div class="tl-marker ${ev.importance === 2 ? 'major' : ev.importance === 0 ? 'minor' : ''}"></div>
        <div class="tl-when"><span class="tl-year">${esc(formatYear(ev))}</span></div>
        <div class="tl-card" data-action="open-event" data-id="${ev.id}" tabindex="0" role="button">
          <h3>${esc(ev.title)}</h3>
          ${ev.description ? `<p class="muted clamp-3">${esc(ev.description)}</p>` : ''}
          ${links.length ? `<div class="row gap-xs wrap mt-s">${links.map((l) => `
            <span class="chip chip-link" data-action="open-entry" data-id="${l.id}" role="button" tabindex="0">${icon(TYPES[l.type].icon, 12)} ${esc(l.name)}</span>`).join('')}</div>` : ''}
        </div>
      </div>`;
  }

  function emptyTimeline() {
    return `
      <div class="empty">
        <div class="empty-glyph">${icon('calendar', 26)}</div>
        <h3>No events recorded yet</h3>
        <p class="muted">Wars, coronations, disasters, quiet Tuesdays — write them down.</p>
        <button class="btn primary mt-s" data-action="add-event">${icon('plus', 16)} Record your first event</button>
      </div>`;
  }

  function eventRow(world, ev) {
    return `
      <div class="rel-row" data-action="open-event" data-id="${ev.id}" role="button" tabindex="0">
        ${icon('calendar', 15)}
        <strong class="min-w-0">${esc(ev.title)}</strong>
        <span class="chip">${esc(formatYear(ev))}</span>
      </div>`;
  }

  function openEvent(world, eventId) {
    const ev = LK.store.getEvent(world.id, eventId);
    if (!ev) return;
    const links = (ev.links || []).map((id) => world.entries.find((e) => e.id === id)).filter(Boolean);
    const impLabel = ev.importance === 2 ? 'Major event' : ev.importance === 0 ? 'Minor note' : 'Standard event';

    openModal({
      wide: true,
      title: `${icon('calendar', 15)} <span class="chip chip-accent">${esc(impLabel)}</span>`,
      body: `
        <div class="detail-head">
          <div class="min-w-0">
            <h2 class="detail-name">${esc(ev.title)}</h2>
            <p class="muted">${esc(formatYear(ev))}</p>
          </div>
        </div>
        ${ev.description ? `<div class="detail-description">${escMultiline(ev.description)}</div>` : ''}
        ${links.length ? `
          <h4 class="detail-section">${icon('link', 14)} Linked entries</h4>
          <div class="row gap-xs wrap">
            ${links.map((l) => `
              <span class="chip chip-link" data-action="open-entry" data-id="${l.id}" role="button" tabindex="0">
                ${icon(TYPES[l.type].icon, 12)} ${esc(l.name)}
              </span>`).join('')}
          </div>` : ''}`,
      footer: `
        <button class="btn ghost danger" data-x="delete">${icon('trash', 15)} Delete</button>
        <span class="spacer"></span>
        <button class="btn primary" data-x="edit">${icon('edit', 15)} Edit</button>`,
      onMount(overlay, close) {
        overlay.querySelector('[data-x="edit"]').addEventListener('click', () => {
          close();
          openEventForm(world, ev.id);
        });
        overlay.querySelector('[data-x="delete"]').addEventListener('click', async () => {
          close();
          const ok = await confirm({
            title: 'Delete event?',
            message: `“${esc(ev.title)}” will be struck from the timeline permanently.`,
            confirmLabel: 'Delete',
          });
          if (!ok) return;
          LK.store.deleteEvent(world.id, ev.id);
          toast('Event deleted');
          LK.app.rerender();
        });
      },
    });
  }

  function openEventForm(world, eventId) {
    const editing = eventId ? LK.store.getEvent(world.id, eventId) : null;
    const e = editing || { title: '', era: '', year: null, dateText: '', description: '', importance: 1, links: [] };
    const checked = new Set(e.links || []);

    const linksHTML = world.entries.length
      ? `<div class="field span-2"><span class="field-label">Linked entries</span>
          <div class="links-picker">
            ${world.entries.map((en) => `
              <label class="pick">
                <input type="checkbox" name="links" value="${en.id}" ${checked.has(en.id) ? 'checked' : ''}>
                <span>${icon(TYPES[en.type].icon, 13)} ${esc(en.name)}</span>
              </label>`).join('')}
          </div>
        </div>`
      : '';

    openModal({
      wide: true,
      title: editing ? 'Edit event' : 'Record an event',
      body: `
        <div class="form-grid">
          ${field('Title *', `<input class="input" name="title" value="${esc(e.title)}" maxlength="160" required>`, 'span-2')}
          ${field('Year (number)', `<input class="input" name="year" type="number" step="1" value="${e.year === null || e.year === undefined ? '' : e.year}" placeholder="e.g. 412 — leave blank if unknown">`)}
          ${field('Era (optional)', `<input class="input" name="era" value="${esc(e.era)}" maxlength="80" placeholder="e.g. Age of Embers">`)}
          ${field('Or date label', `<input class="input" name="dateText" value="${esc(e.dateText)}" maxlength="80" placeholder="e.g. Midwinter, the third year of the siege">`)}
          ${field('Importance', `<select class="select" name="importance">
              <option value="2" ${e.importance === 2 ? 'selected' : ''}>Major event</option>
              <option value="1" ${e.importance === 1 ? 'selected' : ''}>Standard event</option>
              <option value="0" ${e.importance === 0 ? 'selected' : ''}>Minor note</option>
            </select>`)}
          ${field('Description', `<textarea class="input" name="description" rows="5" placeholder="What happened, and why it echoes forward…">${esc(e.description)}</textarea>`, 'span-2')}
          ${linksHTML}
        </div>`,
      footer: `
        <button type="button" class="btn ghost" data-x="cancel">Cancel</button>
        <button type="button" class="btn primary" data-x="save">${icon('check', 15)} ${editing ? 'Save changes' : 'Record event'}</button>`,
      onMount(overlay, close) {
        const save = () => {
          const titleInput = overlay.querySelector('[name="title"]');
          const title = titleInput.value.trim();
          if (!title) {
            titleInput.classList.add('invalid');
            titleInput.focus();
            return;
          }
          const yearRaw = overlay.querySelector('[name="year"]').value.trim();
          const data = {
            title,
            era: overlay.querySelector('[name="era"]').value.trim(),
            year: yearRaw === '' ? null : Number(yearRaw),
            dateText: overlay.querySelector('[name="dateText"]').value.trim(),
            importance: Number(overlay.querySelector('[name="importance"]').value),
            description: overlay.querySelector('[name="description"]').value,
            links: [...overlay.querySelectorAll('[name="links"]:checked')].map((c) => c.value),
          };
          if (editing) LK.store.updateEvent(world.id, editing.id, data);
          else LK.store.addEvent(world.id, data);
          close();
          toast(editing ? 'Event updated' : 'Event recorded');
          LK.app.rerender();
        };

        overlay.querySelector('[data-x="cancel"]').addEventListener('click', () => close());
        overlay.querySelector('[data-x="save"]').addEventListener('click', save);
        overlay.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && ev.target.type !== 'file' && ev.target.type !== 'checkbox') {
            ev.preventDefault();
            save();
          }
        });
      },
    });
  }

  /* ============================================================
     Relationships (form only — the map lives in map.js)
     ============================================================ */
  function openRelForm(world) {
    const chars = LK.store.entriesByType(world.id, 'character');
    if (chars.length < 2) {
      toast('Add at least two characters first.', 'error');
      return;
    }
    const opt = (sel) => chars.map((c) => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

    openModal({
      title: 'Add a bond',
      body: `
        <div class="form-grid">
          ${field('First character', `<select class="select" name="from">${opt()}</select>`)}
          ${field('Second character', `<select class="select" name="to">${opt(chars[1] ? chars[1].id : '')}</select>`)}
          ${field('Kind of bond', `<select class="select" name="kind">
              ${Object.entries(REL_KINDS).map(([id, k]) => `<option value="${id}" ${id === 'ally' ? 'selected' : ''}>${k.label}</option>`).join('')}
            </select>`)}
          ${field('Label (optional)', `<input class="input" name="label" maxlength="80" placeholder="Defaults to the kind, e.g. “Sworn rival”">`)}
        </div>`,
      footer: `
        <button type="button" class="btn ghost" data-x="cancel">Cancel</button>
        <button type="button" class="btn primary" data-x="save">${icon('link', 15)} Add bond</button>`,
      onMount(overlay, close) {
        const save = () => {
          const from = overlay.querySelector('[name="from"]').value;
          const to = overlay.querySelector('[name="to"]').value;
          const kind = overlay.querySelector('[name="kind"]').value;
          const label = overlay.querySelector('[name="label"]').value.trim();
          if (from === to) {
            toast('A character cannot be bonded to themselves.', 'error');
            return;
          }
          const rel = LK.store.addRelationship(world.id, { from, to, kind, label });
          close();
          if (!rel) toast('That bond already exists.', 'error');
          else {
            toast('Bond added');
            LK.app.rerender();
          }
        };
        overlay.querySelector('[data-x="cancel"]').addEventListener('click', () => close());
        overlay.querySelector('[data-x="save"]').addEventListener('click', save);
      },
    });
  }

  /* ============================================================
     Settings
     ============================================================ */
  function renderSettings(el, world) {
    const pct = Math.min(100, Math.round((LK.store.usage() / 5e6) * 100));
    el.innerHTML = `
      <div class="tab-head">
        <div><h2>World settings</h2><p class="muted">Identity, theme, and data for ${esc(world.name)}.</p></div>
      </div>
      <div class="settings-grid">
        <section class="panel">
          <h3>Identity</h3>
          <div class="form-grid">
            ${field('Name', `<input class="input" name="name" value="${esc(world.name)}" maxlength="60">`)}
            ${field('Genre', `<input class="input" name="genre" value="${esc(world.genre)}" list="genre-list" maxlength="40" placeholder="High Fantasy, Sci-Fi…">${genreDatalist()}`)}
            ${field('Tagline', `<input class="input" name="tagline" value="${esc(world.tagline)}" maxlength="160" placeholder="One line about this universe">`, 'span-2')}
          </div>

          <h3 class="mt-m">Theme</h3>
          <div class="swatches" id="settings-swatches">${LK.themes.swatchHTML(world.theme)}</div>
          <div class="form-grid mt-s">
            ${field('Custom accent colour', `<input type="color" class="color-input" name="accent" value="${world.accent || LK.themes.get(world.theme).swatch[0]}">`)}
          </div>
          <p class="muted xsmall">The accent overrides the theme's base colour for this world. Reset it to return to the theme default.</p>
          <div class="row gap-s mt-m wrap">
            <button class="btn primary" data-x="save">${icon('check', 15)} Save changes</button>
            <button class="btn ghost" data-x="reset-accent">Reset accent</button>
          </div>
        </section>

        <section class="panel">
          <h3>Cover image</h3>
          <div class="image-uploader">
            <div class="image-preview cover-preview ${world.cover ? '' : 'empty'}" data-role="cover-preview">
              ${world.cover ? `<img src="${world.cover}" alt="World cover">` : `<span class="muted small">${icon('image', 20)}<br>No cover yet</span>`}
            </div>
            <div class="row gap-s wrap">
              <label class="btn ghost sm">${icon('upload', 14)} Upload cover
                <input type="file" accept="image/*" hidden data-role="cover-file">
              </label>
              ${world.cover ? `<button type="button" class="btn ghost sm" data-x="cover-remove">${icon('trash', 14)} Remove</button>` : ''}
            </div>
          </div>

          <h3 class="mt-m">Data</h3>
          <p class="muted small">Local storage used: ~${LK.util.fmtBytes(LK.store.usage())} of ~5 MB browser limit.</p>
          <div class="meter ${pct > 85 ? 'meter-danger' : pct > 65 ? 'meter-warn' : ''} mt-s"><span style="width:${pct}%"></span></div>
          ${pct > 65 ? `<p class="muted xsmall mt-s">Running low — connect cloud sync from the account menu (top bar), export a backup, or use fewer images.</p>` : ''}
          <p class="muted small mt-m">Cloud backup: ${esc(LK.cloud ? LK.cloud.describe() : 'not connected')}</p>
          <div class="row gap-s wrap mt-m">
            <button class="btn ghost" data-action="export-world" data-id="${world.id}">${icon('download', 15)} Export world JSON</button>
            <label class="btn ghost">${icon('upload', 15)} Import backup
              <input type="file" accept="application/json" hidden data-x="import">
            </label>
          </div>
          <p class="muted xsmall mt-s">Everything lives in this browser. Export regularly — clearing site data erases your worlds.</p>

          <h3 class="mt-m danger-title">Danger zone</h3>
          <button class="btn danger" data-action="delete-world" data-id="${world.id}">${icon('trash', 15)} Delete this world</button>
        </section>
      </div>`;

    /* identity save */
    el.querySelector('[data-x="save"]').addEventListener('click', () => {
      const name = el.querySelector('[name="name"]').value.trim();
      if (!name) {
        toast('A world needs a name.', 'error');
        return;
      }
      LK.store.updateWorld(world.id, {
        name,
        genre: el.querySelector('[name="genre"]').value.trim(),
        tagline: el.querySelector('[name="tagline"]').value.trim(),
      });
      toast('World updated');
      LK.app.rerender();
    });

    /* theme picking (applies live) */
    bindSwatches(el.querySelector('#settings-swatches'), (id) => {
      LK.store.updateWorld(world.id, { theme: id });
      LK.themes.apply(id, world.accent);
      toast(`Theme: ${LK.themes.get(id).name}`);
    });

    /* custom accent */
    const accent = el.querySelector('[name="accent"]');
    accent.addEventListener('input', debounce(() => {
      LK.store.updateWorld(world.id, { accent: accent.value });
      LK.themes.apply(world.theme, accent.value);
    }, 200));
    el.querySelector('[data-x="reset-accent"]').addEventListener('click', () => {
      LK.store.updateWorld(world.id, { accent: '' });
      LK.themes.apply(world.theme, '');
      LK.app.rerender();
    });

    /* cover image */
    wireImageUploader(el, () => world.cover, (v) => {
      LK.store.updateWorld(world.id, { cover: v });
      toast(v ? 'Cover image saved' : 'Cover removed');
    }, { fileSel: '[data-role="cover-file"]', prevSel: '[data-role="cover-preview"]', message: 'Cover image saved' });
    const coverRemove = el.querySelector('[data-x="cover-remove"]');
    if (coverRemove) {
      coverRemove.addEventListener('click', () => {
        LK.store.updateWorld(world.id, { cover: '' });
        LK.app.rerender();
      });
    }

    /* import */
    const importInput = el.querySelector('[data-x="import"]');
    importInput.addEventListener('change', async () => {
      const file = importInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const n = LK.store.importJSON(text);
        toast(`Imported ${LK.util.plural(n, 'world')} — taking you to your worlds`);
        setTimeout(() => LK.app.go('#/'), 600);
      } catch (err) {
        toast('Import failed: ' + (err.message || 'invalid file'), 'error');
      }
      importInput.value = '';
    });
  }

  /* ============================================================
     Global search (entries + events)
     ============================================================ */
  function openSearch(world) {
    openModal({
      title: `Search “${esc(world.name)}”`,
      body: `
        <div class="search-box big">${icon('search', 17)}
          <input id="global-q" class="input" type="text" placeholder="Search entries and events… ( / to open )">
        </div>
        <div id="global-results" class="stack mt-m"></div>`,
      onMount(overlay, close) {
        const input = overlay.querySelector('#global-q');
        const results = overlay.querySelector('#global-results');

        const paint = () => {
          const q = input.value.trim().toLowerCase();
          if (!q) {
            results.innerHTML = `<p class="muted">Type to search across ${plural(world.entries.length, 'entry')} and ${plural(world.events.length, 'event')}.</p>`;
            return;
          }
          const entries = world.entries.filter((en) =>
            [en.name, en.summary, en.role, en.kind, en.ruler, en.leader, (en.tags || []).join(' ')]
              .join(' ').toLowerCase().includes(q)).slice(0, 12);
          const events = world.events.filter((ev) =>
            [ev.title, ev.description, ev.era, ev.dateText].join(' ').toLowerCase().includes(q)).slice(0, 8);

          if (!entries.length && !events.length) {
            results.innerHTML = `<p class="muted">Nothing found for “${esc(q)}”.</p>`;
            return;
          }
          results.innerHTML = `
            ${entries.length ? `<h4 class="detail-section">${icon('book', 14)} Entries</h4>
            <div class="stack">${entries.map((en) => `
              <div class="rel-row" data-action="open-entry" data-id="${en.id}" role="button" tabindex="0">
                ${avatar(en)}
                <strong class="min-w-0">${esc(en.name)}</strong>
                ${subtitle(world, en) ? `<span class="chip">${esc(subtitle(world, en))}</span>` : ''}
                <span class="chip chip-accent">${TYPES[en.type].label}</span>
              </div>`).join('')}</div>` : ''}
            ${events.length ? `<h4 class="detail-section">${icon('calendar', 14)} Events</h4>
            <div class="stack">${events.map((ev) => `
              <div class="rel-row" data-action="open-event" data-id="${ev.id}" role="button" tabindex="0">
                ${icon('calendar', 15)}
                <strong class="min-w-0">${esc(ev.title)}</strong>
                <span class="chip">${esc(formatYear(ev))}</span>
              </div>`).join('')}</div>` : ''}`;
        };

        input.addEventListener('input', paint);
        paint();
      },
    });
  }

  LK.world = {
    render,
    counts,
    TYPES,
    REL_KINDS,
    subtitle,
    openEntry,
    openEntryForm,
    openEvent,
    openEventForm,
    openRelForm,
    openSearch,
  };
})();
