// Left object panel (Agent A).
//
// Contract:
//   mountObjectPanel(el, store) — one small box per body showing absolute
//   speed, color swatch, and mass. Update on store.onFrame(...).
//
// Mass and |v| are editable live: edits write straight through to the live
// Body instances in store.sim.bodies, which is the shared mutable state the
// running simulation reads every step. A per-body reset restores the body's
// original mass/velocity (captured when its card was built).

const STYLE_ID = 'object-panel-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .op-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      margin-bottom: 8px;
      background: var(--panel-2, #1a1f2c);
      border: 1px solid var(--border, #2d3748);
      border-radius: 8px;
    }
    .op-swatch {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex: none;
      box-shadow: 0 0 6px currentColor;
    }
    .op-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
      gap: 4px;
    }
    .op-name {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text, #e2e8f0);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .op-fields {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      color: var(--muted, #a0aec0);
    }
    .op-field {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .op-field input {
      width: 52px;
      background: var(--panel, #161b26);
      color: var(--text, #e2e8f0);
      border: 1px solid var(--border, #2d3748);
      border-radius: 4px;
      padding: 2px 4px;
      font-size: 0.75rem;
    }
    .op-field input:focus {
      outline: 1px solid var(--accent, #63b3ed);
    }
    .op-reset {
      flex: none;
      background: var(--panel, #161b26);
      color: var(--muted, #a0aec0);
      border: 1px solid var(--border, #2d3748);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 0.75rem;
      cursor: pointer;
      line-height: 1.4;
    }
    .op-reset:hover {
      background: var(--border, #2d3748);
      color: var(--text, #e2e8f0);
    }
    .op-heading {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted, #a0aec0);
      margin: 0 0 10px;
    }
  `;
  document.head.appendChild(style);
}

const MIN_MASS = 1e-6;

export function mountObjectPanel(el, store) {
  ensureStyles();
  el.innerHTML = '';

  const heading = document.createElement('h2');
  heading.className = 'op-heading';
  heading.textContent = 'Bodies';
  el.appendChild(heading);

  const list = document.createElement('div');
  el.appendChild(list);

  // entries: [{ body, massInput, speedInput, origMass, origVelocity }] indexed by body index
  let entries = [];

  function buildCards() {
    list.innerHTML = '';
    entries = store.sim.bodies.map((b, i) => {
      const card = document.createElement('div');
      card.className = 'op-card';

      const swatch = document.createElement('span');
      swatch.className = 'op-swatch';
      swatch.style.background = b.color;
      swatch.style.color = b.color;

      const info = document.createElement('div');
      info.className = 'op-info';

      const nameRow = document.createElement('div');
      nameRow.style.display = 'flex';
      nameRow.style.alignItems = 'center';
      nameRow.style.justifyContent = 'space-between';
      nameRow.style.gap = '6px';

      const name = document.createElement('div');
      name.className = 'op-name';
      name.textContent = b.name;

      const resetBtn = document.createElement('button');
      resetBtn.className = 'op-reset';
      resetBtn.type = 'button';
      resetBtn.textContent = '↺'; // ↺
      resetBtn.title = `Reset ${b.name} to its original mass and speed`;

      nameRow.appendChild(name);
      nameRow.appendChild(resetBtn);

      const fields = document.createElement('div');
      fields.className = 'op-fields';

      const massField = document.createElement('label');
      massField.className = 'op-field';
      massField.htmlFor = `op-mass-${i}`;
      massField.append('m=');
      const massInput = document.createElement('input');
      massInput.type = 'number';
      massInput.step = 'any';
      massInput.min = String(MIN_MASS);
      massInput.id = `op-mass-${i}`;
      massInput.name = `op-mass-${i}`;
      massField.appendChild(massInput);

      const speedField = document.createElement('label');
      speedField.className = 'op-field';
      speedField.htmlFor = `op-speed-${i}`;
      speedField.append('|v|=');
      const speedInput = document.createElement('input');
      speedInput.type = 'number';
      speedInput.step = 'any';
      speedInput.min = '0';
      speedInput.id = `op-speed-${i}`;
      speedInput.name = `op-speed-${i}`;
      speedField.appendChild(speedInput);

      fields.appendChild(massField);
      fields.appendChild(speedField);

      info.appendChild(nameRow);
      info.appendChild(fields);
      card.appendChild(swatch);
      card.appendChild(info);
      list.appendChild(card);

      massInput.value = b.mass;
      speedInput.value = b.speed.toFixed(2);

      // Original values captured at card-build time (fresh bodies from a
      // preset build) — this is what the per-body reset restores.
      const origMass = b.mass;
      const origVelocity = [...b.velocity];

      massInput.addEventListener('change', () => {
        const v = parseFloat(massInput.value);
        const clamped = Number.isFinite(v) ? Math.max(v, MIN_MASS) : MIN_MASS;
        b.mass = clamped;
        massInput.value = clamped;
      });

      speedInput.addEventListener('change', () => {
        const newSpeed = Math.max(parseFloat(speedInput.value) || 0, 0);
        const cur = b.speed;
        if (cur > 0) {
          const factor = newSpeed / cur;
          b.velocity = b.velocity.map((c) => c * factor);
        } else {
          // Body was at rest with no direction to preserve — kick it along +x.
          b.velocity = [newSpeed, 0, 0];
        }
        speedInput.value = newSpeed.toFixed(2);
      });

      resetBtn.addEventListener('click', () => {
        b.mass = origMass;
        b.velocity = [...origVelocity];
        massInput.value = origMass;
        speedInput.value = b.speed.toFixed(2);
      });

      return { body: b, massInput, speedInput, origMass, origVelocity };
    });
  }

  buildCards();

  store.onFrame(() => {
    for (const entry of entries) {
      // Don't clobber the speed input while the user is actively editing it.
      if (document.activeElement === entry.speedInput) continue;
      entry.speedInput.value = entry.body.speed.toFixed(2);
    }
  });

  store.onPresetChange(() => {
    buildCards();
  });
}
