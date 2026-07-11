// Display controls bound to the shared displaySettings singleton
// (src/app/displaySettings.js): a first-class, always-visible NLIPS toggle
// pill, plus a "Display ▾" popover for the remaining (less load-bearing)
// options (mass-scaled size, axis names).
//
// Self-contained: injects its own scoped <style> and DOM, so it can be
// mounted directly from viewport.js/objectPanel.js without touching
// main.js or index.html.

import { displaySettings, NLIPS_DESCRIPTION } from '../app/displaySettings.js';

const STYLE_ID = 'display-controls-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .dc-root {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 10;
      font-size: 0.8rem;
      user-select: none;
      display: flex;
      gap: 8px;
    }
    .dc-toggle {
      background: var(--panel-2, #1a1f2c);
      color: var(--text, #e2e8f0);
      border: 1px solid var(--border, #2d3748);
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .dc-toggle:hover {
      background: var(--border, #2d3748);
    }
    .dc-pill {
      background: var(--panel-2, #1a1f2c);
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
    .dc-pill:hover {
      border-color: var(--accent, #63b3ed);
    }
    .dc-pill-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.5;
    }
    .dc-pill.on {
      background: var(--accent, #63b3ed);
      color: #0b1220;
      border-color: var(--accent, #63b3ed);
    }
    .dc-pill.on .dc-pill-dot {
      opacity: 1;
    }
    .dc-anchor {
      position: relative;
    }
    .dc-panel {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      background: var(--panel-2, #1a1f2c);
      border: 1px solid var(--border, #2d3748);
      border-radius: 8px;
      padding: 10px 12px;
      min-width: 180px;
      display: none;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    .dc-panel.open {
      display: flex;
    }
    .dc-row {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text, #e2e8f0);
      cursor: pointer;
    }
    .dc-row input {
      accent-color: var(--accent, #63b3ed);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Mount a "Display ▾" button + popover with checkboxes for the shared
 * displaySettings (nlips, massSize, axisNames).
 * @param {HTMLElement} container  Should be positioned (relative/absolute)
 *   so the overlay anchors to its top-left corner.
 */
export function mountDisplayControls(container) {
  ensureStyles();

  const root = document.createElement('div');
  root.className = 'dc-root';

  // --- NLIPS: first-class, always-visible on/off pill (not buried in the
  // Display popover) — reflects displaySettings.nlips state directly. ---
  const nlipsPill = document.createElement('button');
  nlipsPill.type = 'button';
  nlipsPill.className = 'dc-pill';
  nlipsPill.title = NLIPS_DESCRIPTION;
  const nlipsDot = document.createElement('span');
  nlipsDot.className = 'dc-pill-dot';
  nlipsPill.appendChild(nlipsDot);
  nlipsPill.append('NLIPS');

  function syncNlipsPill(on) {
    nlipsPill.classList.toggle('on', on);
  }
  syncNlipsPill(displaySettings.nlips);

  nlipsPill.addEventListener('click', () => {
    const on = displaySettings.toggle('nlips');
    syncNlipsPill(on);
  });

  // --- "Display ▾" popover for the remaining, secondary options. ---
  const anchor = document.createElement('div');
  anchor.className = 'dc-anchor';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'dc-toggle';
  toggleBtn.textContent = 'Display ▾';

  const panel = document.createElement('div');
  panel.className = 'dc-panel';

  function makeRow(key, label, title) {
    const row = document.createElement('label');
    row.className = 'dc-row';
    if (title) row.title = title;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = displaySettings[key];
    checkbox.addEventListener('change', () => {
      displaySettings.set(key, checkbox.checked);
    });
    row.appendChild(checkbox);
    row.append(label);
    panel.appendChild(row);
    return checkbox;
  }

  const massSizeCheckbox = makeRow('massSize', 'Mass-scaled size');
  const axisNamesCheckbox = makeRow('axisNames', 'Axis names');

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
  });

  // Close the popover when clicking anywhere outside it.
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) panel.classList.remove('open');
  });

  // Keep controls in sync if a setting changes from elsewhere (e.g. the
  // plots panel exposing its own control on the same shared singleton).
  displaySettings.onChange((s) => {
    syncNlipsPill(s.nlips);
    massSizeCheckbox.checked = s.massSize;
    axisNamesCheckbox.checked = s.axisNames;
  });

  anchor.appendChild(toggleBtn);
  anchor.appendChild(panel);

  root.appendChild(nlipsPill);
  root.appendChild(anchor);
  container.appendChild(root);
  return root;
}
