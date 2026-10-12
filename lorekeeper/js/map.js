/* ============================================================
   Lorekeeper — relationship map
   Characters are laid out on a ring; bonds are drawn as
   colour-coded edges. Nodes can be dragged; clicking a node
   highlights only its bonds.
   ============================================================ */
(function () {
  const LK = (window.LK = window.LK || {});
  const { esc, initials, truncate, plural, clamp } = LK.util;
  const { icon } = LK.ui;
  const NS = 'http://www.w3.org/2000/svg';

  function relRow(world, r) {
    const a = world.entries.find((e) => e.id === r.from);
    const b = world.entries.find((e) => e.id === r.to);
    if (!a || !b) return '';
    const k = LK.world.REL_KINDS[r.kind] || LK.world.REL_KINDS.other;
    return `
      <div class="rel-row">
        <span class="dot" style="background:${k.color}"></span>
        ${LK.ui.avatar(a)}
        <span class="muted small">⟶</span>
        ${LK.ui.avatar(b)}
        <strong class="min-w-0">${esc(a.name)} <span class="muted">&</span> ${esc(b.name)}</strong>
        <span class="chip">${esc(r.label || k.label)}</span>
        <span class="spacer"></span>
        <button class="icon-btn" data-action="delete-rel" data-id="${r.id}" title="Remove bond" aria-label="Remove bond">${icon('trash', 14)}</button>
      </div>`;
  }

  function render(el, world) {
    const chars = LK.store.entriesByType(world.id, 'character');
    const kinds = LK.world.REL_KINDS;

    el.innerHTML = `
      <div class="tab-head">
        <div><h2>Relationships</h2><p class="muted">Map the bonds between your characters. Drag nodes to rearrange, click one to spotlight its bonds.</p></div>
        <button class="btn primary" data-action="add-rel" ${chars.length < 2 ? 'disabled title="Add at least two characters first"' : ''}>
          ${icon('plus', 16)} Add bond
        </button>
      </div>
      ${chars.length < 2 ? `
        <div class="empty">
          <div class="empty-glyph">${icon('link', 26)}</div>
          <h3>Not enough characters yet</h3>
          <p class="muted">The relationship map needs at least two characters to draw a bond between.</p>
          <button class="btn primary mt-s" data-action="add-entry" data-type="character">${icon('plus', 16)} Add a character</button>
        </div>` : `
        <div class="map-legend">
          ${Object.values(kinds).map((k) => `<span class="legend-item"><span class="dot" style="background:${k.color}"></span>${k.label}</span>`).join('')}
        </div>
        <div class="map-wrap"><svg id="rel-svg" role="img" aria-label="Character relationship map"></svg></div>
        <p class="muted small map-hint">${icon('users', 13)} ${plural(chars.length, 'character')} · ${plural(world.relationships.length, 'bond')} — drag nodes to rearrange, click a node to spotlight its bonds, click empty space to clear.</p>
        <div class="section-head mt-m"><h3>All bonds</h3><span class="muted small">${plural(world.relationships.length, 'bond')}</span></div>
        <div class="stack" id="rel-list">
          ${world.relationships.map((r) => relRow(world, r)).join('') || '<p class="muted">No bonds yet — add one above.</p>'}
        </div>`}
    `;

    if (chars.length >= 2) mount(world, chars);
  }

  function mount(world, chars) {
    const svg = document.getElementById('rel-svg');
    if (!svg) return;
    const W = 900;
    const H = 560;
    const CX = W / 2;
    const CY = H / 2 + 8;
    const R = Math.min(W, H) / 2 - 80;

    /* default ring layout */
    const pos = {};
    chars.forEach((c, i) => {
      const a = (Math.PI * 2 * i) / chars.length - Math.PI / 2;
      pos[c.id] = { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
    });

    const rels = world.relationships.filter((r) => pos[r.from] && pos[r.to]);
    const selected = { id: null };

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '<g id="edges"></g><g id="nodes"></g>';
    const gEdges = svg.querySelector('#edges');
    const gNodes = svg.querySelector('#nodes');

    /* ----- edges ----- */
    const edgeEls = rels.map((rel) => {
      const k = LK.world.REL_KINDS[rel.kind] || LK.world.REL_KINDS.other;
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('class', 'rel-edge');
      line.setAttribute('stroke', k.color);
      const label = document.createElementNS(NS, 'text');
      label.setAttribute('class', 'rel-edge-label');
      label.textContent = rel.label || k.label;
      gEdges.appendChild(line);
      gEdges.appendChild(label);
      return { rel, line, label };
    });

    /* ----- nodes ----- */
    const nodeEls = {};
    chars.forEach((c) => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'rel-node');
      g.dataset.id = c.id;
      g.innerHTML = `
        <circle r="26"></circle>
        <text class="rel-initials" dy="5" text-anchor="middle">${esc(initials(c.name))}</text>
        <text class="rel-name" dy="46" text-anchor="middle">${esc(truncate(c.name, 16))}</text>`;
      gNodes.appendChild(g);
      nodeEls[c.id] = g;
    });

    function layout() {
      for (const e of edgeEls) {
        const a = pos[e.rel.from];
        const b = pos[e.rel.to];
        if (!a || !b) continue;
        e.line.setAttribute('x1', a.x);
        e.line.setAttribute('y1', a.y);
        e.line.setAttribute('x2', b.x);
        e.line.setAttribute('y2', b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const flip = ang > 90 || ang < -90;
        e.label.setAttribute('x', mx);
        e.label.setAttribute('y', my - 7);
        e.label.setAttribute('transform', `rotate(${flip ? ang + 180 : ang} ${mx} ${my})`);
      }
      for (const id in nodeEls) {
        nodeEls[id].setAttribute('transform', `translate(${pos[id].x} ${pos[id].y})`);
      }
    }
    layout();

    function applyFocus() {
      const connected = new Set();
      if (selected.id) {
        rels.forEach((r) => {
          if (r.from === selected.id || r.to === selected.id) {
            connected.add(r.from);
            connected.add(r.to);
          }
        });
      }
      for (const id in nodeEls) {
        nodeEls[id].classList.toggle('dim', !!selected.id && id !== selected.id && !connected.has(id));
        nodeEls[id].classList.toggle('focused', selected.id === id);
      }
      edgeEls.forEach((e) => {
        const on = !selected.id || (e.rel.from === selected.id || e.rel.to === selected.id);
        e.line.classList.toggle('dim', !on);
        e.label.classList.toggle('dim', !on);
      });
    }

    /* ----- client coords → viewBox coords ----- */
    function toSvgPoint(evt) {
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    /* ----- dragging + click-to-focus ----- */
    for (const id in nodeEls) {
      const g = nodeEls[id];
      g.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        try { g.setPointerCapture(ev.pointerId); } catch (e) { /* older browsers */ }
        const start = toSvgPoint(ev);
        const orig = { ...pos[id] };
        let moved = false;

        const onMove = (e2) => {
          const p = toSvgPoint(e2);
          if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < 4) return;
          moved = true;
          pos[id] = { x: clamp(p.x, 46, W - 46), y: clamp(p.y, 40, H - 40) };
          layout();
        };
        const onUp = () => {
          g.removeEventListener('pointermove', onMove);
          g.removeEventListener('pointerup', onUp);
          g.removeEventListener('pointercancel', onUp);
          if (!moved) {
            selected.id = selected.id === id ? null : id;
            applyFocus();
          }
        };
        g.addEventListener('pointermove', onMove);
        g.addEventListener('pointerup', onUp);
        g.addEventListener('pointercancel', onUp);
      });
    }

    /* click on empty canvas clears the spotlight */
    svg.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('.rel-node')) return;
      if (selected.id) {
        selected.id = null;
        applyFocus();
      }
    });
  }

  LK.map = { render };
})();
