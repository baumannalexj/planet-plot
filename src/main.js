// Composition root: wires header controls, the animation loop, and mounts the
// two panels. Panel modules are self-contained and only touch their own DOM
// node + the shared store.

import { store, SPEED_FACTORS, ENERGY_DRIFT_WARN_RATIO, ENERGY_DRIFT_CAUTION_RATIO } from './app/store.js';
import { PRESETS } from './core/presets.js';
import { simTimeToDays, simTimeToYears } from './core/constants.js';
import { mountViewport } from './viewport/viewport.js';
import { mountObjectPanel } from './viewport/objectPanel.js';
import { mountPlotPanel } from './plots/plotPanel.js';
import { loggerProvider } from './provider/LoggerProvider.js';
import { forceLawProvider } from './provider/ForceLawProvider.js';

// --- Logger wiring (composition root decides implementation + level) -------
// Console visibility during dev + CSV tick-data capture, both at once — flip
// provideConsoleLogger for provideLoglevelLogger to swap the console backend
// for the `loglevel` library (e.g. for its persistent-level/remote-transport
// ecosystem) without touching any call site; the Logger interface is
// identical either way. ConsoleLogger's level is set to 'info' so per-tick
// debug() calls don't spam the browser console — CsvFileLogger has no level
// filter of its own, so it still captures every tick to disk regardless
// (see WORK_ITEMS.md: "we should keep that every time").
const CONSOLE_LOG_LEVEL = 'info';
store.sim.logger = loggerProvider.provideMultiLogger([
  loggerProvider.provideConsoleLogger(CONSOLE_LOG_LEVEL),
  loggerProvider.provideCsvFileLogger(),
]);
// loggerProvider.provideLoglevelLogger(level) is available; swap in for
// provideConsoleLogger above when wanted.

// Composition root decides the force law, same as the logger above —
// Simulation.js only falls back to its own NewtonianForceLaw default when
// nothing is supplied.
store.sim.forceLaw = forceLawProvider.provideNewtonianForceLaw();

const SUPERSCRIPT_DIGITS = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }; // FIXME move this to config, and the SuperScriptDigits can be a type/class
function toSuperscript(n) {
  return String(n).split('').map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch).join('');
}

/**
 * Render a speed factor as a compact label.
 *
 * Plain fractions/multipliers ("1/2x", "1/100x", "16x") stay readable for
 * everyday factors. Once the magnitude gets extreme — denominator > 100 for
 * slow factors, or the factor itself ≥ 1000 for fast ones — switch to
 * power-of-ten notation ("1/10³x", "10⁴x") so the label doesn't balloon.
 * The current SPEED_FACTORS set tops out at 16x / bottoms out at 1/100x, so
 * this branch is future-proofing for a wider range, not exercised today.
 */
function formatSpeedLabel(factor) {
  if (factor >= 1) {
    if (factor >= 1000) {
      const exp = Math.log10(factor);
      if (Number.isInteger(exp)) return `10${toSuperscript(exp)}x`;
    }
    return `${factor}x`;
  }
  const denom = Math.round(1 / factor);
  if (denom > 100) {
    const exp = Math.log10(denom);
    if (Number.isInteger(exp)) return `1/10${toSuperscript(exp)}x`;
  }
  return `1/${denom}x`;
}

// --- Header controls ---------------------------------------------------------

const presetSelect = document.getElementById('preset-select');
for (const [id, preset] of Object.entries(PRESETS)) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = preset.label;
  presetSelect.appendChild(opt);
}
presetSelect.value = store.presetId;
presetSelect.addEventListener('change', (e) => store.setPreset(e.target.value));

const originSelect = document.getElementById('origin-select');
function rebuildOriginOptions() {
  originSelect.innerHTML = '';
  const com = document.createElement('option');
  com.value = 'com';
  com.textContent = 'Center of mass';
  originSelect.appendChild(com);
  store.sim.bodies.forEach((b, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = b.name;
    originSelect.appendChild(opt);
  });
  originSelect.value = store.origin === 'com' ? 'com' : String(store.origin);
}
rebuildOriginOptions();
originSelect.addEventListener('change', (e) => {
  const v = e.target.value;
  store.setOrigin(v === 'com' ? 'com' : Number(v));
});
store.onPresetChange(rebuildOriginOptions);

// The slider indexes SPEED_FACTORS (a discrete set spanning 1/100x..16x)
// rather than encoding the factor directly — a linear range can't express
// that spread of magnitudes usefully.
const speedRange = document.getElementById('speed-range');
const speedValue = document.getElementById('speed-value');
speedRange.min = '0';
speedRange.max = String(SPEED_FACTORS.length - 1);
speedRange.step = '1';
speedRange.value = String(SPEED_FACTORS.indexOf(store.speedFactor));
speedValue.textContent = formatSpeedLabel(store.speedFactor);
speedRange.addEventListener('input', (e) => {
  const factor = SPEED_FACTORS[Number(e.target.value)];
  store.setSpeed(factor);
  speedValue.textContent = formatSpeedLabel(store.speedFactor);
});

