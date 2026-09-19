# Work Queue Archive

Completed task-wi entries, swept out of `WORK_QUEUE.md` per `WORK_ITEMS_RULES.md`.
Numbering follows the original ad-hoc "Task N" scheme used before this repo adopted
the `WORK_ITEMS_RULES.md` protocol — kept as-is rather than renumbered, including one
known collision (two unrelated tasks both originally called "Task 15" — kept distinct
below by content, not renumbered, to avoid rewriting history).

---

## Task 1: WI-5 — Equations reference list [done: team-lead]

**Goal:** a static, read-only "Equations" section in the object panel, listing named
physics equations as plain text — NOT computed, NOT live-substituted with sim values.

**Pattern to copy exactly:** the "Constants" section already in
`src/viewport/objectPanel.js` (search for `op-constants` / `constantsSection` — added for
WI-3). Same structure: a `<h2 class="op-heading">` heading + rows, appended to `el` after
the constants section. Reuse the existing `.op-constant-row` CSS class for each row (or add
a near-identical `.op-equation-row` if a two-line row is needed for name + formula) rather
than inventing a new visual style.

**Content — a fixed static array, e.g. `EQUATIONS = [{ name, formula }]`:**
- Kepler's First Law — orbit is an ellipse, r = a(1-e²)/(1+e·cos ν)
- Kepler's Second Law (areal velocity) — dA/dt = ½r²·φ̇ (constant)
- Kepler's Third Law — T² ∝ a³ (for two-body; note this sim is N-body so it's
  approximate except for the two-body presets)
- Vis-viva equation — v² = GM(2/r - 1/a)
- Newtonian gravitational force — F = G·m₁·m₂/r²
- Kinetic energy — K = ½mv²
- Gravitational potential energy (two-body) — U = -G·m₁·m₂/r
- Hamiltonian (N-body) — H = T + U = Σᵢ pᵢ²/(2mᵢ) - GΣᵢ<ⱼ mᵢmⱼ/rᵢⱼ
- Lagrangian (N-body) — L = T - U

Double-check each formula against a reputable source before shipping — don't invent or
guess a formula's exact form.

**Where to add it:** right after the existing Constants section build, in the same
`mountObjectPanel` function, same file. No new files needed.

**Acceptance check:** run `yarn dev`, open the app, confirm the object panel now shows
Bodies → Constants → Equations stacked, panel still scrolls (`overflow-y: auto` already on
`#object-panel` in `src/styles.css`), no console errors.

