// Dedicated "Gravitational Potential" panel: groups the potential-surface
// and equipotential-lines controls that used to be flat entries in the
// generic Display ▾ popover (see displayOptions.js / displayControls.js).
//
// Self-contained: injects its own scoped <style> and DOM, following the
// same mounting convention as displayControls.js.

import { displaySettings } from '../app/displaySettings.js';

const STYLE_ID = 'gravitational-potential-panel-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .gpp-root {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10;
      font-size: 0.8rem;
      user-select: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--panel-2, #1a1f2c);
      border: 1px solid var(--border, #2d3748);
      border-radius: 8px;
      padding: 10px 12px;
      min-width: 200px;
    }
    .gpp-heading {
      color: var(--text, #e2e8f0);
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .gpp-pills {
      display: flex;
      gap: 8px;
    }
    .gpp-pill {
      background: var(--panel, #10141c);
      color: var(--text, #e2e8f0);
      border: 1px solid var(--border, #2d3748);
      border-radius: 999px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .gpp-pill:hover {
      border-color: var(--accent, #63b3ed);
    }
    .gpp-pill-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.5;
    }
    .gpp-pill.on {
      background: var(--accent, #63b3ed);
      color: #0b1220;
      border-color: var(--accent, #63b3ed);
    }
    .gpp-pill.on .gpp-pill-dot {
      opacity: 1;
    }
    .gpp-row {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text, #e2e8f0);
    }
    .gpp-row input {
      accent-color: var(--accent, #63b3ed);
    }
  `;
  document.head.appendChild(style);
}

function makePill(label, key) {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'gpp-pill';
  const dot = document.createElement('span');
  dot.className = 'gpp-pill-dot';
  pill.appendChild(dot);
  pill.append(label);

  function sync(on) {
    pill.classList.toggle('on', on);
  }
  sync(displaySettings[key]);

  pill.addEventListener('click', () => {
    const on = displaySettings.toggle(key);
    sync(on);
  });

  return { pill, sync };
}

function makeSlider(container, key, label, { min, max, step }) {
  const row = document.createElement('label');
  row.className = 'gpp-row';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(displaySettings[key]);
  input.addEventListener('input', () => {
    displaySettings.set(key, parseFloat(input.value));
  });
  row.append(label, input);
  container.appendChild(row);
  return input;
}

/**
 * Mount the "Gravitational Potential" panel: multi-select pills for the
 * surface/lines sub-visualizations, plus their 3 shared sliders.
 * @param {HTMLElement} container  Should be positioned (relative/absolute)
 *   so the panel anchors to its top-right corner.
 */
export function mountGravitationalPotentialPanel(container) {
  ensureStyles();

  const root = document.createElement('div');
  root.className = 'gpp-root';

  const heading = document.createElement('div');
  heading.className = 'gpp-heading';
  heading.textContent = 'Gravitational Potential';
  root.appendChild(heading);

  const pillsRow = document.createElement('div');
  pillsRow.className = 'gpp-pills';
  const surfacePill = makePill('Grav potential', 'showPotentialField');
  const linesPill = makePill('Equipotential lines', 'showEquipotentialLines');
  const jacobiPill = makePill('Jacobi potential', 'showJacobiPotential');
  pillsRow.appendChild(surfacePill.pill);
  pillsRow.appendChild(linesPill.pill);
  pillsRow.appendChild(jacobiPill.pill);
  root.appendChild(pillsRow);

  const scaleInput = makeSlider(root, 'potentialFieldScale', 'Scale', { min: -10, max: 30, step: 1 });
  const jacobiScaleInput = makeSlider(root, 'jacobiPotentialScale', 'Jacobi scale', { min: -10, max: 30, step: 1 });
  const lineCountInput = makeSlider(root, 'equipotentialLineCount', 'Number of lines', { min: 2, max: 20, step: 1 });
  const zInput = makeSlider(root, 'potentialFieldZ', 'Z offset', { min: -20, max: 20, step: 0.5 });

  displaySettings.onChange((s) => {
    surfacePill.sync(s.showPotentialField);
    linesPill.sync(s.showEquipotentialLines);
    jacobiPill.sync(s.showJacobiPotential);
    scaleInput.value = String(s.potentialFieldScale);
    jacobiScaleInput.value = String(s.jacobiPotentialScale);
    lineCountInput.value = String(s.equipotentialLineCount);
    zInput.value = String(s.potentialFieldZ);
  });

  container.appendChild(root);
  return root;
}
