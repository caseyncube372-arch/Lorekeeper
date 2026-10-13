/* ============================================================
   Lorekeeper — app core
   Hash router, global event delegation, keyboard shortcuts.
   ============================================================ */
(function () {
  const LK = (window.LK = window.LK || {});
  const { esc } = LK.util;
  const { toast } = LK.ui; // components.js loads before app.js

  const app = (LK.app = {
    parseHash() {
      const h = location.hash.replace(/^#\/?/, '');
      const parts = h.split('/').filter(Boolean);
      if (parts[0] === 'w' && parts[1]) {
        return { worldId: parts[1], tab: parts[2] || 'overview' };
      }
      return { worldId: null, tab: null };
    },

    go(hash) {
      if (location.hash === hash) this.render();
      else location.hash = hash;
    },

    rerender() {
      this.render();
    },

    render() {
      const route = this.parseHash();
      document.body.dataset.view = route.worldId ? 'world' : 'home';
      const el = document.getElementById('app');
      if (!el) return;
      if (route.worldId) {
        LK.world.render(el, route.worldId, route.tab);
      } else {
        LK.themes.apply('arcane');
        LK.dashboard.render(el);
      }
      if (LK.cloud) LK.cloud.paintPills();
    },

    savedFlash() {
      const el = document.getElementById('save-indicator');
      if (!el) return;
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1200);
    },
  });

  /* ---------- global click delegation ---------- */
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    const route = app.parseHash();
    const world = route.worldId ? LK.store.getWorld(route.worldId) : null;

    switch (action) {
      case 'close-modal':
        LK.ui.closeTopModal();
        break;

      case 'new-world':
        LK.dashboard.openNewWorld();
        break;

      case 'load-demo': {
        if (LK.store.state.worlds.some((w) => w.name === 'Aethermoor')) {
          toast('The demo world “Aethermoor” is already in your list.');
          app.render();
          break;
        }
        LK.store.state.worlds.push(LK.demo.build());
        LK.store.save();
        toast('Demo world “Aethermoor” added — explore freely');
        app.render();
        break;
      }

      case 'world-settings':
        app.go(`#/w/${t.dataset.id}/settings`);
        break;

      case 'open-search':
        if (world) LK.world.openSearch(world);
        break;

      case 'open-account':
        LK.cloud.openAccount();
        break;

      case 'sync-now':
        LK.cloud.syncNow();
        break;

      case 'sign-out':
        LK.cloud.signOut();
        break;

      case 'add-entry':
        if (world) LK.world.openEntryForm(world, t.dataset.type);
        break;

      case 'open-entry':
        if (world) LK.world.openEntry(world, t.dataset.id);
        break;

      case 'add-event':
        if (world) LK.world.openEventForm(world);
        break;

      case 'open-event':
        if (world) LK.world.openEvent(world, t.dataset.id);
        break;

      case 'add-rel':
        if (world) LK.world.openRelForm(world);
        break;

      case 'delete-rel': {
        if (!world) break;
        const rel = world.relationships.find((r) => r.id === t.dataset.id);
        if (!rel) break;
        const a = world.entries.find((x) => x.id === rel.from);
        const b = world.entries.find((x) => x.id === rel.to);
        const ok = await LK.ui.confirm({
          title: 'Remove bond?',
          message: `The bond between <strong>${esc(a ? a.name : '?')}</strong> and <strong>${esc(b ? b.name : '?')}</strong> will be removed.`,
          confirmLabel: 'Remove',
        });
        if (!ok) break;
        LK.store.deleteRelationship(world.id, rel.id);
        toast('Bond removed');
        app.rerender();
        break;
      }

      case 'export-world': {
        const w = LK.store.getWorld(t.dataset.id);
        if (!w) break;
        LK.util.download(`${LK.util.slug(w.name)}-lorekeeper.json`, LK.store.exportWorld(w));
        toast('World exported as JSON');
        break;
      }

      case 'delete-world': {
        const w = LK.store.getWorld(t.dataset.id);
        if (!w) break;
        const ok = await LK.ui.confirm({
          title: 'Delete world?',
          message: `“${esc(w.name)}” and everything in it will be gone forever. Consider exporting a backup first.`,
          confirmLabel: 'Delete world',
        });
        if (!ok) break;
        LK.store.deleteWorld(w.id);
        toast('World deleted');
        if (route.worldId === w.id) app.go('#/');
        else app.render();
        break;
      }
    }
  });

  /* ---------- keyboard: Enter activates card "buttons", Esc closes modals, "/" opens search ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (LK.ui.hasModal()) {
        e.preventDefault();
        LK.ui.closeTopModal();
      }
      return;
    }
    const target = e.target;
    const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    if (e.key === 'Enter' && target && target.matches && target.matches('[role="button"][data-action]')) {
      e.preventDefault();
      target.click();
      return;
    }
    if (!typing && e.key === '/') {
      const route = app.parseHash();
      if (route.worldId && !LK.ui.hasModal()) {
        e.preventDefault();
        LK.world.openSearch(LK.store.getWorld(route.worldId));
      }
    }
  });

  /* ---------- boot ---------- */
  window.addEventListener('hashchange', () => app.render());
  LK.store.load();
  if (!location.hash) history.replaceState(null, '', '#/');
  app.render();
  if (LK.cloud) LK.cloud.init();
})();
