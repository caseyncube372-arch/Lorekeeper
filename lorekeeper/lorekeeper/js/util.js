/* ============================================================
   Lorekeeper — utilities
   ============================================================ */
(function () {
  const LK = (window.LK = window.LK || {});

  const util = {
    /** Unique id: timestamp + randomness, URL-safe. */
    uid() {
      return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    },

    /** Escape a string for safe interpolation into HTML. */
    esc(value) {
      const AMP = '&' + 'amp;';
      return String(value ?? '').replace(/[&<>"']/g, (ch) => (
        { '&': AMP, '<': '&' + 'lt;', '>': '&' + 'gt;', '"': '&' + 'quot;', "'": '&#39;' }[ch]
      ));
    },

    /** Escape then convert blank lines into paragraphs and newlines into <br>. */
    escMultiline(text) {
      return String(text || '')
        .split(/\n{2,}/)
        .map((p) => `<p>${util.esc(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
    },

    debounce(fn, ms) {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    },

    plural(n, word) {
      return `${n} ${word}${n === 1 ? '' : 's'}`;
    },

    timeAgo(ts) {
      if (!ts) return '—';
      const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
      if (s < 60) return 'just now';
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const d = Math.floor(h / 24);
      if (d < 30) return `${d}d ago`;
      return new Date(ts).toLocaleDateString();
    },

    initials(name) {
      const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
      const out = parts.map((p) => (p[0] || '').toUpperCase()).join('');
      return out || '?';
    },

    truncate(text, n) {
      const s = String(text || '');
      return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
    },

    /** "a, b, c" -> ['a','b','c'] (max 12 tags). */
    parseTags(text) {
      return String(text || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);
    },

    clamp(n, min, max) {
      return Math.min(max, Math.max(min, n));
    },

    /** Human label for an event's point in time. */
    formatYear(ev) {
      if (ev.dateText) return ev.dateText;
      if (typeof ev.year === 'number' && !Number.isNaN(ev.year)) {
        return (ev.era ? `${ev.era} · ` : '') + `Year ${ev.year}`;
      }
      return ev.era || 'Undated';
    },

    slug(name) {
      return (
        String(name || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'world'
      );
    },

    /** Rough storage bytes used by the app's localStorage key (UTF-16). */
    fmtBytes(n) {
      if (n < 1024) return `${n} B`;
      if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
      return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    },

    /** Trigger a client-side JSON download. */
    download(filename, text) {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    /**
     * Read an image file and downscale it so it stores nicely in localStorage.
     * Resolves with a JPEG data URL (max dimension `maxDim`).
     */
    readImage(file, maxDim = 720) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
          reject(new Error('That file is not an image'));
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read that file'));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('Could not load that image'));
          img.onload = () => {
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    },
  };

  LK.util = util;
})();
