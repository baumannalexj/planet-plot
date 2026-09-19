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
//
// Also renders a read-only listing of Config's constants below the body
// cards (WI-3). Not editable yet — SOFTENING/G_REAL etc. are read once at
// module import time in constants.js/Simulation.js, so making them live
// would need those to read from Config on every use instead; tracked
// separately.

import { config } from '../core/Config.js';
import { computeMetric } from '../plots/metrics.js';

// Per-body live calc readout (WI-4, first pass): only metrics already in the
// plot registry (metrics.js) — speed/ke/pe are coordinate-system-independent,
// r/theta/phi are this body's position in the spherical system, relative to
// store.origin (matches the "3D view coordinate system, relative to center
// of mass" decision). ψ/ψ̇ (rigid-body orientation) and dA/dt (not yet a
// registered metric) are deliberately left out of this first pass.
const CALC_COORD_SYSTEM = 'spherical';
const CALC_METRICS = [
  { id: 'speed', label: 'V' },
  { id: 'ke', label: 'K' },
  { id: 'pe', label: 'U' },
  { id: 'r', label: 'r' },
  { id: 'theta', label: 'θ' },
  { id: 'phi', label: 'φ' },
  { id: 'rdot', label: 'ṟ' },
  { id: 'thetadot', label: 'θ̇' },
  { id: 'phidot', label: 'φ̇' },
  { id: 'dAdt', label: 'dA/dt' },
];

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
    .op-constants {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--border, #2d3748);
    }
    .op-constant-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 0.75rem;
      color: var(--muted, #a0aec0);
      padding: 2px 0;
    }
    .op-constant-row span:first-child { color: var(--text, #e2e8f0); }
    .op-constant-row input {
      width: 90px;
      background: var(--panel, #161b26);
      color: var(--text, #e2e8f0);
      border: 1px solid var(--border, #2d3748);
      border-radius: 4px;
      padding: 2px 4px;
      font-size: 0.75rem;
      text-align: right;
    }
    .op-constant-row input:focus {
      outline: 1px solid var(--accent, #63b3ed);
    }
    .op-calc {
      margin-top: 6px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2px 8px;
      font-size: 0.7rem;
      color: var(--muted, #a0aec0);
    }
    .op-calc span:first-child { color: var(--text, #e2e8f0); }
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

      const xField = document.createElement('label');
      xField.className = 'op-field';
      xField.htmlFor = `op-x-${i}`;
      xField.append('x=');
      const xInput = document.createElement('input');
      xInput.type = 'number';
      xInput.step = 'any';
      xInput.id = `op-x-${i}`;
      xInput.name = `op-x-${i}`;
      xField.appendChild(xInput);

      const yField = document.createElement('label');
      yField.className = 'op-field';
      yField.htmlFor = `op-y-${i}`;
      yField.append('y=');
      const yInput = document.createElement('input');
      yInput.type = 'number';
      yInput.step = 'any';
      yInput.id = `op-y-${i}`;
      yInput.name = `op-y-${i}`;
      yField.appendChild(yInput);

      const zField = document.createElement('label');
      zField.className = 'op-field';
      zField.htmlFor = `op-z-${i}`;
      zField.append('z=');
      const zInput = document.createElement('input');
      zInput.type = 'number';
      zInput.step = 'any';
      zInput.id = `op-z-${i}`;
      zInput.name = `op-z-${i}`;
      zField.appendChild(zInput);

      fields.appendChild(massField);
      fields.appendChild(speedField);
      fields.appendChild(xField);
      fields.appendChild(yField);
      fields.appendChild(zField);

      info.appendChild(nameRow);
      info.appendChild(fields);

      const calc = document.createElement('div');
      calc.className = 'op-calc';
      const calcEls = {};
      for (const { id, label } of CALC_METRICS) {
        const cell = document.createElement('span');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${label}:`;
        const valueSpan = document.createElement('span');
        valueSpan.textContent = '—';
        cell.append(nameSpan, ' ', valueSpan);
        calc.appendChild(cell);
        calcEls[id] = valueSpan;
      }
      info.appendChild(calc);

      card.appendChild(swatch);
      card.appendChild(info);
      list.appendChild(card);

      massInput.value = b.mass;
      speedInput.value = b.speed.toFixed(2);
      xInput.value = b.position[0];
      yInput.value = b.position[1];
      zInput.value = b.position[2];

      // Original values captured at card-build time (fresh bodies from a
      // preset build) — this is what the per-body reset restores.
      const origMass = b.mass;
      const origVelocity = [...b.velocity];
      const origPosition = [...b.position];

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

      xInput.addEventListener('change', () => {
        b.position[0] = parseFloat(xInput.value) || 0;
      });

      yInput.addEventListener('change', () => {
        b.position[1] = parseFloat(yInput.value) || 0;
      });

      zInput.addEventListener('change', () => {
        b.position[2] = parseFloat(zInput.value) || 0;
      });

      resetBtn.addEventListener('click', () => {
        b.mass = origMass;
        b.velocity = [...origVelocity];
        b.position = [...origPosition];
        massInput.value = origMass;
        speedInput.value = b.speed.toFixed(2);
        xInput.value = b.position[0];
        yInput.value = b.position[1];
        zInput.value = b.position[2];
      });

      return { body: b, massInput, speedInput, xInput, yInput, zInput, calcEls, origMass, origVelocity, origPosition };
    });
  }

  buildCards();

  store.onFrame((snapshot) => {
    const relBodies = snapshot.relativeBodies(store.origin);
    entries.forEach((entry, i) => {
      // Don't clobber the speed input while the user is actively editing it.
      if (document.activeElement !== entry.speedInput) {
        entry.speedInput.value = entry.body.speed.toFixed(2);
      }
      // Don't clobber position inputs while the user is actively editing them.
      if (document.activeElement !== entry.xInput) {
        entry.xInput.value = entry.body.position[0];
      }
      if (document.activeElement !== entry.yInput) {
        entry.yInput.value = entry.body.position[1];
      }
      if (document.activeElement !== entry.zInput) {
        entry.zInput.value = entry.body.position[2];
      }
      const relBody = relBodies[i];
      if (!relBody) return;
      for (const { id } of CALC_METRICS) {
        const value = computeMetric(id, relBody, snapshot, CALC_COORD_SYSTEM);
        entry.calcEls[id].textContent = Number.isFinite(value) ? value.toFixed(2) : '—';
      }
    });
    // Don't clobber a constant input while the user is actively editing it.
    for (const { key, input } of constantEntries) {
      if (document.activeElement !== input) {
        input.value = config[key];
      }
    }
  });

  store.onPresetChange(() => {
    buildCards();
  });

  // --- Constants (editable) -----------------------------------------------
  const constantsSection = document.createElement('div');
  constantsSection.className = 'op-constants';

  const constantsHeading = document.createElement('h2');
  constantsHeading.className = 'op-heading';
  constantsHeading.textContent = 'Constants';
  constantsSection.appendChild(constantsHeading);

  // key -> input, so store.onFrame can refresh values live without clobbering
  // whichever one the user is actively editing.
  const constantEntries = [];

  // unitMassSolar/unitLengthAu are magnitude MODIFIERS on solarMassKg/auM (not
  // independent values), so they get an extra static span showing what they scale.
  const MODIFIER_REFERENCE = {
    unitMassSolar: () => `${config.solarMassKg} ${config.units.solarMassKg}`,
    unitLengthAu: () => `${config.auM} ${config.units.auM}`,
  };

  for (const { key, label, value, unit } of config.list) {
    const row = document.createElement('div');
    row.className = 'op-constant-row';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = unit ? `${label} (${unit})` : label;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.value = value;
    input.addEventListener('change', () => {
      config[key] = parseFloat(input.value) || 0;
    });
    row.appendChild(nameSpan);
    if (MODIFIER_REFERENCE[key]) {
      const refSpan = document.createElement('span');
      refSpan.textContent = MODIFIER_REFERENCE[key]();
      row.appendChild(refSpan);
    }
    row.appendChild(input);
    constantsSection.appendChild(row);
    constantEntries.push({ key, input });
  }

  el.appendChild(constantsSection);

  // --- Equations (read-only) -----------------------------------------------
  const EQUATIONS = [
    { name: "Kepler's First Law", formula: "r = a(1-e²)/(1+e·cos ν)" },
    { name: "Kepler's Second Law (areal velocity)", formula: "dA/dt = ½r²·φ̇" },
    { name: "Kepler's Third Law", formula: "T² ∝ a³" },
    { name: "Vis-viva equation", formula: "v² = GM(2/r - 1/a)" },
    { name: "Newtonian gravitational force", formula: "F = G·m₁·m₂/r²" },
    { name: "Kinetic energy", formula: "K = ½mv²" },
    { name: "Gravitational potential energy (two-body)", formula: "U = -G·m₁·m₂/r" },
    { name: "Hamiltonian (N-body)", formula: "H = Σᵢ pᵢ²/(2mᵢ) - GΣᵢ<ⱼ mᵢmⱼ/rᵢⱼ" },
    { name: "Lagrangian (N-body)", formula: "L = T - U" },
    { name: "Gravitoelectromagnetism — Gauss's law", formula: "∇·Eg = -4πGρ" },
    { name: "Gravitoelectromagnetism — no gravitomagnetic monopoles", formula: "∇·Bg = 0" },
    { name: "Gravitoelectromagnetism — Faraday-like law", formula: "∇×Eg = -∂Bg/∂t" },
    { name: "Gravitoelectromagnetism — Ampère-like law", formula: "∇×Bg = -4πG/c²·J + (1/c²)∂Eg/∂t" },
  ];

  const equationsSection = document.createElement('div');
  equationsSection.className = 'op-constants';

  const equationsHeading = document.createElement('h2');
  equationsHeading.className = 'op-heading';
  equationsHeading.textContent = 'Equations';
  equationsSection.appendChild(equationsHeading);

  for (const { name, formula } of EQUATIONS) {
    const row = document.createElement('div');
    row.className = 'op-constant-row';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    const formulaSpan = document.createElement('span');
    formulaSpan.textContent = formula;
    row.appendChild(nameSpan);
    row.appendChild(formulaSpan);
    equationsSection.appendChild(row);
  }

  el.appendChild(equationsSection);
}