**Do NOT:** touch any other file, add a build step, or add a dependency for formula
rendering (no KaTeX/MathJax) — plain unicode text (², ½, φ, etc., matching how the rest of
the codebase writes these, e.g. `src/plots/metrics.js`'s labels) is the existing style.

---

## Task 2: WI-7c — Gravitational potential field overlay [done: team-lead]

**Goal:** a toggle-able scalar-field overlay showing gravitational potential U(x,y) on a
plane at adjustable z-offset, rendered in the 3D viewport. Same calculator/adapter/toggle
split as the two existing overlays — read both fully before starting:
`src/core/overlays/forceField.js` + `src/viewport/forceFieldOverlay.js` (mirror their
structure closely; this is the template, don't invent a different shape).

**1. Calculator — new file `src/core/overlays/potentialField.js`:**
```js
export function computePotentialField(bodies, { extent = 20, resolution = 20, z = 0 } = {})
```
Same imports as `forceField.js`: `G` from `../Simulation.js`, `SOFTENING` from
`../constants.js`. Mirror `computeForceField`'s grid loop exactly, but sample at
`[x, y, z]` (z from the new param, default 0, not always 0) and compute a scalar instead
of a vector:
```js
function potentialAt(position, bodies) {
  let u = 0;
  for (const b of bodies) {
    const [dx, dy, dz] = sub(b.position, position);
    const r2 = dx*dx + dy*dy + dz*dz + SOFTENING*SOFTENING;
    u += -G * b.mass / Math.sqrt(r2);
  }
  return u;
}
```
Returns `{ position: number[], value: number }[]`. Use default `resolution = 20` (finer
than force field's 10 — a scalar mesh needs to look smooth, and it's cheaper per-point
since there's no direction/normalize math).

**2. Adapter — new file `src/viewport/potentialFieldOverlay.js`:**
- `THREE.PlaneGeometry(extent*2, extent*2, resolution-1, resolution-1)` — vertex grid
  matches the sample grid exactly (same `extent`/`resolution` as the calculator call).
- `PlaneGeometry` is built in the XY plane — displace each vertex's local **Z** by
  `normalizedValue * displayScale` (do this BEFORE the plane's own -90°-on-X rotation that
  lays it flat like the viewport's `GridHelper`; see `viewport.js`'s `toThree()` for the
  sim→three coordinate convention).
- Vertex colors: `PlaneGeometry` has no color attribute by default — build one manually
  (`geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))`), gradient from
  attractive (more negative U) to near-zero.
- Material: `new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide,
  transparent: true, opacity: 0.7 })` — **unlit**, matching this repo's convention
  (`plot3d.js`/`viewport.js` overlays never use `MeshStandardMaterial` except the actual
  body spheres). Because it's unlit: **do NOT call `geometry.computeVertexNormals()`** —
  skip normals/lighting entirely, it's dead code for this material.
- Normalize displacement with a **grow-only max-magnitude ratchet**, exactly like
  `forceFieldOverlay.js`'s `maxMagnitudeSeen` pattern — raw U spans a huge range near close
  encounters and will blow out the displacement scale without it.
- Toggle-gate compute AND render, same `if (!displaySettings.showPotentialField) return;`
  pattern as the other two overlays' `update()`.

**3. `src/app/displaySettings.js` — add three fields** alongside `showForceField`/
`forceFieldScale`:
- `showPotentialField` (boolean, default `false`)
- `potentialFieldZ` (number, default `0`) — z-plane offset
- `potentialFieldScale` (number, default `1`) — vertical-displacement magnitude multiplier

**4. `src/viewport/displayControls.js` — wire two new rows**, following the exact
`showForceField`/`forceFieldScale` checkbox+slider block already in that file (search for
`forceFieldCheckbox`/`scaleInput`): a checkbox for `showPotentialField`, and TWO range
sliders (one for `potentialFieldZ`, one for `potentialFieldScale`) — same DOM/event pattern,
new variable names, added to the `displaySettings.onChange` sync block at the bottom too.

**5. `src/viewport/viewport.js` — wire it in** exactly like `forceFieldOverlay`: import
`createPotentialFieldOverlay`, instantiate it once alongside `lagrangeOverlay`/
`forceFieldOverlay`, call `.update(relBodies)` in the render loop.

**Acceptance check:** `yarn dev`, toggle "Potential field" on, confirm a plane appears
dipping toward each body, z-slider moves the plane, scale slider changes dip magnitude, no
console errors, toggling off removes it with zero per-frame cost (check the `update()`
early-return).

**Do NOT:** add a contour-line library, GLSL shader, or any new dependency — plain
displaced+vertex-colored `PlaneGeometry` only, per the research above.

---

## Task 3: Convert overlay calculators/adapters to classes implementing @api interfaces [done: team-lead]

**Goal:** `@api` must hold ONLY interface classes (already done — see
`src/api/FieldCalculator.js`, `src/api/OverlayRenderer.js`,
`src/api/PlotCorrectionStrategy.js`, each just a method stub that throws). Every existing
calculator/adapter is currently a plain function or object, not a class implementing one of
these. Convert them, one at a time, keeping behavior byte-for-byte identical — this is a
translation task, not a redesign.

**Path aliases now exist** (`vite.config.js`): `@api`, `@core`, `@adapters`, `@viewport`,
`@app`, `@plots`. Use these in every import you touch instead of relative paths (`../../`).

**3a. Calculators → classes in `src/core/overlays/`, extending `FieldCalculator`:**
- `src/api/overlays/lagrangePoints.js`'s `computeLagrangePoints(bodies)` function →
  `src/core/overlays/LagrangePointsCalculator.js`, `class LagrangePointsCalculator extends FieldCalculator { compute(bodies) { /* same body */ } }`.
- `src/api/overlays/forceField.js`'s `computeForceField(bodies, opts)` →
  `src/core/overlays/ForceFieldCalculator.js`, `class ForceFieldCalculator extends FieldCalculator { compute(bodies, opts) { /* same body */ } }`.
- `src/api/overlays/potentialField.js`'s `computePotentialField(bodies, opts)` →
  `src/core/overlays/PotentialFieldCalculator.js`, same pattern.
- Keep all internal helper functions (`sub`, `accelerationAt`, `potentialAt`, `rotateAboutAxis`, etc.) as private module-level functions in the new file, unchanged.
- Delete the old `src/api/overlays/*.js` files once moved — `src/api/` should end up
  containing ONLY the 3 interface class files, nothing else.
- Import `FieldCalculator` via `@api/FieldCalculator.js`. Import `G`/`SOFTENING` via
  `@core/Simulation.js` / `@core/constants.js`.

**3b. Overlay adapters → classes in `src/adapters/overlays/`, extending `OverlayRenderer`:**
- `lagrangePointsOverlay.js`'s `createLagrangePointsOverlay(scene, toThree)` factory
  (returns `{update, dispose}`) → `class LagrangePointsOverlay extends OverlayRenderer`,
  constructor takes `(scene, toThree)`, `update(relBodies)` and `dispose()` become instance
  methods with the exact same bodies. Instantiate the calculator inside the constructor:
  `this.calculator = new LagrangePointsCalculator()`, call `this.calculator.compute(relBodies)` where the old code called `computeLagrangePoints(relBodies)`.
- Same pattern for `forceFieldOverlay.js` → `ForceFieldOverlay extends OverlayRenderer`
  (constructs a `ForceFieldCalculator`), and `potentialFieldOverlay.js` →
  `PotentialFieldOverlay extends OverlayRenderer` (constructs a `PotentialFieldCalculator`).
- Update `src/viewport/viewport.js`: `createXOverlay(scene, toThree)` call sites become
  `new XOverlay(scene, toThree)`; `.update(...)`/`.dispose()` calls are unchanged (already
  instance-method-shaped). Update its imports to `@adapters/overlays/...` (already aliased)
  and class names instead of factory function names.

**3c. Plot corrections → classes in `src/adapters/plotCorrections/`, extending `PlotCorrectionStrategy`:**
- `circularEmbedding.js`'s `circularEmbeddingCorrection` plain object → `class CircularEmbeddingCorrection extends PlotCorrectionStrategy`, each object method becomes an instance method with the same body (note: object methods used `plan`/`buf`/etc. as destructured params already — keep that exact parameter shape).
- `noop.js`'s `noopPlotCorrection` → `class NoopPlotCorrection extends PlotCorrectionStrategy`, same treatment.
- `index.js`: `export const ACTIVE_CORRECTION = new NoopPlotCorrection();` (instantiate, don't
  export the plain object anymore). Keep exporting both classes too (not just instances) —
  `export { CircularEmbeddingCorrection, NoopPlotCorrection }`.
- `src/plots/plotPanel.js`: `this.correction = ACTIVE_CORRECTION` stays as-is (still an
  instance now, not a plain object — calling `.computePlan()`/`.buildPoint()`/`.isBreak()`
  on it works identically). Update its import to `@adapters/plotCorrections/index.js`
  (already aliased — just confirm it's using the alias, not a relative path).

**3d. Also fix while you're in `potentialFieldOverlay`/`PotentialFieldOverlay`:** it has the
SAME max-magnitude-ratchet bug that was just fixed in `forceFieldOverlay.js` — resolution
changes resample different grid coordinates, and a sample landing close to a body can
permanently poison `maxMagnitudeSeen`, collapsing the whole field toward invisible. Port the
identical fix: add a `RATCHET_EXCLUSION_RADIUS` (reuse the same value, `1.0`) that skips
near-body samples when growing the ratchet, and a `MAX_NORMALIZED_MAGNITUDE` cap (reuse `2`)
on the displayed value. Look at `forceFieldOverlay.js`'s current `nearestBodyDistance` helper
and copy the same approach (adjust for `p.value` instead of `p.magnitude` — potential field's
value is already signed/negative, so cap the magnitude before reapplying the sign).

**Acceptance check:** `yarn test` still passes (10/10 — the extracted `breakDetection.js`
pure functions are untouched by this task, don't move those). `yarn dev`, toggle each of the
3 overlays on, confirm no console errors and all three still render/update. Confirm
`src/api/` contains exactly 3 files (the interface classes) and nothing else.

**Do NOT:** change any math/behavior — every `compute()`/`update()`/`buildPoint()` body
should be a verbatim copy of the existing function/method body, just relocated into a class.
This is a mechanical move, not a rewrite.

---

## Task 4: Velocity-component metrics [done: team-lead]

**Goal:** add net-new plottable/derivable metrics for velocity components, so `metrics.js`
covers "v<coordinate>" per your WORK_ITEMS.md ask — cartesian vx/vy/vz, and a cylindrical
radial-velocity component (spherical ṟ/θ̇/φ̇ already exist — `rdot`/`thetadot`/`phidot` in
`DERIVED_METRICS`, do not duplicate those).

**File:** `src/plots/metrics.js` only.

**Add these pure functions** (same style as the existing `radialVelocity`/`polarRate`/
`azimuthalRate` — read a `body.position`/`body.velocity`, return a scalar):
```js
function vx(body) { return body.velocity[0]; }
function vy(body) { return body.velocity[1]; }
function vz(body) { return body.velocity[2]; }

// Cylindrical radial velocity: d(rho)/dt where rho = hypot(x,y).
function cylindricalRhoDot(body) {
  const [x, y] = body.position;
  const [vx_, vy_] = body.velocity;
  const rho = Math.hypot(x, y) + EPSILON;
  return (x * vx_ + y * vy_) / rho;
}

// Kepler's second law: dA/dt = r²·φ̇/2, in the orbital (xy) plane.
function arealVelocity(body) {
  const [x, y] = body.position;
  const rho2 = x * x + y * y;
  return 0.5 * rho2 * azimuthalRate(body);
}
```
Register all four in `DERIVED_METRICS` (same array, same `{id, label, compute}` shape as the
existing entries):
```js
{ id: 'vx', label: 'vx', compute: (body) => vx(body) },
{ id: 'vy', label: 'vy', compute: (body) => vy(body) },
{ id: 'vz', label: 'vz', compute: (body) => vz(body) },
{ id: 'rhodot', label: 'ρ̇ (cylindrical radial velocity)', compute: (body) => cylindricalRhoDot(body) },
{ id: 'dAdt', label: 'dA/dt (areal velocity)', compute: (body, snapshot) => arealVelocity(body) },
```
**Add matching entries to `METRIC_UNITS`** (same object, same style as the existing ones):
`vx: 'AU/tu', vy: 'AU/tu', vz: 'AU/tu', rhodot: 'AU/tu', dAdt: 'AU²/tu'`.

**Do NOT** touch `plotPanel.js`, `objectPanel.js`, or any other file — adding to
`DERIVED_METRICS` automatically makes these selectable in the plot panel's X/Y/Z dropdowns
(via `getMetricOptions`) with zero other changes needed. Verify this by checking
`getMetricOptions`'s existing code path, not by editing it.

**Acceptance check:** `yarn test` still passes (10/10 — unrelated to this file, just confirms
nothing else broke). `yarn dev`, open a plot card, confirm "vx", "vy", "vz", "ρ̇ (cylindrical
radial velocity)", and "dA/dt (areal velocity)" all appear in the X/Y/Z metric dropdowns.

---

## Task 5: Editable body position (x, y, z) in the object panel [done: team-lead]

**Goal:** "add ability to change the x,y,z of bodies" — mirror the EXISTING mass/speed
editable-input pattern in the object panel exactly; don't invent a different UI style.

**File:** `src/viewport/objectPanel.js` only.

Read the whole file first — especially `buildCards()`'s existing `massField`/`massInput` and
`speedField`/`speedInput` blocks (search for `op-field`), and their `change` event listeners
that write straight through to the live `Body` instance (`b.mass = ...`, `b.velocity = ...`).
Copy that exact pattern for position:

- Add 3 more `op-field` labeled inputs (`x=`, `y=`, `z=`) right after the existing mass/speed
  fields, same `.op-field`/`input[type=number]` styling, same `step="any"` (no min needed —
  position can be negative, unlike mass).
- On `change`, write directly to the live body: `b.position[0] = parseFloat(xInput.value) || 0`
  (and same for y/z, index 1/2). No clamping needed (unlike mass's `MIN_MASS`).
- Initialize each input's `.value` from `b.position[i]` when the card is built, same as
  `massInput.value = b.mass`.
- Extend the existing per-body reset button (`resetBtn`) to also restore original position:
  capture `origPosition = [...b.position]` alongside the existing `origMass`/`origVelocity`
  capture, and reset it in the same `resetBtn` click handler.
- The per-frame `store.onFrame(...)` sync block already skips the speed input while the user
  is actively editing it (`document.activeElement === entry.speedInput`) — do the exact same
  "don't clobber while focused" check for each of the 3 new position inputs (position changes
  every frame as the sim runs, same reason speed does).

**Do NOT** change the mass/speed fields' existing behavior, styling class names, or the
`CALC_METRICS` "Calc" readout grid below them — this task only adds 3 new inputs.

**Acceptance check:** `yarn dev`, confirm each body card shows m=/|v|=/x=/y=/z= inputs, editing
x/y/z immediately moves the body in the 3D viewport (since `Body.position` is the same array
the sim/viewport read live), and the reset button restores position too.

---

## Task 6: New preset — inclined elliptical two-body orbit [done: team-lead]

**Goal:** "add a pre config that is (semi) stable eliptical orbit of 2 bodies, but then
elevate the z plane of smaller body higher up" — a starting point per the user's explicit
"start on it and I'll find a precise example"; this does not need to be physically perfect,
just a real preset that runs without immediately blowing up.

**File:** `src/core/presets.js` only.

Read the existing `'two-body'` preset in full first (same file) — copy its structure exactly
(same `{ label, build() {...} }` shape, same `Body` constructor calls, same jitter helper
usage). Add a new preset keyed `'two-body-inclined'`:

```js
'two-body-inclined': {
  label: 'Two body (inclined elliptical)',
  build() {
    // Unequal masses (so "smaller body" is meaningful) on an eccentric ellipse —
    // start off-circular-speed so the orbit isn't a perfect circle, and give the
    // smaller body some z-position/z-velocity so its orbital plane is inclined
    // relative to the primary's, instead of both sitting flat in z=0.
    const primaryMass = 20;
    const secondaryMass = 4;
    const dist = 5;
    const inclinationDeg = 20; // tilt of the secondary's orbital plane
    const inclinationRad = (inclinationDeg * Math.PI) / 180;

    // Circular speed at this distance would be sqrt(G*M/r); starting SLOWER than
    // that (0.8x) makes the orbit eccentric (elliptical) instead of circular.
    const circularSpeed = Math.sqrt(primaryMass / dist);
    const orbitalSpeed = circularSpeed * 0.8;

    return [
      new Body({ name: 'Primary', mass: primaryMass, color: '#f6e05e', position: [0, 0, 0], velocity: [0, 0, 0] }),
      new Body({
        name: 'Secondary',
        mass: secondaryMass,
        color: '#68d391',
        position: [dist * Math.cos(inclinationRad), 0, dist * Math.sin(inclinationRad)],
        velocity: [0, orbitalSpeed, 0],
      }),
    ];
  },
},
```
Add it to the `PRESETS` object (alphabetical or grouped with `'two-body'` — match whatever
ordering convention the file already uses, don't reorder existing entries).

**Do NOT** touch `DEFAULT_PRESET` or any other preset — this is purely additive.

**Acceptance check:** `yarn dev`, select "Two body (inclined elliptical)" from the
Configuration dropdown, confirm it loads without an immediate energy-break pause (check the
header's energy readout / the "⏸ Paused — energy check" badge stays hidden) and the secondary
body visibly orbits above/below the primary's z=0 plane in the 3D viewport, not flat.

---

## Task 7: Equipotential contour lines [done: team-lead]

**Goal:** "for grav potential, add checkbox and slider for equipotential lines (slider is
number of lines)" — classic topographic-map-style contour lines over the existing potential
field, via marching squares on the same grid `PotentialFieldCalculator` already samples.

**1. Contour extraction.** `PotentialFieldCalculator.compute()` builds its flat `points`
array with the outer loop over `i` (x) and inner loop over `j` (y) — see the file — so a
grid point at `(i, j)` lives at `points[i * resolution + j]`. For each cell `(i, j)` with
`i, j` in `[0, resolution-2]`, the 4 corners are:
```js
const p00 = points[i * resolution + j];
const p10 = points[(i + 1) * resolution + j];
const p01 = points[i * resolution + (j + 1)];
const p11 = points[(i + 1) * resolution + (j + 1)];
```
Marching squares per level `L`, per cell — walk the 4 edges (`00-10`, `10-11`, `11-01`,
`01-00`); for each edge, if `sign(a.value - L) !== sign(b.value - L)`, linearly interpolate
the crossing point: `t = (L - a.value) / (b.value - a.value)`, `crossing = lerp(a.position,
b.position, t)`. If exactly 2 edges cross, emit one segment connecting the two crossing
points. Skip cells with 0 crossings. For the rare 4-crossing saddle case, just pair edges in
a fixed winding order (00-10 with 10-11, 11-01 with 01-00) — don't special-case further, it's
a visual artifact only.

**2. Level spacing.** Use raw `U` (always ≤ 0), not `|U|` — matches the existing
attractive/negative color convention in `potentialFieldOverlay.js`. In the ADAPTER (not the
calculator — same split as `maxMagnitudeSeen` today), track a grow-only ratchet
`minValueSeen` (most negative U observed, excluding points within `RATCHET_EXCLUSION_RADIUS`
of a body — reuse that same exclusion logic/constant already in `potentialFieldOverlay.js`),
starting at `-1e-9`, only updating when a new value is more negative. Compute `N` levels
strictly between `minValueSeen` and `0` (never exactly at either endpoint):
```js
const level = minValueSeen * (k + 1) / (N + 1); // k = 0..N-1
```

**3. Rendering.** One `THREE.LineSegments` per contour level, each with its own
`THREE.BufferGeometry` (position attribute only) and `THREE.LineBasicMaterial` with a color
interpolated between the SAME `ZERO_COLOR`/`ATTRACTIVE_COLOR` already defined in
`potentialFieldOverlay.js` (by `k/(N-1)`), for visual consistency with the field it's
contouring. All N line meshes live under one `THREE.Group`, positioned/rotated exactly like
`potentialFieldOverlay.js`'s mesh (`-Math.PI/2` on X, `mesh.position.y = potentialFieldZ`) —
but rendered FLAT (no per-vertex displacement) so contours read as a clean 2D overlay, not
warped onto the 3D bowl. Each frame: recompute segments; if a level's segment count changed,
rebuild its `Float32Array`/`BufferAttribute` (same resize-then-`needsUpdate` pattern as
`potentialFieldOverlay.js`'s `buildMesh()`); write `[x1,y1,z1,x2,y2,z2,...]` into the
position array; set `needsUpdate = true`.

**4. File/class layout** — matches the existing calculator/adapter split exactly:
- **`src/core/overlays/EquipotentialLinesCalculator.js`**, `class EquipotentialLinesCalculator extends FieldCalculator` (`@api/FieldCalculator.js`). `compute(bodies, {extent, resolution, z, levels})`: internally construct a `PotentialFieldCalculator` and call `.compute()` for the grid, then run the marching-squares pass from point 1 for each value in the `levels` array (passed in by the adapter, computed per point 2). Returns `{level: number, segments: number[][]}[]`, each segment `[x1,y1,z1,x2,y2,z2]`.
- **`src/adapters/overlays/equipotentialLinesOverlay.js`**, `class EquipotentialLinesOverlay extends OverlayRenderer` (`@api/OverlayRenderer.js`). Constructor `(scene, toThree)`: build `this.calculator = new EquipotentialLinesCalculator()`, `this.group`, track `this.minValueSeen` ratchet and per-level segment counts for rebuild-on-change. `update(relBodies)` mirrors `PotentialFieldOverlay.update()`: guard on `displaySettings.showEquipotentialLines`, update the ratchet, compute `N` levels, call the calculator, rebuild/refill each level's line geometry. `dispose()` disposes all N geometries/materials + removes the group.
- **`src/app/displaySettings.js`**: add `this.showEquipotentialLines = false;` and `this.equipotentialLineCount = 5;`, same comment style as the `showPotentialField`/`potentialFieldResolution` fields directly above them.
- **`src/viewport/displayControls.js`**: add a checkbox via the existing `makeRow('showEquipotentialLines', 'Equipotential lines', '<a one-line title>')` right after the `potentialFieldCheckbox` block, and a slider row cloned from the `potentialResolutionRow` pattern, bound to `equipotentialLineCount` (range `min=2 max=20 step=1`). Add both to the existing `displaySettings.onChange((s) => {...})` sync block.
- **`src/viewport/viewport.js`**: import + instantiate `EquipotentialLinesOverlay` alongside the other 3 overlays, call `.update(relBodies)` in the render loop — exact same wiring as `lagrangeOverlay`/`forceFieldOverlay`/`potentialFieldOverlay`.

**Acceptance check:** `yarn test` still passes (10/10 — unrelated files). `yarn dev`, toggle
"Equipotential lines" on, confirm concentric-ish rings appear around each body (deeper wells
= more rings nested tighter near a heavier body), dragging the line-count slider changes how
many rings render, no console errors, toggling off removes it with zero per-frame cost.

**Do NOT** add a contour-line library or GLSL shader — plain marching squares in JS + native
three.js `LineSegments`, per the plan above, no new dependency.

---

## Seam: Field lines — Task 8 (calculator) and Task 9 (renderer) [done: team-lead]

Fixed interface contract both tasks must match exactly, so they can be built independently
without either worker waiting on the other:
```
FieldLinesCalculator.compute(bodies, opts) -> { seedIndex: number, points: number[][] }[]
```
`points` is an ORDERED array of `[x, y, z]` positions tracing one streamline, starting at the
seed and stepping along the local force direction, in the SAME frame as `bodies` (i.e.
whatever frame the caller's `relBodies` already is — the calculator doesn't know/care about
origins, same as every other calculator in this codebase). `seedIndex` is just the index into
whatever seed list the calculator generated, so the renderer can vary color/style per line if
it wants (optional — not required for a first pass).

### Task 8: FieldLinesCalculator [assigned: haiku worker]

**File:** new `src/core/overlays/FieldLinesCalculator.js`, `class FieldLinesCalculator extends
FieldCalculator` (`@api/FieldCalculator.js`).

**Seeding** — Fibonacci-sphere points around EACH body (gives even coverage, no pole
clustering, deterministic):
```js
const SEEDS_PER_BODY = 12;
const SEED_RADIUS = 1.5;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function fibonacciSpherePoint(k, n) {
  const yFrac = 1 - (k / (n - 1)) * 2; // -1..1
  const radiusAtY = Math.sqrt(Math.max(0, 1 - yFrac * yFrac));
  const theta = GOLDEN_ANGLE * k;
  return [Math.cos(theta) * radiusAtY, yFrac, Math.sin(theta) * radiusAtY];
}
```
For each body, for `k = 0..SEEDS_PER_BODY-1`: `seed = add(body.position, scale(fibonacciSpherePoint(k, SEEDS_PER_BODY), SEED_RADIUS))`.

**Force direction** — same force law as `ForceFieldCalculator`/`Simulation._derivatives`
(same `G`/`SOFTENING`, import from `@core/Simulation.js`/`@core/constants.js`) — copy the
same small `accelerationAt(position, bodies)` helper verbatim from `ForceFieldCalculator.js`
(this codebase already duplicates this tiny helper per-calculator rather than sharing it —
follow that existing convention, don't refactor it out).

**Integration** — fixed-step, following the field (attractive, so lines flow TOWARD masses —
this is physically correct for gravity, distinct from magnetic field lines which form closed
loops; note this distinction in a code comment so it's not mistaken for a bug later):
```js
const STEP_SIZE = 0.15;
const MAX_STEPS = 200;
const TERMINATION_RADIUS = 0.3; // stop once this close to any body — "absorbed"
const MAX_EXTENT = 20; // matches GRID_EXTENT elsewhere (ForceFieldCalculator etc.)
```
For each seed: `points = [seed]`, `position = seed`. Loop up to `MAX_STEPS` times: compute
`accel = accelerationAt(position, bodies)`, normalize it to a unit direction, `position =
add(position, scale(direction, STEP_SIZE))`, push `position` into `points`. Stop the loop
early if the nearest body is closer than `TERMINATION_RADIUS`, or if any coordinate's
magnitude exceeds `MAX_EXTENT`. Return `{ seedIndex, points }` for every seed (even short
ones — a 2-point line that immediately hit a body is a valid, real result, not an error).

**Acceptance check:** `yarn test` passes (10/10 — unrelated file). Write a quick manual sanity
check in your own head/scratch (not a committed test file): for the two-body preset, seeds
near the smaller body should trace short paths converging into the larger body along
roughly-radial lines.

---

### Task 9: FieldLinesOverlay [assigned: capable worker — visual judgment on arrow placement]

**File:** new `src/adapters/overlays/fieldLinesOverlay.js`, `class FieldLinesOverlay extends
OverlayRenderer` (`@api/OverlayRenderer.js`). Depends on the Task 8 interface above (build
against that documented shape — Task 8 may still be in flight, don't wait on it).

Read `src/adapters/overlays/lagrangePointsOverlay.js` first for the general shape (constructor
takes `(scene, toThree)`, holds a `THREE.Group`, `update(relBodies)`/`dispose()`).

- **Lines**: one `THREE.Line` per streamline (`THREE.BufferGeometry` position attribute built
  from `toThree(p)` for each `p` in `points`, `THREE.LineBasicMaterial`). Streamline count
  varies by body count (12 seeds/body) — rebuild-on-change the same way
  `potentialFieldOverlay.js` rebuilds its mesh when point count changes (dispose old
  Line objects, create new ones sized to the current result).
- **Arrows**: place a small arrow/cone marker every `ARROW_SPACING = 8` points along each
  line (i.e. at `points[0]`, `points[8]`, `points[16]`, ...), oriented along the LOCAL tangent
  direction (`normalize(points[i+1] - points[i])`, using the same `THREE.Quaternion.
  setFromUnitVectors(UP, tangent)` approach `forceFieldOverlay.js` already uses for its cone
  instances — reuse that exact technique). A plain `THREE.Mesh`/`ConeGeometry` per arrow is
  fine here (line count is modest — `bodies.length * 12` lines, not a huge instanced count
  like the force field); no need for `InstancedMesh` at this scale.
- **Toggle**: add `showFieldLines` to `src/app/displaySettings.js` (boolean, default false,
  same comment style as `showForceField` etc.) and gate `update()`'s compute+render on it,
  same pattern as every other overlay (`if (!displaySettings.showFieldLines) return;`).
- **Wire into `src/viewport/viewport.js`**: import + instantiate alongside the other 4
  overlays, call `.update(relBodies)` in the render loop — exact same pattern.
- **Add the checkbox** in `src/viewport/displayControls.js`, same `makeRow(...)` pattern as
  the other toggles (or, if Task 10/11's `DisplayOption` refactor has already landed by the
  time you do this, add it as a `BooleanDisplayOption` entry instead — check which pattern is
  currently in the file and match it, don't leave two different styles side by side).

**Acceptance check:** `yarn test` passes. `yarn build` succeeds. `yarn dev`, toggle "Field
lines" on, confirm lines + arrows render without console errors, toggling off removes them
with zero per-frame cost.

---

## Seam: Display options — Task 10 (data model) and Task 11 (view renderer) [done: team-lead]

Fixed interface contract both tasks must match exactly:
```js
// @api/DisplayOption.js — 3 classes, no logic beyond constructors
export class DisplayOption {
  constructor(key, label, title) { this.key = key; this.label = label; this.title = title; }
}
export class BooleanDisplayOption extends DisplayOption {}
export class RangeDisplayOption extends DisplayOption {
  constructor(key, label, title, { min, max, step }) {
    super(key, label, title);
    this.min = min; this.max = max; this.step = step;
  }
}
```
A `RangeDisplayOption` reads/writes a NUMBER on `displaySettings[key]`; a `BooleanDisplayOption`
reads/writes a boolean. `key` must exactly match an existing `displaySettings` field name.

### Task 10: DisplayOption classes + declarative option list [assigned: haiku worker]

**Files:**
- New `src/api/DisplayOption.js` — the 3 classes above, verbatim.
- New `src/app/displayOptions.js` — `export const DISPLAY_OPTIONS = [...]`, one entry per
  EXISTING option currently hand-built in `src/viewport/displayControls.js` (read that file
  in full first) — i.e. `massSize`, `axisNames`, `showLagrangePoints`, `showForceField`,
  `forceFieldScale`, `forceFieldDensity`, `showPotentialField`, `showEquipotentialLines`,
  `equipotentialLineCount`, `potentialFieldZ`, `potentialFieldScale`,
  `potentialFieldResolution` — copy each one's exact label/title/min/max/step from the
  current file, don't invent new values. Do NOT include `nlips` — it stays a special
  always-visible pill outside the popover, not part of this declarative list.
  ```js
  import { BooleanDisplayOption, RangeDisplayOption } from '@api/DisplayOption.js';
  export const DISPLAY_OPTIONS = [
    new BooleanDisplayOption('massSize', 'Mass-scaled size', undefined),
    new BooleanDisplayOption('axisNames', 'Axis names', undefined),
    new BooleanDisplayOption('showLagrangePoints', 'Lagrange points (L1–L5)', '<copy exact title from current file>'),
    // ...one per existing option, in the same order they currently appear...
    new RangeDisplayOption('forceFieldScale', 'Field scale', '<copy exact title>', { min: -0.5, max: 1.5, step: 0.1 }),
    // ...etc for every range option, copying min/max/step exactly from the current file...
  ];
  ```

**Do NOT** touch `displayControls.js` in this task — Task 11 owns that file. Your only output
is the two new files.

**Acceptance check:** `yarn test` passes (10/10 — unrelated files). Re-read your
`DISPLAY_OPTIONS` array against the current `displayControls.js` line by line and confirm
every key/label/title/min/max/step matches exactly — a mismatched range would silently change
a slider's behavior.

### Task 11: Switch-based control renderer [assigned: capable worker — real refactor]

**File:** `src/viewport/displayControls.js` only. Depends on the Task 10 interface above
(build against that documented shape — Task 10 may still be in flight, don't wait on it; if
`src/app/displayOptions.js` doesn't exist yet when you start, write your code against the
documented `DISPLAY_OPTIONS`/`BooleanDisplayOption`/`RangeDisplayOption` shape and it will
just work once Task 10 lands, since you're importing not duplicating).

**Goal:** replace every individual hand-built option block (`massSizeCheckbox`,
`axisNamesCheckbox`, `lagrangeCheckbox`, `forceFieldCheckbox`, `scaleRow`/`scaleInput`,
`densityRow`/`densityInput`, `potentialFieldCheckbox`, `equipotentialCheckbox`,
`equipotentialCountRow`, `potentialZRow`, `potentialScaleRow`, `potentialResolutionRow` — read
the current file for the exact list) with ONE loop over `DISPLAY_OPTIONS` that switches on
the option's class/type and builds the right DOM:

```js
import { DISPLAY_OPTIONS } from '@app/displayOptions.js';
import { BooleanDisplayOption, RangeDisplayOption } from '@api/DisplayOption.js';

const controlsByKey = {}; // key -> the input element, for the sync block below

for (const option of DISPLAY_OPTIONS) {
  if (option instanceof BooleanDisplayOption) {
    controlsByKey[option.key] = makeRow(option.key, option.label, option.title); // reuse existing makeRow helper, unchanged
  } else if (option instanceof RangeDisplayOption) {
    const row = document.createElement('label');
    row.className = 'dc-row';
    if (option.title) row.title = option.title;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(option.min);
    input.max = String(option.max);
    input.step = String(option.step);
    input.value = String(displaySettings[option.key]);
    input.addEventListener('input', () => {
      displaySettings.set(option.key, parseFloat(input.value));
    });
    row.append(option.label, input);
    panel.appendChild(row);
    controlsByKey[option.key] = input;
  } else {
    throw new Error(`Unhandled DisplayOption type for key "${option.key}"`);
  }
}
```
(That final `else { throw }` is deliberate — an unhandled type should fail loudly, not
silently render nothing, per the "exhaustive switch" spirit of the original ask.)

**Then rewrite the settings-sync block** (`displaySettings.onChange((s) => {...})`) to loop
over `DISPLAY_OPTIONS` too, instead of one hand-written line per option:
```js
displaySettings.onChange((s) => {
  syncNlipsPill(s.nlips); // NLIPS stays special-cased, not in the loop
  for (const option of DISPLAY_OPTIONS) {
    const el = controlsByKey[option.key];
    if (option instanceof BooleanDisplayOption) el.checked = s[option.key];
    else el.value = String(s[option.key]);
  }
});
```

**Keep unchanged:** the NLIPS pill (special-cased, always-visible, not part of
`DISPLAY_OPTIONS`), the `makeRow` helper itself (still used for booleans), the popover
open/close click handlers, all CSS/styles.

**Acceptance check:** `yarn test` passes. `yarn build` succeeds. `yarn dev`, open Display ▾,
confirm every checkbox/slider that existed before still appears with the same label/range and
still works (toggle a checkbox, drag a slider, confirm the corresponding overlay/behavior
still reacts) — this must be a pure refactor, zero behavior change.

---

## Seam: Constants editable in UI — Task 12 (core) and Task 13 (UI) [done: team-lead]

Fixed contract: `Config` instances (`src/core/Config.js`) are plain mutable objects —
`config.softening = 5` already works today, no setter needed. `Config.list` was JUST changed
to a live getter (rebuilds from current field values every access, not a frozen snapshot) —
confirm that's in place before starting either task. The only remaining blocker is that
`Simulation.js`/`constants.js` cache values into separate consts at import time instead of
reading `config.*` fresh each use — Task 12 fixes that; Task 13 makes the UI actually write to
`config.*` and re-render live.

### Task 12: Simulation reads SOFTENING live [assigned: haiku worker]

**File:** `src/core/Simulation.js` only.

Currently: `import { SOFTENING } from './constants.js';` at the top, then `SOFTENING` used in
`_derivatives()` and `totalEnergy()`. Change to `import { config } from './Config.js';` and
replace every use of the bare `SOFTENING` identifier inside `_derivatives()` and
`totalEnergy()` with `config.softening` (read live on each call, not cached). Do NOT change
`constants.js` — `SOFTENING` stays exported from there for anything else that imports it
(e.g. doc comments elsewhere reference it); this task only changes what `Simulation.js`
itself reads.

**Acceptance check:** `yarn test` passes (10/10). `yarn build` succeeds.

### Task 13: Editable Constants section + live refresh [assigned: capable worker]

**File:** `src/viewport/objectPanel.js` only.

Read the file in full first — specifically the existing Constants section (search
`constantsSection`/`op-constant-row`) and the existing per-body position-input pattern (`x=`/
`y=`/`z=` inputs added in an earlier task — search `xInput`) for the exact editable-input
style to mirror (same `input[type=number]`, `step="any"`, same `change` listener pattern).

- Replace each Constants row's static value `<span>` with an `<input type="number"
  step="any">`, initialized from `row.value` (from `config.list`, which now has a `.key` field
  on each entry — added alongside `label`/`value`/`unit` when `Config.list`'s getter was
  updated, confirm that key is there).
- On `change`, write directly back: `config[row.key] = parseFloat(input.value) || 0`. No
  validation/clamping needed — this mirrors the body-position inputs' simplicity.
- **Live refresh**: unlike body cards, nothing currently re-renders the Constants section
  per frame. Since editing a constant should show up immediately if something else changes
  it too (unlikely today, but keep it consistent with every other live readout in this file),
  add the Constants section's inputs to the SAME `store.onFrame(...)` callback that already
  updates the Calc grid — skip updating a given input while `document.activeElement` equals
  it (exact same "don't clobber while focused" pattern used for mass/speed/x/y/z already in
  this file).
- Keep the Equations section (static, unrelated) untouched.

**Acceptance check:** `yarn test` passes. `yarn dev`, edit the Softening value in the
Constants section, confirm the input keeps your typed value (doesn't get stomped next frame),
and — once Task 12 has also landed — confirm the sim's actual behavior changes (e.g. a much
larger Softening should visibly soften/prevent close-encounter energy spikes). If Task 12
hasn't landed yet when you finish, that's fine — say so in your report, don't block on it.

---

## Research: Effective-potential (Jacobi) field for Lagrange points [done: team-lead — design doc only, not implemented]

Design-only task (no code) — see WORK_ITEMS.md's open item: "add an effective-potential
(Jacobi) field visualization tied to the Lagrange points, distinct from the potential field's
raw gravitational U." Read `src/core/overlays/LagrangePointsCalculator.js` and
`src/core/overlays/PotentialFieldCalculator.js` first. The classic Jacobi/effective potential
for a restricted 3-body problem, in the ROTATING frame, is `Φ_eff(x,y) = -G·m1/r1 - G·m2/r2 -
½ω²(x²+y²)` where `ω` is the primaries' orbital angular rate and `r1`/`r2` are distances to
each primary — the last term (centrifugal) is what makes L4/L5 into local maxima rather than
saddle points, distinguishing this from the plain gravitational potential already rendered.
Produce a worker-ready task doc (same level of detail as the equipotential-lines task above):
exact formula adaptation for this codebase's `Simulation.G`/`SOFTENING`, how to compute `ω`
from the two primaries' current relative position+velocity (matches
`LagrangePointsCalculator`'s existing primary/secondary selection — reuse that, don't
reinvent), and whether to render it as a displaced mesh (reuse `PotentialFieldOverlay`'s
approach) or contour lines (reuse the equipotential approach) — recommend one, with the
tradeoff. Report back under 300 words.

---

## Task 14: Ratchet-poisoning regression coverage + shared extraction [done: merged into main tree — `src/adapters/overlays/ratchet.js` + `test/adapters/overlays/ratchet.test.js` present, `yarn test` 26/26]

**Goal:** extract the duplicated `nearestBodyDistance`/ratchet-exclusion logic (previously
inline in each overlay, no regression test) into a shared pure function, and cover it with
unit tests.

**Files touched:** new `src/adapters/overlays/ratchet.js` (`nearestBodyDistance`,
`excludeNearBody`), new `test/adapters/overlays/ratchet.test.js` (6 tests). Updated
`forceFieldOverlay.js`, `potentialFieldOverlay.js`, and `equipotentialLinesOverlay.js` to
import `excludeNearBody` instead of each having its own copy of the method — behavior
unchanged, same `RATCHET_EXCLUSION_RADIUS` constants left in place per-file (only the distance
check was shared, not the constants).

**Verified:** `yarn test` 26/26, `yarn build` clean.

---

## Task 15: CountBasedFieldSampler — upstream half (calculators + settings) [done: merged into main tree — `ForceFieldCalculator`/`FieldLinesCalculator` both take `{radius, count}` in main]

**Goal:** per planet-plot-04's seam design (item 15 in WORK_ITEMS.md), replace grid-resolution/
density with a user-facing count + a "sphere of draw" radius, output shape unchanged so
downstream rendering doesn't need to change to consume it.

**Files touched:**
- `src/core/overlays/ForceFieldCalculator.js`: `compute(bodies, {radius, count})` replaces
  `compute(bodies, {extent, resolution})` — `radius` replaces `extent` 1:1, `count` is
  distributed as a stratified grid sized `round(cbrt(count))` per side (actual returned length
  is the nearest perfect cube to `count`, noted in the doc comment). Output shape unchanged
  (`{position, vector, magnitude}[]`).
- `src/core/overlays/FieldLinesCalculator.js`: `compute(bodies, {radius, count})` replaces the
  fixed `SEEDS_PER_BODY = 12` constant and the fixed `MAX_EXTENT` constant — `count` seeds are
  divided evenly across all bodies (`round(count / bodies.length)` per body, same
  Fibonacci-sphere distribution), `radius` doubles as both seed-placement radius and max
  streamline travel distance. Fixed a latent divide-by-zero in `fibonacciSpherePoint` for the
  n=1 seed-per-body case (only reachable now that seed count is user-controlled and could be
  very low). Output shape unchanged (`{seedIndex, points}[]`).
- `src/app/displaySettings.js`: added `forceFieldRadius`/`forceFieldCount` (replacing
  `forceFieldDensity`), `fieldLinesRadius`/`fieldLinesCount`/`fieldLinesScale`.
- `src/app/displayOptions.js`: swapped the "Field density" slider for "Field radius"/"Field
  count", added "Field lines radius"/"Field lines #"/"Field lines scale" sliders.

**Not touched (per the seam split — downstream, assigned elsewhere):**
`forceFieldOverlay.js`, `fieldLinesOverlay.js`, the new billboard-arrow renderer. These
overlays still call `.compute()` with the old `{extent, resolution}` shape today — harmless
(the old keys are just ignored, calculators fall back to their defaults) but the new sliders
above have no effect until downstream is wired to read `forceFieldRadius`/`forceFieldCount`/
`fieldLinesRadius`/`fieldLinesCount`/`fieldLinesScale` instead.

**Verified:** `yarn test` 26/26, `yarn build` clean. Not yet exercised live in `yarn dev`
(sliders don't do anything visible until downstream lands, per above).

---

## Research: Provider/DI container + ViewController architecture [done: team-lead — recommends against building either, see report]

Design-only task (no code) — see WORK_ITEMS.md's two open items: "@provider directory ...
provide<ConcreteName><ApiName>(): FieldCalculator = ConcreteFieldCalculator() ... inject
dependencies as composition root" and "ViewController has view rendering methods that main
orchestrates instead of calling the library directly." Read `src/viewport/viewport.js` and
`src/main.js` in full first — these are the two files that currently do direct
`new ConcreteClass()` construction and direct three.js/DOM calls respectively.

Produce a concrete plan: (1) what a minimal `@provider` directory looks like for THIS
codebase's actual interfaces (`FieldCalculator`, `OverlayRenderer`, `PlotCorrectionStrategy`,
`Logger`) — one `Provider` class per interface family, or one combined provider object with
several `provideX()` methods? Recommend one, with the tradeoff. (2) What concretely changes
in `viewport.js` (currently `new LagrangePointsOverlay(scene, toThree)` etc. inline) — does
the provider get passed INTO `mountViewport(el, store, provider)`, or imported as a singleton
like `store`/`displaySettings` already are? Recommend one, consistent with this codebase's
existing composition-root conventions (check `main.js` for how `store`/loggers are wired
today). (3) What "ViewController" would concretely BE here — is `viewport.js`'s
`mountViewport` function already close to this role (it does own all the three.js calls
already), or does the ask imply extracting it into a class with named methods `main.js` calls
instead of one big function? Recommend one. Report back under 400 words, each
recommendation ending with "so the follow-up task doc should say: ...".

---

## Task 15: BillboardArrowOverlay — 2D camera-facing arrows for the force field [done: team-lead — verified already implemented in main working tree]

**Verified:** `src/adapters/overlays/billboardArrowOverlay.js` exists, wired into
`viewport.js` with `camera` as a 3rd constructor arg, `showBillboardArrows` in
`DISPLAY_OPTIONS`. Uses a documented camera-right/up basis-rotation approach instead of the
spec's exact `setFromUnitVectors` formula — functionally equivalent camera-facing billboard,
with an in-code comment explaining why the simpler formula was rejected (roll drift). `yarn
test` 104/104 passing in the main tree. Not re-verified live in `yarn dev` this pass (see
Task 16/17 notes on the shared browser session).

**Goal:** replace the force field's 3D-oriented cone glyphs with camera-facing 2D arrow
billboards (a "quiver plot" look) per the user's explicit ask. **Seam confirmed clean**:
`ForceFieldCalculator` needs ZERO changes — same `{position, vector, magnitude}[]` output,
same `excludeNearBody` filtering, same magnitude normalization. This task only touches the
renderer side. (A separate, independent task — `CountBasedFieldSampler` — may be changing
`ForceFieldCalculator` to accept `{count}` instead of `{extent, resolution}` around the same
time; that's a different worker's job and doesn't change this task's contract — you consume
whatever shape `compute()` returns, which stays `{position, vector, magnitude}[]` either way.)

**File:** new `src/adapters/overlays/billboardArrowOverlay.js`, `class BillboardArrowOverlay
extends OverlayRenderer` (`@api/OverlayRenderer.js`). Read `src/adapters/overlays/
forceFieldOverlay.js` in full first — same `MAX_RESOLUTION`/ratchet/`excludeNearBody`
pattern, same `ForceFieldCalculator` usage, only the rendering half changes.

**Rendering approach — one InstancedMesh of quads + a custom shader** (NOT individual
`THREE.Sprite`s — those don't scale past a few hundred, same reason `ArrowHelper` was
rejected earlier in this same file):
- Geometry: a small `THREE.PlaneGeometry` (or a hand-built 2-triangle quad — either is fine)
  representing one arrow glyph in local space.
- `THREE.InstancedMesh(quadGeometry, shaderMaterial, MAX_RESOLUTION ** 3)` — mirrors the
  existing cone `InstancedMesh` 1:1, same instance cap, same per-frame `mesh.count =
  instanceCount` / `mesh.instanceMatrix.needsUpdate` pattern.
- Per-instance data: since a shader needs per-instance ROTATION (screen-space angle) which
  `InstancedMesh`'s built-in matrix already encodes as a 2D rotation-in-a-plane, the simplest
  approach: still use `setMatrixAt` per instance, but build each instance's matrix as a
  camera-facing billboard transform — position + rotation (angle around the camera's forward
  axis, see below) + scale (by magnitude, same as the cone version does with length).
- **Camera-space angle formula** (compute once per instance per frame, in `update()`):
  ```js
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const vx = worldDirection.dot(right);
  const vy = worldDirection.dot(up);
  const angle = Math.atan2(vy, vx);
  ```
  Build the instance's rotation as a rotation of `angle` around the camera's OWN forward
  axis (`camera.getWorldDirection(...)`), composed with a base "face the camera" orientation
  — i.e. the quad's plane normal points at the camera, and within that plane it's rotated by
  `angle`. Concretely: `quaternion = cameraFacingQuaternion.multiply(new
  THREE.Quaternion().setFromAxisAngle(FORWARD_AXIS, angle))` where `cameraFacingQuaternion`
  aligns the quad's default normal (+Z) with the vector FROM the instance TO the camera
  (`camera.position.clone().sub(instancePosition).normalize()`), computed via
  `Quaternion.setFromUnitVectors(quadDefaultNormal, toCameraDir)`.
- Texture: one small canvas-drawn arrow (a triangle/chevron shape is enough — draw it once at
  construction into a `THREE.CanvasTexture`, reused as the shared material's map for every
  instance — same technique already used elsewhere in this codebase for label sprites, check
  `src/plots/plot3d.js`'s `_makeLabelSprite`/`_setSpriteText` for the exact canvas-texture
  pattern to copy). Material: `THREE.MeshBasicMaterial({ map: texture, transparent: true,
  side: THREE.DoubleSide })` — unlit, matching every other overlay in this codebase.

**Constructor takes `camera` as a third argument**: `new BillboardArrowOverlay(scene,
toThree, camera)` — this is the one real interface wrinkle, since no other `OverlayRenderer`
needs camera access. Update `src/viewport/viewport.js`'s instantiation call to pass `camera`
(already in scope in that file's closure — check where `camera` is declared, likely near the
top of `mountViewport`). Do NOT change the `OverlayRenderer.update(relBodies)` signature — no
other overlay should need to start passing a camera through `update()`.

**Wire in**: add `displaySettings.showBillboardArrows` (boolean, default false) — this is a
NEW toggle, separate from `showForceField` (the existing cone version) — add both as
alternative visualizations of the same underlying field data so the user can compare, per the
earlier "which one do you actually want" question still open in WORK_ITEMS.md. Add the
checkbox via the `DISPLAY_OPTIONS` declarative list (`@app/displayOptions.js` +
`BooleanDisplayOption`) — that refactor already landed, use it, don't hand-build a row.

**Acceptance check:** `yarn test` passes (10/10+ — unrelated files). `yarn build` succeeds.
`yarn dev`, toggle "Billboard arrows" on, confirm 2D arrow glyphs appear and visibly rotate to
track the camera as you orbit the view with mouse drag (this is the whole point — a true 3D
cone would NOT visibly re-rotate just from orbiting the camera around a fixed vector; a
correct billboard WILL, since its screen-space projection angle changes with camera angle).

**Do NOT** add a new npm dependency (no billboard/sprite library) — plain three.js
`InstancedMesh` + canvas texture + the quaternion math above, per the research.

---

---

## Task 17: Wire new radius/count settings into the 3 force-field/field-lines overlays [done: merged into main tree — branch/worktree task-17-radius-count consolidated and removed]

**Verified:** `yarn test` 26/26, `yarn build` clean. Live `yarn dev` visual check not done —
shared chrome-devtools MCP browser session locked by another concurrent worker at the time;
code reviewed manually against `ForceFieldCalculator`/`FieldLinesCalculator`'s actual
`{radius, count}` signatures instead.

**Files touched:** `forceFieldOverlay.js` (dropped stale `GRID_EXTENT`/`forceFieldDensity`/
`resolution` calc, now passes `{radius: forceFieldRadius, count: forceFieldCount}`, removed
now-dead `currentResolution` field), `billboardArrowOverlay.js` (same fix, same two settings),
`fieldLinesOverlay.js` (passes `{radius: fieldLinesRadius, count: fieldLinesCount}`; wired
`fieldLinesScale` into the per-arrow-marker `ConeGeometry` radius/height, renamed the old
fixed `ARROW_RADIUS`/`ARROW_HEIGHT` constants to `BASE_ARROW_RADIUS`/`BASE_ARROW_HEIGHT` —
mirrors `forceFieldScale`'s "scale multiplies the data→visual-size mapping" convention;
skips drawing an arrow marker entirely once `fieldLinesScale` collapses it to ~0 length).

**Goal:** `planet-plot-f2` landed `ForceFieldCalculator.compute(bodies, {radius, count})` and
`FieldLinesCalculator.compute(bodies, {radius, count})` (replacing the old
`{extent, resolution}` shape) plus new `displaySettings` fields: `forceFieldRadius`,
`forceFieldCount`, `fieldLinesRadius`, `fieldLinesCount`, `fieldLinesScale`. Three overlay
files still call `.compute()` with the OLD shape/local constants, so the new sliders
(already wired into `displayControls.js`) currently do nothing visible. Fix all 3 call sites.

**Files (read each calculator's current signature first, exactly, before editing anything —
don't assume, confirm):** `src/core/overlays/ForceFieldCalculator.js`,
`src/core/overlays/FieldLinesCalculator.js`.

**1. `src/adapters/overlays/forceFieldOverlay.js`**: replace the local `GRID_EXTENT`/
`resolution` (from `displaySettings.forceFieldDensity`, which no longer exists — check
what field name it's reading now, it may already be broken/reading undefined) with
`radius: displaySettings.forceFieldRadius, count: displaySettings.forceFieldCount` passed
into `.compute()`.

**2. `src/adapters/overlays/billboardArrowOverlay.js`**: same fix, same two settings keys
(`forceFieldRadius`/`forceFieldCount`) — this overlay shares the same field data as
`forceFieldOverlay.js`, just renders it differently, so it uses the SAME two settings, not
separate ones.

**3. `src/adapters/overlays/fieldLinesOverlay.js`**: currently calls `.compute(relBodies)`
with no options at all (read the file to confirm) — add
`{ radius: displaySettings.fieldLinesRadius, count: displaySettings.fieldLinesCount }`. Also
wire `displaySettings.fieldLinesScale` into whatever currently controls this overlay's
rendered line/arrow length (read the file for what "scale" would apply to — likely arrow
marker size along each streamline, or overall line length — if there's no existing scale
knob in this file at all, multiply the rendered scale/size of whatever visual element exists
by `fieldLinesScale`, following the same "scale multiplies the mapping from data to visual
size" convention as `forceFieldScale` elsewhere).

**Do NOT** touch `equipotentialLinesOverlay.js` or `potentialFieldOverlay.js` — those use
`PotentialFieldCalculator`, a different calculator, not part of this seam/refactor.

**Acceptance check:** `yarn test` passes, `yarn build` succeeds. `yarn dev`, toggle each of
Force vector field / Billboard arrows / Field lines on, drag each one's radius/count/scale
sliders, confirm the rendered field visibly changes (more/fewer points, bigger/smaller
bounding volume, longer/shorter arrows) — not just that the slider moves with no visual
effect.

---

## Task 16: Swappable arrow style library [done: merged into main tree — branch/worktree task-16-arrow-style consolidated and removed]

**Verified:** `yarn test` 26/26, `yarn build` clean. Live `yarn dev` visual check not done —
the shared chrome-devtools MCP browser session was locked by another concurrent worker at the
time; code was reviewed manually against the acceptance criteria instead (canvas draw calls
for `skinny` produce a barbed head starting at `size*0.62` with a `lineWidth` 2 shaft vs.
chevron's `lineWidth` 4 / `size*0.58` head start — a real, visible difference).

**Files touched:** `src/api/DisplayOption.js` (+`SelectDisplayOption`), new
`src/adapters/overlays/arrowStyles.js` (`chevron`/`skinny`), `src/adapters/overlays/
billboardArrowOverlay.js` (style-keyed texture + rebuild-on-change), `src/app/
displaySettings.js` (+`arrowStyle`, default `'skinny'`), `src/app/displayOptions.js`
(+`SelectDisplayOption` entry), `src/viewport/displayControls.js` (+`<select>` branch).

**Goal:** the billboard arrow's shape (`makeArrowTexture()` in `billboardArrowOverlay.js`)
should be swappable between a few styles, not hardcoded to one canvas drawing. User wants a
"skinny" style — thin shaft, longer swept-back barbs/fins on the head (like `⟹` but with
bigger fins), shaft:head length ratio around 2:1 to 3:1 (i.e. the head takes up roughly a
third to a half of the total arrow length, not a small tip) — and to be able to swap styles
via a control, same as every other display option in this codebase.

**1. New `DisplayOption` subtype** — `src/api/DisplayOption.js` currently has
`BooleanDisplayOption`/`RangeDisplayOption` (read the file). Add:
```js
export class SelectDisplayOption extends DisplayOption {
  constructor(key, label, title, { choices }) {
    super(key, label, title);
    this.choices = choices; // string[] of valid values for displaySettings[key]
  }
}
```

**2. Arrow style registry** — new file `src/adapters/overlays/arrowStyles.js`:
```js
export const ARROW_STYLES = {
  chevron: (ctx, size) => { /* move the EXISTING makeArrowTexture() drawing code here verbatim, renamed */ },
  skinny: (ctx, size) => { /* new: thin shaft (lineWidth ~2, not 4), longer head take-up
    (head occupies from ~size*0.55 to size*0.95, vs today's ~0.58-0.95 — barely different;
    make the shaft:head ratio genuinely 2:1 to 3:1 by starting the head around size*0.6-0.65
    and drawing wider/longer swept-back fins — e.g. the two back corners of the chevron
    triangle should sweep BACKWARD past the head's leading tip, like barbs, not a simple
    solid triangle) */ },
};
```
Each function has the exact same signature as the current inline drawing code in
`makeArrowTexture()` (a 2D canvas context + the texture size) — read that function in full
first and preserve its exact style (stroke for shaft, fill for head) for `chevron`, just
relocated.

**3. Wire into `billboardArrowOverlay.js`**:
- `makeArrowTexture(styleKey)` takes the style key, looks up `ARROW_STYLES[styleKey]`, calls
  it instead of the current inline drawing.
- Rebuild the texture (dispose the old one, create + assign a new one to
  `this.mesh.material.map`, set `needsUpdate`) whenever `displaySettings.arrowStyle` changes
  — check for the change in `update()` (track `this.currentArrowStyle`, compare each frame,
  rebuild only on change — same "rebuild on change" pattern `potentialFieldOverlay.js` uses
  for resolution changes).

**4. `src/app/displaySettings.js`**: add `this.arrowStyle = 'skinny';` (default per the
user's stated preference — "I think I want skinny one").

**5. `src/app/displayOptions.js`**: add `new SelectDisplayOption('arrowStyle', 'Arrow style',
'<a one-line description>', { choices: ['chevron', 'skinny'] })` to `DISPLAY_OPTIONS`.

**6. `src/viewport/displayControls.js`**: the existing loop (search `DISPLAY_OPTIONS`) only
switches on `BooleanDisplayOption`/`RangeDisplayOption` — add a THIRD branch for
`SelectDisplayOption` building a `<select>` with one `<option>` per `choices` entry, wired
the same way (`change` event → `displaySettings.set(option.key, select.value)`), added to
`controlsByKey` and the sync loop like the other two branches. Do NOT change how the other
two branches work.

**Acceptance check:** `yarn test` passes, `yarn build` succeeds. `yarn dev`, toggle Billboard
arrows on, switch the new "Arrow style" dropdown between chevron/skinny, confirm the arrow
shape visibly changes (skinny = thinner shaft, longer swept fins) without a page reload.

**Do NOT** add an icon/arrow library dependency — this is ~20-40 lines of canvas path
drawing per style, no new deps needed, matching every other overlay in this codebase.

---

## Research: Rotational bodies — Euler angles vs quaternion [done: team-lead — design doc only, not implemented]

Design-only task (no code) — see WORK_ITEMS.md's open item: "rotational bodies — not done,
needs-design (Euler angles vs quaternion)", with two blocked sub-items (ψ/ψ̇ readouts,
already-registered `dAdt`). Read `src/core/Body.js`, `src/core/Simulation.js`
(`_packState`/`_derivatives`/RK4 step), and `src/viewport/objectPanel.js`'s CALC_METRICS
comment (explicitly calls out ψ/ψ̇ as deferred) before proposing a data model.

**Key physical fact that simplifies this a lot**: `_derivatives()` treats every body as a
point mass — gravity between point masses exerts zero torque about either body's own center.
So for a body with a spherically-symmetric mass distribution (the only kind this sim's
`Body` currently models — mass + position, no shape), spin is **physically decoupled** from
the N-body dynamics: angular velocity is constant, full stop, no differential equation to
integrate. That rules out extending `_packState`/`_derivatives`/the RK4 step at all for a V1
— rotation doesn't need to touch the physics core `_derivatives()` already flags (in its own
comment) as needing an interface/adapter someday; this is a separable concern.

**Recommendation: quaternion for simulation state, Euler angle only at the display boundary.**
- Add `Body.spinAxis` (unit vector, default `[0,1,0]`) and `Body.spinRate` (rad/tu, constant,
  user-set — same "just a number on the body" pattern as `mass`). No RK4 changes.
- Track orientation as a `THREE.Quaternion`-compatible `[x,y,z,w]` on `Body`, updated
  kinematically each frame from `sim.time`: `q(t) = axisAngle(spinAxis, spinRate * t)`. This
  is a closed-form update (no accumulation error over long runs, unlike integrating
  ψ̇ step-by-step) and composes for free with `viewport.js`'s existing quaternion-based mesh
  transforms (`toThree`, the billboard overlays' `THREE.Quaternion` usage) — no new rotation
  representation for the renderer to learn.
- For the ψ/ψ̇ **readout** specifically (a single precession-style angle+rate, not a full
  3-angle Euler set): don't store ψ separately — derive it as `ψ = spinRate * sim.time (mod
  2π)`, `ψ̇ = spinRate`, computed the same place `dAdt`/`rdot` etc. already live
  (`metrics.js`), reading `body.spinRate` and the current snapshot's time. Euler angles
  (ψ, θ, φ three-angle sets) are the right tool for *asymmetric* torque-free rigid-body
  tumbling (real nutation, tennis-racket-theorem chaos) — but that needs an inertia tensor
  per body and Euler's rigid-body equations integrated via RK4, a much bigger V2 this sim
  doesn't need yet since `Body` has no shape/inertia concept at all today.

**So the follow-up task doc should say:** add `spinAxis`/`spinRate` to `Body`, a closed-form
quaternion orientation update read once per render frame in `viewport.js` (rotate each body's
mesh, zero coupling to `Simulation.step()`), and `spin`/`spinRate` entries in `metrics.js`
for the ψ/ψ̇ readout — explicitly deferring inertia-tensor/asymmetric-tumbling physics as an
unscoped V2 if the user ever asks for real nutation instead of a constant decorative spin.

---

## Task 18: Unified "Gravitational Potential" display panel [done: team-lead, merged into main tree]

**Goal:** consolidate the potential-field controls (currently 5 separate flat entries in
`DISPLAY_OPTIONS`) into one grouped panel: multi-select pill buttons choosing which
sub-visualization(s) are active (grav potential surface, equipotential lines — either, both,
or neither), plus 3 shared sliders (scale, resolution, number of lines). "Number of lines" is
a no-op when only the surface is active (no lines to count); the surface's displacement is
similarly unaffected by line count — that's expected, not a bug.

**1. Remove from the generic flat list** — `src/app/displayOptions.js`: delete the 5
`DISPLAY_OPTIONS` entries for `showPotentialField`, `showEquipotentialLines`,
`potentialFieldScale`, `potentialFieldResolution`, `equipotentialLineCount` (read the file to
find them — they were already bumped to `-10..30`/`4..600` ranges in a prior pass, keep
those same ranges, just relocate the controls). Everything else in `DISPLAY_OPTIONS` stays as
the generic flat list.

**2. New dedicated section** — new file `src/viewport/gravitationalPotentialPanel.js`,
`export function mountGravitationalPotentialPanel(container)`. Read
`src/viewport/displayControls.js` in full first for 2 things to copy exactly: (a) the NLIPS
pill's styling/pattern (`.dc-pill`/`.dc-pill-dot`/`.on` — this is your multi-select button
style, one pill per sub-visualization, `.on` when active) and (b) the general "inject scoped
`<style>` once, mount into a container" self-contained-module pattern this codebase always
uses for viewport UI widgets. Structure:
- A heading/label "Gravitational Potential".
- Two pill buttons: "Grav potential" (toggles `displaySettings.showPotentialField`) and
  "Equipotential lines" (toggles `displaySettings.showEquipotentialLines`) — same
  toggle-on-click + `displaySettings.onChange` sync pattern as the NLIPS pill, just 2 pills
  instead of 1, and BOTH can be on simultaneously (this is "multi-select", not radio/exclusive
  — clicking one never turns the other off).
- 3 range sliders: "Scale" (`potentialFieldScale`, range -10..30), "Resolution"
  (`potentialFieldResolution`, range 4..600), "Number of lines" (`equipotentialLineCount`,
  range 2..20) — same `<input type="range">` + `change`/`input` listener +
  `displaySettings.set(key, value)` pattern already used everywhere in `displayControls.js`.

**3. Mount it** — `src/viewport/viewport.js`: import `mountGravitationalPotentialPanel`,
call it once alongside the existing `mountDisplayControls(el)` call (read that call site,
same `el` container, right after or before it — check whether the two need distinct
positioning/CSS so they don't overlap on screen; the existing `.dc-root` is
`position: absolute; top: 10px; left: 10px` — this new panel needs its own absolute position
that doesn't collide, e.g. `top: 10px; right: 10px` or stacked below the first, pick one and
say which in your report).

**Do NOT** delete `showPotentialField`/`showEquipotentialLines`/`potentialFieldScale`/
`potentialFieldResolution`/`equipotentialLineCount` from `src/app/displaySettings.js` — those
fields stay, only their CONTROLS move out of the generic `DISPLAY_OPTIONS` list into this
dedicated panel. Do NOT touch the `SelectDisplayOption`/`BooleanDisplayOption`/
`RangeDisplayOption` classes or the generic loop in `displayControls.js` itself — that
machinery is unchanged, you're just removing 5 array entries from the data it iterates over.

**Acceptance check:** `yarn test` passes, `yarn build` succeeds. `yarn dev`, confirm the old
Display ▾ popover no longer shows potential-field controls, confirm the new panel shows both
pills + 3 sliders, confirm clicking each pill independently toggles its overlay (both can be
on at once), confirm each slider still visibly affects the running sim exactly as it did
before relocation.

---

## Task 19: Force-field "scale" = magnitude→size gamma curve, not flat resize [done: planet-plot-f2 — direct edit, not a worktree]

**Goal:** resolve the WORK_ITEMS.md item asking whether "scale" resizes the arrow image or
the underlying vector magnitude. User confirmed (via clarifying question): it should be a
magnitude-to-size MAPPING CURVE, not a flat multiplier — weak/far-field arrows should read
relatively "stronger" than the raw 1/r² falloff would render them, when scale is turned up.

**Files touched:** `src/adapters/overlays/forceFieldOverlay.js`,
`src/adapters/overlays/billboardArrowOverlay.js` (both shared the same flat-multiplier bug,
fixed identically — same underlying `ForceFieldCalculator` data, same slider). `scale` is now
a gamma exponent: `displayedMag = normalizedMag ** (1/scale)`, capped to `MAX_NORMALIZED_MAGNITUDE`
both before AND after the curve — gamma>1 (scale<1) expands values above the normalization
pivot as well as compressing values below it, so an uncapped post-curve result could blow up
arrow length at low scale settings. `scale=1` is identity (matches old default/behavior
exactly); `scale>1` boosts weak magnitudes; `scale<1` compresses them further.
`src/app/displaySettings.js` (doc comment) and `src/app/displayOptions.js` (slider range
changed from `-0.5..1.5` to `0.2..3` — the old range included 0 and negative values, which are
invalid as a gamma exponent's reciprocal).

**Note on process:** did this one directly in the shared checkout rather than a worktree — it
was a small, fast-moving fix mid-conversation with the user confirming the design live via a
clarifying question, and by the time the answer landed a worktree round-trip would have cost
more than the fix itself. Went straight back to worktree-per-task for anything larger.

**Verified:** `yarn test` 26/26, `yarn build` clean. Not yet checked live in `yarn dev`.

---

## Task 20: Field lines — CoM-centered seeding, label fix, arrow stretch [done: merged into main tree — branch/worktree fieldlines-com-seeding consolidated and removed, verified `centerOfMass` present in `FieldLinesCalculator.js`, `yarn test` 26/26]

**Goal:** resolve WORK_ITEMS.md's bug report — "field lines #" isn't working because seeds
are placed at a fixed `SEED_RADIUS = 1.5` around EACH body (a leftover from before the
radius/count seam landed), not distributed across the CoM-centered "sphere of draw" the
`fieldLinesRadius` slider is supposed to control. Bumping that slider currently does nothing
visible to seed placement — only to the streamline travel cutoff. Also: rename the slider
label, and stretch the arrow markers to 3:1 length:width per the ask.

- `src/core/overlays/FieldLinesCalculator.js`: replace per-body Fibonacci-sphere seeding
  with `count` seeds distributed via Fibonacci sphere on a shell of radius `radius` centered
  at the bodies' center of mass (mass-weighted average position) — same "sphere of draw"
  convention `ForceFieldCalculator`/`PotentialFieldCalculator` already use. Streamlines still
  integrate along the local force direction and terminate at the nearest body or `radius`
  extent from the CoM (also fixed: the old extent check was an axis-aligned box from the
  world origin, not a sphere from the CoM — inconsistent with every other "sphere of draw"
  calculator; now a straight distance-from-CoM check).
- `src/app/displayOptions.js`: relabel `fieldLinesCount` from `'Field lines #'` to
  `'Number of field lines'`.
- `src/adapters/overlays/fieldLinesOverlay.js`: arrow markers restretched to a 3:1
  length:width ratio (was ~1.9:1) — `ARROW_RADIUS` 0.04 → 0.025 (height unchanged at 0.15).

**Verified:** `yarn test` 26/26, `yarn build` clean. Numerically sanity-checked seeding
directly (2-body preset, `radius: 10, count: 12` → all 12 seed points measured exactly 10.00
from the mass-weighted CoM). Live `yarn dev` visual check not done — every browser MCP
(chrome-devtools, playwright) was locked by other concurrent sessions both times tried.

---

## Task 21: Rotational bodies — spin + ψ/ψ̇ readouts [done: merged into feat/simulator-mvp as bfd30c5 — branch/worktree consolidated and removed]

**Merge note:** this branch was left mid-conflict on disk by an earlier merge attempt —
`src/plots/metrics.js`/`src/viewport/objectPanel.js` had literal unresolved `<<<<<<<`
markers committed straight into `feat/simulator-mvp`, which broke `yarn test`/`yarn build`
for everyone (Rollup parse error) until found and fixed this session. Resolved by keeping
both sides' additions (this branch's spin/ψ metrics + a sibling branch's already-landed
constants-modifier reference span), verified clean after.

**Goal:** implement the V1 recommended in the "Research: Rotational bodies" entry above —
a constant decorative spin per body (kinematic, zero coupling to `Simulation.step()`/RK4,
since point-mass gravity exerts zero torque about a body's own center) plus ψ/ψ̇ metric
readouts, deferring inertia-tensor/asymmetric-tumbling physics as an unscoped V2.

**Files touched:** `src/core/Body.js` (`spinAxis`/`spinRate` constructor params, default
`[0,1,0]`/`0`), `src/core/Simulation.js` (`Snapshot` now copies `spinAxis`/`spinRate` — no
change needed to `relativeBodies()`, its `{ ...b, ... }` spread already carries them
through), `src/viewport/viewport.js` (closed-form quaternion spin applied to each body's
mesh per render frame, zero changes to `_packState`/`_derivatives`/RK4), `src/plots/
metrics.js` (`psi`/`psidot` derived metrics + `spinAngle`/`spinRateOf` helper functions),
`src/viewport/objectPanel.js` (stretch goal DONE: `ψ̇=` editable input per body card, same
pattern as mass/speed/x/y/z, wired into the reset button too).

**Verified:** `yarn test` 26/26, `yarn build` clean. Live `yarn dev` visual check not done —
every browser MCP locked by concurrent sessions again — but verified numerically instead via
`vite-node` scratch scripts: (1) `Body` defaults spin correctly, `Simulation.snapshot()`
copies `spinAxis`/`spinRate`, and `relativeBodies()` carries them through unmodified; (2) the
`psi`/`psidot` metrics compute exactly the expected closed-form values (`spinRate=2, t=5` →
`ψ = 10 mod 2π = 3.7168...`, `ψ̇ = 2`). **Known limitation, called out per the acceptance
check's explicit ask**: none of the current presets set a nonzero `spinRate` (default `0`),
so out of the box nothing visibly spins — a user has to dial in `ψ̇=` via the new object-panel
input to see it, AND even then the plain untextured `MeshStandardMaterial` sphere may not
show visible rotation without a marker/texture (not verified live — flagging honestly rather
than claiming "confirmed working").

---


## Task 23: Gravitational Potential — cylindrical draw-radius fade [done: merged into feat/simulator-mvp as 1de3c5a]

**Verified:** commit `1de3c5a`. Files touched: `displaySettings.js` (+`potentialFieldRadius`),
`potentialFieldOverlay.js` (dropped `GRID_EXTENT`, mesh rebuilds on radius change — not just
resolution, needed since `PlaneGeometry` bakes in extent at construction; itemSize-4 vertex
color for alpha fade), `equipotentialLinesOverlay.js` (same `GRID_EXTENT` removal,
per-vertex-color lines instead of one flat color per level), `gravitationalPotentialPanel.js`
(4th "Draw radius" slider). Confirmed the physics-sum constraint (rule #8) needed zero
changes — `PotentialFieldCalculator.potentialAt()` already sums all bodies unconditionally,
fade is render-only. `yarn test` 26/26, `yarn build` clean. Not verified live in `yarn dev`.

**Goal:** per WORK_ITEMS.md — potential mesh/surface and equipotential lines should fade
(opacity, not hard clip) as cylindrical radius (`hypot(x,y)`, no z term — "cylinder" not
sphere) approaches the draw radius. Design fully scoped by research pass; implement exactly:

**1. New setting** — `src/app/displaySettings.js`: add `potentialFieldRadius = 20` next to
`potentialFieldZ`. This replaces the currently-hardcoded `GRID_EXTENT = 20` duplicated in both
`potentialFieldOverlay.js` (line ~7) and `equipotentialLinesOverlay.js` (line ~8) — delete
that constant from both files, pass `extent: displaySettings.potentialFieldRadius` into both
`calculator.compute()` calls instead.

**2. Fade formula** (local const in each overlay file, not a setting) — smoothstep starting
at 60% of the radius, not a hard cutoff:
```js
const FADE_START_FRACTION = 0.6;
function radialFade(x, y, r) {
  const d = Math.hypot(x, y); // cylindrical — no z term
  const t = THREE.MathUtils.clamp((d - FADE_START_FRACTION * r) / (r - FADE_START_FRACTION * r), 0, 1);
  return 1 - THREE.MathUtils.smoothstep(t, 0, 1);
}
```

**3. Vertex alpha** — three.js (confirmed 0.160.1, vertex-alpha supported natively on
`MeshBasicMaterial`/`LineBasicMaterial` via a 4-component color `BufferAttribute`, no custom
shader):
- `potentialFieldOverlay.js`: widen the `colors` BufferAttribute from itemSize 3 (RGB) to
  itemSize 4 (RGBA), write `radialFade(x, y, potentialFieldRadius)` as the 4th component per
  vertex in the existing per-point loop. Set `material.transparent = true` (mesh material
  already has `vertexColors: true` — confirm it also respects the alpha channel, it does per
  three's `USE_COLOR_ALPHA` define).
- `equipotentialLinesOverlay.js`: currently one flat `LineBasicMaterial.color` per contour
  level, no vertex colors — switch each line's material to `vertexColors: true, transparent:
  true`, add a `color` BufferAttribute (itemSize 4) per line geometry alongside `position`,
  write the level's lerped RGB + per-endpoint `radialFade(...)` alpha for every segment
  endpoint in the existing position-writing loop.

**4. UI** — `src/viewport/gravitationalPotentialPanel.js`: add a 4th slider "Draw radius"
bound to `potentialFieldRadius`, range `min=5 max=60 step=1`, next to the existing Resolution
slider; add it to the panel's `onChange` sync block too.

**Do NOT** touch the mesh/surface toggle (separate unbuilt feature) or attempt a Z-height
clip (that's the future "outer draw box," a different concept — this task is radius-only
fade).

**Acceptance check:** `yarn test` passes, `yarn build` succeeds. `yarn dev`, toggle grav
potential + equipotential lines on, drag the new Draw radius slider, confirm both visibly
fade toward transparent near the radius edge rather than hard-cutting off, and the fade
starts inside the boundary (no visible sharp ring).

---

## Task 27: CONSTANTS magnitude-modifier for unit length/mass [worktree ready: task-27-constants-modifier — merged into main tree]
  - claimed by planet-plot-f2

**Merged.** `src/core/constants.js`: `UNIT_MASS_KG`/`UNIT_LENGTH_M`/`UNIT_TIME_SEC`/
`UNIT_TIME_DAYS` converted to `getUnitMassKg()`/`getUnitLengthM()`/`getUnitTimeSec()`/
`getUnitTimeDays()`, reading `config.unitMassSolar`/`config.unitLengthAu` fresh each call;
`simTimeToDays`/`simTimeToYears`/`simMassToSolar` updated to call the getters.
`src/viewport/objectPanel.js`: the `unitMassSolar`/`unitLengthAu` Constants rows now show a
static reference span (the real-world value they scale) alongside the existing editable
modifier input; other 6 constants unchanged. "(research needed)" flag from the task doc was
resolved, not left open — grepped, confirmed no separate "unit G" field exists, proceeded on
the unit-length reading.

**Verified:** `yarn test` 26/26, `yarn build` clean (re-verified again after merging into main
tree, not just in the worktree). Live-effect numerically verified via a scratch script
(`simTimeToDays(1)` goes from 58.125 to 164.40 days when `unitLengthAu` is set to 2, matching
expected `UNIT_LENGTH_M³` scaling) — not yet re-checked in the actual browser UI.

**Goal:** resolve WORK_ITEMS.md's "CONSTANTS" feature request. User's spec, mapped onto this
codebase's actual fields: `constants.json` already has `UNIT_MASS_SOLAR`/`UNIT_LENGTH_AU`
("Unit mass"/"Unit length" in the Constants section) sitting at value `1` each — **but they're
dead**. `constants.js` derives `UNIT_MASS_KG = SOLAR_MASS_KG` and `UNIT_LENGTH_M = AU_M`
directly, never multiplying by `config.unitMassSolar`/`config.unitLengthAu`. These two fields
ARE the "modifier" the user is asking for (default 1, becomes a magnitude adjustment — e.g.
modifier=5 on unit length means "1 simulation length unit = 5 AU", not 1). This is a narrower,
better-scoped version of the ask than it first reads — only these 2 of the 8 constants get the
new modifier UI treatment; the other 6 (`gReal`, `solarMassKg`, `auM`, `secondsPerDay`,
`daysPerYear`, `softening`) keep their current direct-edit behavior (Task 13), unchanged.

**(research needed) — confirm before building:** "Unitized-G" in the original ask doesn't map
to any existing field (G is implicitly 1 in the integrator; there's no separate "unit G"
constant) — proceeding on the assumption it was a slip for "unitized-AU"/unit length, since the
very next sentence says "so I think AU = 1 in your calculations." If that's wrong, stop and
ask rather than guessing further.

**1. `src/core/constants.js` — make the modifier live:**
- `UNIT_MASS_KG`/`UNIT_LENGTH_M` are consts today, frozen at module load — they need to read
  `config.unitMassSolar`/`config.unitLengthAu` FRESH on every use (same "read live, don't
  cache" principle as Task 12's `Simulation.js` softening fix), since editing the modifier in
  the UI should take effect immediately without a page reload.
- Concretely: convert `UNIT_MASS_KG`, `UNIT_LENGTH_M`, `UNIT_TIME_SEC`, `UNIT_TIME_DAYS` from
  exported consts to exported functions (`getUnitMassKg()`, `getUnitLengthM()`, etc.) — or
  getters on a small object — that recompute from `config.*` each call.
  `UNIT_MASS_KG = SOLAR_MASS_KG * config.unitMassSolar`, `UNIT_LENGTH_M = AU_M *
  config.unitLengthAu`, `UNIT_TIME_SEC`/`UNIT_TIME_DAYS` derive from those exactly as today,
  just recomputed each call instead of once at import.
- Downstream usage is narrow — checked via grep, only 3 call sites: `simTimeToDays`,
  `simTimeToYears`, `simMassToSolar` (all in this same file) need to call the new
  functions/getters instead of the old frozen consts. `main.js` imports
  `simTimeToDays`/`simTimeToYears` (unchanged call signature, so `main.js` itself needs no
  edit) — confirm this with a grep before assuming, don't just trust this note.
- Do NOT touch `Simulation.js`'s `G`/`SOFTENING` handling (Task 12, already correct/live) —
  out of scope here.

**2. `src/viewport/objectPanel.js` — split the Constants section's rendering for these 2 rows
only:**
- Read the current `for (const { key, label, value, unit } of config.list)` loop (search
  `op-constant-row`) — it renders one editable `<input>` per constant, identical for all 8.
- For `key === 'unitMassSolar'` and `key === 'unitLengthAu'` specifically, render a DIFFERENT
  row shape: the input is the MODIFIER (defaults to `1`, `step="any"`, writes to
  `config.unitMassSolar`/`config.unitLengthAu` on change — same live-write pattern as every
  other input in this file), plus a static (non-editable) text span to the right showing the
  underlying real-world reference value + unit it's scaling — `${config.solarMassKg} ${config.units.solarMassKg}`
  for the mass one, `${config.auM} ${config.units.auM}` for the length one (i.e. `Config.list`'s
  `auM`/`solarMassKg` entries, read but not rendered as their own editable row redundantly —
  keep those 2 base entries in the loop as-is, additive, don't remove them).
- All 6 other rows keep their current single-input shape, unchanged.
- Add a one-line comment (not a doc block) explaining WHY these 2 rows differ, since a future
  reader will otherwise wonder why 2 of 8 rows have an extra span.

**Acceptance check:** `yarn test` passes, `yarn build` succeeds. `yarn dev`: default state is
unchanged (both modifiers = 1, so `UNIT_LENGTH_M`/`UNIT_MASS_KG` compute identically to before
this task). Set "Unit length" modifier to `2`, confirm `main.js`'s days/years elapsed-time
readout changes immediately (roughly doubles for the same sim-time, since 1 sim length unit
now represents 2 AU) — this is the live-effect proof, not just that the input accepts a value.

**Do NOT** add the modifier treatment to any of the other 6 constants — this task is scoped to
exactly `unitMassSolar`/`unitLengthAu`.

---

## task-wi-25-shell-discretization [DONE: merged into feat/simulator-mvp as 2c72533]

Merged by team-lead after rebasing task-25-shell-discretization onto the current base
branch tip (60ee538) and reconciling with Task 23's already-merged draw-radius fade —
`potentialFieldRadius` retired in favor of the shared `drawRadius`; the radial-fade formula
was ported into the new triangle-list mesh with a 4-component (RGBA) vertex-color
attribute. `yarn test` 26/26, `yarn build` clean, post-rebase and post-merge. Full task doc
archived at `WORK_QUEUE_TASKS/archive/task-wi-25-shell-discretization.md`.

## task-wi-29-shared-coord-system [DONE: merged into feat/simulator-mvp as c4c16e7]

Rebased onto current tip (was based on a stale ref), verified diff matched the branch's own
report exactly (displaySettings.js/plotPanel.js/objectPanel.js only), fast-forward merged by
team-lead. `yarn test` 26/26, `yarn build` clean, re-verified in the shared checkout
post-merge. Full task doc archived at
`WORK_QUEUE_TASKS/archive/task-wi-29-shared-coord-system.md`.

## task-wi-26-svg-fieldline-arrows [DONE: merged into feat/simulator-mvp as aed6413]

New `fieldLineArrowStyle` display setting (`'cone'`/`'svg-barb'`), additive — SVG chevron
barb rasterized once onto a CanvasTexture, rendered as camera-facing billboard quads along
each streamline (reuses BillboardArrowOverlay's camera-basis quaternion construction).
`yarn test` 32/32, `yarn build` clean, verified in the shared checkout post-merge. Live
`yarn dev` visual check not done. Full task doc archived at
`WORK_QUEUE_TASKS/archive/task-wi-26-svg-fieldline-arrows.md`.

## task-wi-34-svg-arrow-icon [DONE: merged into feat/simulator-mvp as 8dc71c0]

3rd `ARROW_STYLES` entry (`svg`) in `arrowStyles.js` — self-authored inline SVG (rounded shaft
+ chevron head, no external source/licensing concern), rasterized once via `Image` +
`data:image/svg+xml` decode + `drawImage`, falls back to the existing chevron shape on any
call before the async decode resolves. Added to the `arrowStyle` dropdown's choices. `yarn
test` 32/32, `yarn build` clean, verified in the shared checkout post-merge. Full task doc
archived at `WORK_QUEUE_TASKS/archive/task-wi-34-svg-arrow-icon.md`.

## task-wi-28-provider-di-viewcontroller [DONE: research complete, merged into feat/simulator-mvp as cd8460b — no source changes, follow-up implementation queued as task-wi-35]

Real recommendation filled in (the original archived research entry was a placeholder never
actually answered): (1) one `<ApiName>Provider.js` singleton class per @api interface in a new
`src/provider/`, imported directly by consumers (matches this codebase's existing
store/displaySettings/ACTIVE_CORRECTION singleton-import convention — not threaded through
mount function params); (2) no `ViewController` class — `mountViewport` already matches its 5
sibling `mountX(el, store)` panels' shape, the actual gap is direct `@adapters` imports, fixed
by (1); (3) new `@api/ForceLaw.js` interface + `@core/NewtonianForceLaw.js` default impl
(lives in `@core` not `@adapters`, same precedent as `FieldCalculator`'s concrete
implementations — pure physics math, no framework dependency), `Simulation` takes an optional
`forceLaw` opt same pattern as its existing `logger` opt. `yarn test` 32/32, `yarn build`
clean. Full doc archived at `WORK_QUEUE_TASKS/archive/task-wi-28-provider-di-viewcontroller.md`.

## task-wi-35-provider-forcelaw-implementation [DONE: merged into feat/simulator-mvp as 96add6b]

Implemented task-wi-28's full recommendation: `src/provider/` (5 singleton provider classes),
`viewport.js`/`main.js` wired through `overlayRendererProvider`/`loggerProvider` (no
ViewController class, per task-wi-28), new `@api/ForceLaw.js` + `@core/NewtonianForceLaw.js`
(extracted `Simulation._derivatives()` verbatim — still sums over ALL bodies unconditionally,
no distance cutoff), `Simulation` takes an optional `forceLaw` ctor opt mirroring its existing
`logger` opt. `yarn test` 32/32 — run before AND after the Simulation.js edit, numerically
identical, confirming the refactor changed no physics. `yarn build` clean. Live `yarn dev`
check not done (headless worktree, no browser). One conflict during merge (WORK_QUEUE.md,
task-wi-35's own status line) — checked the ENTIRE file for markers this time, not just the
expected line, per the earlier incident. Full task doc archived at
`WORK_QUEUE_TASKS/archive/task-wi-35-provider-forcelaw-implementation.md`.
