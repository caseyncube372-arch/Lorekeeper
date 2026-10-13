/* ============================================================
   Lorekeeper — themes
   Each fictional world can wear its own palette. Palettes are
   defined in CSS as body[data-theme="…"] variable sets.
   ============================================================ */
(function () {
  const LK = (window.LK = window.LK || {});

  const themes = [
    { id: 'arcane',    name: 'Arcane Night',  swatch: ['#8b5cf6', '#22d3ee'] },
    { id: 'ember',     name: 'Emberfall',     swatch: ['#fb7185', '#f59e0b'] },
    { id: 'verdant',   name: 'Verdant Wilds', swatch: ['#34d399', '#a3e635'] },
    { id: 'tide',      name: 'Tidal Depths',  swatch: ['#38bdf8', '#818cf8'] },
    { id: 'gilded',    name: 'Gilded Age',    swatch: ['#e0b354', '#c2703d'] },
    { id: 'parchment', name: 'Parchment',     swatch: ['#b45309', '#78350f'] },
  ];

  LK.themes = {
    list: themes,

    get(id) {
      return themes.find((t) => t.id === id) || null;
    },

    /** Swatch picker markup. Pair with ui.bindSwatches(container, onPick). */
    swatchHTML(activeId) {
      return themes
        .map(
          (t) => `
          <button type="button" class="swatch ${t.id === activeId ? 'active' : ''}"
                  data-theme-id="${t.id}" title="${t.name}" aria-label="${t.name}"
                  style="--s1:${t.swatch[0]};--s2:${t.swatch[1]}"></button>`
        )
        .join('');
    },

    /** Apply a world's theme (and optional accent override) to the page. */
    apply(themeId, accent) {
      const id = this.get(themeId) ? themeId : 'arcane';
      document.body.dataset.theme = id;
      if (accent && /^#[0-9a-fA-F]{6}$/.test(accent)) {
        document.body.style.setProperty('--accent', accent);
      } else {
        document.body.style.removeProperty('--accent');
      }
    },
  };
})();
