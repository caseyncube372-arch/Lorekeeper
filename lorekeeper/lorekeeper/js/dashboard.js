/* ============================================================
   Lorekeeper — dashboard
   World cards, hero, creation flow.
   ============================================================ */
(function () {
  const LK = (window.LK = window.LK || {});
  const { esc, timeAgo, plural } = LK.util;
  const { icon, field, toast, openModal, bindSwatches, genreDatalist } = LK.ui;

  function counts(world) {
    return LK.world.counts(world);
  }

  function coverHTML(world) {
    if (world.cover) {
      return `<div class="cover" style="background-image:url('${world.cover}')"></div>`;
    }
    return `<div class="cover t-${esc(world.theme)}"><span class="cover-glyph">${icon('globe', 26)}</span></div>`;
  }

  function worldCard(world) {
    const c = counts(world);
    return `
      <article class="world-card">
        <a class="card-link" href="#/w/${world.id}">
          ${coverHTML(world)}
          <div class="world-card-body">
            <div class="world-card-title">
              <h3>${esc(world.name)}</h3>
              ${world.genre ? `<span class="chip chip-accent">${esc(world.genre)}</span>` : ''}
            </div>
            ${world.tagline ? `<p class="muted small">${esc(world.tagline)}</p>` : ''}
            <div class="world-counts">
              <span title="Characters">${icon('users', 13)} ${c.character}</span>
              <span title="Locations">${icon('pin', 13)} ${c.location}</span>
              <span title="Kingdoms">${icon('crown', 13)} ${c.kingdom}</span>
              <span title="Factions">${icon('flag', 13)} ${c.faction}</span>
              <span title="Timeline events">${icon('calendar', 13)} ${c.event}</span>
            </div>
          </div>
        </a>
        <div class="world-card-foot">
          <span class="muted small">Updated ${timeAgo(world.updatedAt)}</span>
          <span class="row gap-xs">
            <button class="icon-btn" data-action="world-settings" data-id="${world.id}" title="Settings" aria-label="World settings">${icon('edit', 14)}</button>
            <button class="icon-btn" data-action="export-world" data-id="${world.id}" title="Export JSON" aria-label="Export world">${icon('download', 14)}</button>
            <button class="icon-btn" data-action="delete-world" data-id="${world.id}" title="Delete world" aria-label="Delete world">${icon('trash', 14)}</button>
          </span>
        </div>
      </article>`;
  }

  function emptyState() {
    return `
      <div class="empty">
        <div class="empty-glyph">${icon('book', 30)}</div>
        <h3>No worlds yet</h3>
        <p class="empty-script">every saga needs a first page</p>
        <p class="muted">Forge your first world above, or load the demo to explore.</p>
      </div>`;
  }

  /* Hand-drawn flourish divider: hairlines meeting a gold gem. */
  const flourish = `
    <svg class="flourish" viewBox="0 0 160 16" width="160" height="16" aria-hidden="true" fill="none">
      <line x1="2" y1="8" x2="60" y2="8"></line>
      <path class="gem" d="M80 1.5 L87.5 8 L80 14.5 L72.5 8 Z"></path>
      <line x1="100" y1="8" x2="158" y2="8"></line>
    </svg>`;

  function render(el) {
    const worlds = LK.store.state.worlds;
    el.innerHTML = `
      <header class="topbar">
        <a class="brand" href="#/">
          ${icon('book', 24)}
          <span class="brand-text">
            <span class="brand-name">Lorekeeper</span>
            <span class="brand-script">a chronicle of worlds</span>
          </span>
        </a>
        <nav class="topnav">
          <a href="#/" class="active">Worlds</a>
          <button class="cloud-pill" data-cloud-pill data-action="open-account"></button>
          <button class="btn primary" data-action="new-world">${icon('plus', 15)} New world</button>
        </nav>
      </header>
      <main class="page">
        <section class="hero">
          <p class="hero-script">Welcome, world-smith</p>
          <h1>Every legend<br>begins somewhere.</h1>
          ${flourish}
          <p class="lede">Create fictional universes, organise your lore, and wander through your own creations — characters, kingdoms, factions, and the history that binds them.</p>
          <div class="row gap-m wrap hero-cta">
            <button class="btn primary lg" data-action="new-world">${icon('sparkles', 17)} Create a world</button>
            ${worlds.length === 0 ? `<button class="btn ghost lg" data-action="load-demo">${icon('book', 17)} Load a demo world</button>` : ''}
          </div>
        </section>
        ${worlds.length ? `
          <section>
            <div class="section-head">
              <h2>Your worlds</h2>
              <span class="row gap-s wrap">
                <button class="btn ghost sm" data-action="load-demo" title="Add the demo world to your list">${icon('book', 14)} Load demo world</button>
                <span class="muted small">${plural(worlds.length, 'world')} · saved in this browser</span>
              </span>
            </div>
            <div class="grid worlds-grid">${worlds.map(worldCard).join('')}</div>
          </section>` : emptyState()}
      </main>
      <footer class="footer">
        <p class="footer-script">…and so the ink remembers what the world forgets.</p>
        <p class="muted small">Lorekeeper — your lore lives in this browser's local storage. Export worlds from their settings as backups.</p>
        <p class="credit">Created by: <span class="credit-name">NocturneNightcall</span></p>
      </footer>`;
  }

  /* ---------- new world modal ---------- */
  function openNewWorld() {
    let pickedTheme = 'arcane';
    openModal({
      title: 'Create a new world',
      body: `
        <div class="form-grid">
          ${field('Name *', `<input class="input" name="name" maxlength="60" placeholder="e.g. Aethermoor" required>`, 'span-2')}
          ${field('Tagline', `<input class="input" name="tagline" maxlength="160" placeholder="One line about this universe">`, 'span-2')}
          ${field('Genre', `<input class="input" name="genre" list="genre-list" maxlength="40" placeholder="High Fantasy, Sci-Fi, Mythic…">${genreDatalist()}`, 'span-2')}
          <div class="field span-2"><span class="field-label">Theme</span>
            <div class="swatches">${LK.themes.swatchHTML(pickedTheme)}</div>
          </div>
        </div>`,
      footer: `
        <button type="button" class="btn ghost" data-x="cancel">Cancel</button>
        <button type="button" class="btn primary" data-x="create">${icon('sparkles', 15)} Create world</button>`,
      onMount(overlay, close) {
        bindSwatches(overlay, (id) => { pickedTheme = id; });

        const create = () => {
          const nameInput = overlay.querySelector('[name="name"]');
          const name = nameInput.value.trim();
          if (!name) {
            nameInput.classList.add('invalid');
            nameInput.focus();
            return;
          }
          const world = LK.store.createWorld({
            name,
            tagline: overlay.querySelector('[name="tagline"]').value.trim(),
            genre: overlay.querySelector('[name="genre"]').value.trim(),
            theme: pickedTheme,
          });
          close();
          toast(`World “${name}” created`);
          LK.app.go(`#/w/${world.id}`);
        };

        overlay.querySelector('[data-x="cancel"]').addEventListener('click', () => close());
        overlay.querySelector('[data-x="create"]').addEventListener('click', create);
        overlay.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            e.preventDefault();
            create();
          }
        });
      },
    });
  }

  LK.dashboard = { render, openNewWorld };
})();
