/* ============================================================
   Lorekeeper — shared UI components
   Icons, toasts, modals, form helpers.
   ============================================================ */
(function () {
  const LK = (window.LK = window.LK || {});
  const { esc, initials } = LK.util;

  /* ---------- inline icon set (stroke, 24px grid) ---------- */
  const ICONS = {
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    crown: '<path d="M2.5 18.5h19"/><path d="M3.5 18.5L2.5 8l5.5 4.5L12 4.5l4 8L21.5 8l-1 10.5"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
  };

  function icon(name, size = 18) {
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  /* ---------- avatar ---------- */
  function avatar(entry, extra = '') {
    const style = entry.image ? ` style="background-image:url('${entry.image}')"` : '';
    return `<span class="avatar ${extra} ${entry.image ? '' : 'avatar-fallback'}"${style}>${
      entry.image ? '' : esc(initials(entry.name))
    }</span>`;
  }

  /* ---------- toasts ---------- */
  function toast(message, type = 'ok') {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 350);
    }, 3200);
  }

  /* ---------- modals ---------- */
  let openStack = [];

  function openModal({ title = '', body = '', footer = '', wide = false, onMount = null, onClose = null }) {
    const root = document.getElementById('modal-root');
    if (!root) return () => {};
    // Purge stale overlays left behind by interrupted closes BEFORE appending.
    root.querySelectorAll('.modal-overlay:not(.open)').forEach((stale) => stale.remove());
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title) || 'Dialog'}">
        <div class="modal-head">
          <h3>${title}</h3>
          <button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x', 16)}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>`;
    root.appendChild(overlay);
    void overlay.offsetWidth; // flush styles so the fade-in runs without rAF (throttled tabs never fire it)
    overlay.classList.add('open');

    let closed = false;
    const close = (result) => {
      if (closed) return;
      closed = true;
      // Remove immediately: delayed removal via setTimeout gets throttled in
      // background tabs, leaving invisible overlays that block page clicks.
      overlay.remove();
      openStack = openStack.filter((m) => m.overlay !== overlay);
      if (onClose) onClose(result);
    };

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });

    openStack.push({ overlay, close });
    if (onMount) onMount(overlay, close);

    const focusable = overlay.querySelector('input:not([type="hidden"]):not([hidden]), select, textarea');
    if (focusable) focusable.focus();
    return close;
  }

  function closeTopModal() {
    const top = openStack[openStack.length - 1];
    if (top) top.close();
  }

  function hasModal() {
    return openStack.length > 0;
  }

  /** Promise-based confirm dialog. Resolves true only on explicit confirm. */
  function confirm({ title = 'Are you sure?', message = '', confirmLabel = 'Delete', danger = true }) {
    return new Promise((resolve) => {
      openModal({
        title: esc(title),
        body: `<p class="confirm-text">${message}</p>`,
        footer: `
          <button type="button" class="btn ghost" data-x="cancel">Cancel</button>
          <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-x="ok">${esc(confirmLabel)}</button>`,
        onMount(overlay, close) {
          overlay.querySelector('[data-x="cancel"]').addEventListener('click', () => close(false));
          overlay.querySelector('[data-x="ok"]').addEventListener('click', () => close(true));
        },
        onClose: (result) => resolve(result === true),
      });
    });
  }

  /* ---------- form helpers ---------- */
  function field(label, control, extraCls = '') {
    return `<label class="field ${extraCls}"><span class="field-label">${label}</span>${control}</label>`;
  }

  function bindSwatches(container, onPick) {
    if (!container) return;
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.swatch');
      if (!btn) return;
      container.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s === btn));
      if (onPick) onPick(btn.dataset.themeId);
    });
  }

  const GENRES = [
    'High Fantasy', 'Dark Fantasy', 'Sword & Sorcery', 'Science Fantasy', 'Sci-Fi',
    'Steampunk', 'Mythic Epic', 'Historical', 'Post-Apocalyptic', 'Horror', 'Other',
  ];

  function genreDatalist(id = 'genre-list') {
    return `<datalist id="${id}">${GENRES.map((g) => `<option value="${esc(g)}">`).join('')}</datalist>`;
  }

  LK.ui = {
    icon, avatar, toast, openModal, closeTopModal, hasModal, confirm,
    field, bindSwatches, GENRES, genreDatalist,
  };
})();