const simTimeEl = document.getElementById('sim-time');
const YEAR_DISPLAY_THRESHOLD_DAYS = 365;
function renderSimTime(simTime) {
  const days = simTimeToDays(simTime);
  if (days > YEAR_DISPLAY_THRESHOLD_DAYS) {
    const years = simTimeToYears(simTime);
    simTimeEl.textContent = `t = ${years.toFixed(2)} yr (${days.toFixed(0)} days)`;
  } else {
    simTimeEl.textContent = `t = ${days.toFixed(1)} days`;
  }
}
renderSimTime(store.sim.time);
store.onFrame((snapshot) => renderSimTime(snapshot.time));

// --- Live energy readout -----------------------------------------------------
// Always-on gauge over the same totalEnergy()/baseline the drift monitor
// watches (store.js) — this widget just displays what's already computed
// there on its throttled cadence; it doesn't recompute anything itself.
const energyRatioEl = document.getElementById('energy-ratio');

/** Compact numeric display: ~3 significant figures, exponential if extreme. */
function formatEnergyValue(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toPrecision(3);
}

function renderEnergyRatio({ current, baseline, ratio }) {
  const pct = Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : '—';
  energyRatioEl.textContent = `E: ${formatEnergyValue(current)} / ${formatEnergyValue(baseline)} = ${pct}`;

  // Subtle color cue, consistent with the drift notification's levels:
  // near 100% stays muted/normal, drifting past the caution ratio tints
  // amber, and past the same ratio that triggers the warning notification
  // tints red (error).
  const relativeDrift = Number.isFinite(ratio) ? Math.abs(ratio - 1) : 0;
  energyRatioEl.classList.remove('energy-ratio--caution', 'energy-ratio--warning');
  if (relativeDrift > ENERGY_DRIFT_WARN_RATIO) {
    energyRatioEl.classList.add('energy-ratio--warning');
  } else if (relativeDrift > ENERGY_DRIFT_CAUTION_RATIO) {
    energyRatioEl.classList.add('energy-ratio--caution');
  }
}
renderEnergyRatio({ current: store.currentEnergy, baseline: store.energyBaseline, ratio: store.energyRatio });
store.onEnergyChange(renderEnergyRatio);

// --- Notifications -----------------------------------------------------------
// Generic list UI driven entirely by store.notifications; the energy-drift
// monitor (in store.js) is just one producer that calls addNotification().
const notificationsEl = document.getElementById('notifications');
function renderNotifications(notifications) {
  notificationsEl.innerHTML = '';
  for (const { id, level, message } of notifications) {
    const li = document.createElement('li');
    li.className = `notification notification--${level}`;

    const text = document.createElement('span');
    text.className = 'notification__message';
    text.textContent = message;
    li.appendChild(text);

    const dismiss = document.createElement('button');
    dismiss.className = 'notification__dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', () => store.dismissNotification(id));
    li.appendChild(dismiss);

    notificationsEl.appendChild(li);
  }
}
renderNotifications(store.notifications);
store.onNotificationsChange(renderNotifications);

const playPause = document.getElementById('play-pause');
const energyBreakBadge = document.getElementById('energy-break-badge');
// Sync on every notification change too, not just clicks — a programmatic
// pause (the energy-break check in store.js) flips store.sim.running without
// going through togglePlay(), and addNotification() fires synchronously
// right when that happens, so this reflects it immediately.
function syncPlayPauseUi() {
  playPause.textContent = store.sim.running ? 'Pause' : 'Play';
  energyBreakBadge.hidden = !store.pausedByEnergyBreak;
}
syncPlayPauseUi();
store.onNotificationsChange(syncPlayPauseUi);
playPause.addEventListener('click', () => {
  store.togglePlay();
  syncPlayPauseUi();
});
document.getElementById('reset').addEventListener('click', () => {
  store.reset();
  syncPlayPauseUi();
});

// --- Mount panels ------------------------------------------------------------

mountObjectPanel(document.getElementById('object-panel'), store);
mountViewport(document.getElementById('viewport'), store);
mountPlotPanel(document.getElementById('plot-panel'), store);

// --- Work items card ----------------------------------------------------------
// Static snapshot fetched from public/work-items.json, editable by hand without
// touching app code. No live-reload wiring — refresh the page after editing.
function renderWorkItemList(elId, items, emptyLabel) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  for (const text of items.length ? items : [emptyLabel]) {
    const li = document.createElement('li');
    li.textContent = text;
    el.appendChild(li);
  }
}
fetch('/work-items.json')
  .then((r) => r.json())
  .then(({ features = [], todos = [], bugs = [] }) => {
    renderWorkItemList('work-items-features', features, 'None yet');
    renderWorkItemList('work-items-todos', todos, 'None yet');
    renderWorkItemList('work-items-bugs', bugs, 'None known');
  });

// --- Animation loop ----------------------------------------------------------

function loop() {
  store.tick();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
