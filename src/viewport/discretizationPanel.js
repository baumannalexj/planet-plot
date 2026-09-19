// Shared "Discretization" panel — sliders for the adaptive spherical-shell
// sample grid (see @core/overlays/DiscretizationGrid.js) that all 4
// field/streamline overlays (force field, potential field, equipotential
// lines, field lines) now sample from. Same self-contained-module mounting
// convention as gravitationalPotentialPanel.js/displayControls.js.

import { displaySettings } from '../app/displaySettings.js';

const STYLE_ID = 'discretization-panel-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .disc-root {
      position: absolute;
      bottom: 10px;
      left: 10px;
      z-index: 10;
      font-size: 0.8rem;
      user-select: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: var(--panel-2, #1a1f2c);
      border: 1px solid var(--border, #2d3748);
      border-radius: 8px;
      padding: 10px 12px;
      min-width: 220px;
    }
    .disc-heading {
      color: var(--text, #e2e8f0);
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .disc-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--text, #e2e8f0);
    }
    .disc-row input {
      accent-color: var(--accent, #63b3ed);
      flex: 1;
      margin-left: 8px;
    }
  `;
  document.head.appendChild(style);
}

function makeSlider(container, key, label, { min, max, step }) {
  const row = document.createElement('label');
  row.className = 'disc-row';
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
 * Mount the shared "Discretization" panel — one box, bottom-left, with a
 * slider per shell-grid/render setting shared across all 4 field overlays.
 * @param {HTMLElement} container
 */
export function mountDiscretizationPanel(container) {
  ensureStyles();

  const root = document.createElement('div');
  root.className = 'disc-root';

  const heading = document.createElement('div');
  heading.className = 'disc-heading';
  heading.textContent = 'Discretization';
  root.appendChild(heading);

  const inputs = {
    drawRadius: makeSlider(root, 'drawRadius', 'Draw radius', { min: 2, max: 100, step: 1 }),
    radiusIterations: makeSlider(root, 'radiusIterations', 'Radius shells', { min: 1, max: 60, step: 1 }),
    thetaIterations: makeSlider(root, 'thetaIterations', 'Theta samples', { min: 4, max: 96, step: 1 }),
    phiIterations: makeSlider(root, 'phiIterations', 'Phi samples', { min: 4, max: 96, step: 1 }),
    magnitudeModSkewAll: makeSlider(root, 'magnitudeModSkewAll', 'Density skew', { min: 0, max: 4, step: 0.1 }),
    iconCount: makeSlider(root, 'iconCount', 'Render count cap', { min: 64, max: 20000, step: 64 }),
    magnitudeModForceField: makeSlider(root, 'magnitudeModForceField', 'Force field mag.', { min: 0, max: 3, step: 0.1 }),
    magnitudeModPotential: makeSlider(root, 'magnitudeModPotential', 'Potential mag.', { min: 0, max: 3, step: 0.1 }),
    magnitudeModEquipotentialLines: makeSlider(root, 'magnitudeModEquipotentialLines', 'Equipot. lines mag.', { min: 0, max: 1, step: 0.05 }),
  };

  displaySettings.onChange((s) => {
    for (const key of Object.keys(inputs)) {
      inputs[key].value = String(s[key]);
    }
  });

  container.appendChild(root);
  return root;
}
