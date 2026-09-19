# Work Items — Finished

Moved out of WORK_ITEMS.md once done, so that file stays focused on what's open.

## Completed checklist items (moved from WORK_ITEMS.md's plain `[x]` list)

- Potential-field scale range extended to -1..3 (was -0.5..1.5).
- Lagrange points toggle ("Lagrange points (L1–L5)" in Display ▾) — covers the 5-marker
  visualization; a distinct effective-potential/Jacobi FIELD is still open (WORK_ITEMS.md).
- Force-field "Field density" slider, and potential-field "Potential resolution" slider
  (4-60 samples/side, geometry rebuilds live on change).
- Constants moved into `src/core/constants.json` (`{value, unit}` per entry) + `Config`
  object (`src/core/Config.js`, named fields) + displayed read-only in the object panel's
  "Constants" section.
- Static "Equations" section in the object panel (9 canonical formulas — Kepler's laws,
  vis-viva, Newton's gravity, KE/PE, Hamiltonian, Lagrangian).
- Per-body live "Calc" grid in the object panel: V, K, U, r, θ, φ, ṟ, θ̇, φ̇ — sourced from
  `metrics.js`'s existing registry, relative to center of mass, updated every frame.
- All 3 toggle-list overlays done: Lagrange points, gravitational potential field,
  gravitational force vector field.
- Display toggles default to expanded (no dropdown click needed).
- **Logger**: `@api/logger/Logger.js` (debug/info/warn/error interface) + 3 adapters
  (`ConsoleLogger`, `LoglevelLogger` wrapping the installed `loglevel` package,
  `CsvFileLogger`) + `MultiLogger` fan-out, wired in `main.js`. `CsvFileLogger` writes every
  tick's full model data (every coordinate system's axes + every derived metric, always
  CoM-relative) to `log/<session-timestamp>-data-output.csv` via a dev-only Vite endpoint
  (`vite.config.js`) — browser JS has no filesystem access, so this is the only path to
  disk. Known limitation: no log rotation, files grow fast (~1.7MB/session).
- **Energy-break auto-pause**: `|E_current| < ENERGY_BREAK_RATIO(0.5) * |E_baseline|` →
  `sim.running = false` + a one-time error notification (`store.js`'s `_checkEnergyBreak`).
  Visible "⏸ Paused — energy check" badge in the header; Play/Pause button now stays synced
  even on a programmatic pause (previously only updated on click — a real bug, fixed as
  part of this).
- "How are Lagrange points calculated" — explained, see WI-7a below.
- **Ratchet-poisoning bug, fixed in both force field and potential field**: a sample landing
  close to a body (force/potential blows up near r=0) permanently poisoned the grow-only
  max-magnitude ratchet, collapsing the whole field toward invisible the moment density
  changed. Fixed by excluding near-body samples from the ratchet and capping displayed
  magnitude separately in both `forceFieldOverlay.js` and `potentialFieldOverlay.js`.
- **Force field is now a real 3D grid, GPU-instanced, ~100x denser**: `ForceFieldCalculator`
  samples a cubic grid (was a flat z=0 plane); `ForceFieldOverlay` switched from individual
  `THREE.ArrowHelper` objects (one Object3D each, didn't scale) to a single
  `THREE.InstancedMesh` (one draw call). Default density 34/side (≈39,300 points), capped at
  50/side (125,000) as a safety ceiling. Superseded almost immediately after building — see
  WORK_ITEMS.md's open "force field should render as 2D arrows that project onto the 3D
  view" item; the cone-glyph look wasn't what was wanted, a billboard/quiver-plot style is.
- **`polarRate` divide-by-zero-adjacent bug, fixed**: blew up to an arbitrary huge (not
  infinite, but nonsensical) number at the exact coordinate origin (r≈0 AND rho≈0 together)
  — a true coordinate singularity (θ has no defined rate there), not real physics. Exposed
  by the new per-body Calc grid since the default preset places a body exactly at the origin
  at t=0. Fixed with a `POLE_EPSILON` guard (much larger than the existing tiny `EPSILON`,
  which only guards literal division by exact 0) returning `NaN` at the true pole — displays
  as "—" via the existing `Number.isFinite` formatting.

- **WI-1 — Constants → JSON config.** Constants moved to `src/core/constants.json`
  (`{value, unit}` per entry), loaded through `Config` (`src/core/Config.js`) with **named
  fields** (`config.gReal`, `config.softening`, etc. — no string-keyed dictionary access).
  `constants.js` derives its exports from these fields. Edit the JSON file directly to
  change a constant.
- **WI-3 (display half) — Config shown in the UI.** Read-only "Constants" section in the
  object panel (`src/viewport/objectPanel.js`), sourced from `Config.list` (value + unit per
  row). *Editable-in-UI is still open* — see WORK_ITEMS.md, since `SOFTENING`/`G_REAL` etc.
  are read once at import time today, not live.
- **WI-7a — Lagrange points overlay.** Calculator: `src/core/overlays/lagrangePoints.js`
  (pure, plain-data — no three.js). Picks the two most massive bodies; L1/L2/L3 via the
  standard small-μ collinear approximation, L4/L5 exact (equilateral triangle with the
  primaries, using the relative-velocity cross product for the orbital-plane normal).
  Adapter: `src/viewport/lagrangePointsOverlay.js` (three.js octahedron markers). Toggle:
  "Lagrange points (L1–L5)" checkbox in the Display ▾ popover — gates compute AND render.
  Caveat (see tooltip): exact only for a circular restricted 3-body orbit; otherwise an
  instantaneous approximation recomputed every frame from current positions/velocities.
- **WI-7b — Force vector field overlay.** Calculator: `src/core/overlays/forceField.js`
  (pure — reuses the exact force law + `SOFTENING` from `Simulation._derivatives`, sampled
  on a grid in the z=0 plane instead of at body positions). Adapter:
  `src/viewport/forceFieldOverlay.js` (100 `THREE.ArrowHelper`s on a 10x10 grid, matching
  the viewport's `GridHelper(40,40)` extent). Toggle + a "Field scale" slider (-0.5..1.5x,
  `displaySettings.forceFieldScale`) in the Display ▾ popover. Note: scale ≤0 currently just
  shrinks arrows to invisible (no direction flip) — flagged as a style choice, not fixed
  behavior, in case you want negative scale to mean something else later.
- **WI-2 boundary-condition unit tests.** Installed `vitest` (approved). Extracted the pure
  branch-cut/ring-plan logic out of `PlotInstance` (which can't be unit tested directly —
  its constructor builds a real Three.js/WebGL view) into
  `src/plots/breakDetection.js` (`computeCircularPlan`, `isLargeStep`, `isBranchCutJump`),
  same behavior, now called from `plotPanel.js`. Fully implemented + passing:
  `test/plots/plotPanel.circularPlan.test.js` (10 tests). Skeleton-only (`it.todo`, per your
  ask) for the metric-level boundary checks pending the physics judgment calls:
  `test/plots/metrics.speed-ke-phi.test.js`, `test/plots/metrics.r-theta-phi.test.js`.
  Run with `yarn test`. Research finding worth keeping: the screenshot's cusps are very
  likely NOT a bug — KE = 0.5·m·v² is monotonic in v, so a turning point in speed produces
  the identical cusp in KE; that's expected geometry from pairing two near-redundant
  metrics, not a discontinuity in the calculator.
- **Force field: added density control.** `displaySettings.forceFieldDensity` (2-20, default
  10) + a "Field density" slider alongside "Field scale" — `forceFieldOverlay.js` now pools
  arrows up to a 20x20 max and shows/hides a prefix per-frame instead of a fixed 10x10 grid.
- **WI-5 — Equations reference list.** Static "Equations" section in the object panel
  (`src/viewport/objectPanel.js`, below Constants), 9 canonical formulas (Kepler's 3 laws,
  vis-viva, Newton's gravity, KE/PE, Hamiltonian, Lagrangian) — plain text, not computed.
  Built by `haiku-worker-1` per `WORK_QUEUE.md` Task 1, verified.
- **WI-7c — Gravitational potential field overlay.** Calculator: `src/core/overlays/potentialField.js`
  (pure — same `G`/`SOFTENING`, scalar U sampled on a grid at an adjustable z). Adapter:
  `src/viewport/potentialFieldOverlay.js` (displaced + vertex-colored `PlaneGeometry`, unlit
  `MeshBasicMaterial`, grow-only magnitude ratchet). Toggle + two sliders (z-offset,
  displacement scale) in the Display ▾ popover. Built by `haiku-worker-2` per `WORK_QUEUE.md`
  Task 2; team lead fixed one gap after verification (z-slider wasn't actually moving the
  mesh, only the sampled height — now `mesh.position.y` tracks `potentialFieldZ` too).
  **All three WI-7 overlays are now done.**
- **Project structure: `api/` + `adapters/` directories.** Pure calculators moved to
  `src/api/overlays/` (interfaces/ports); three.js rendering moved to
  `src/adapters/overlays/` and `src/adapters/plotCorrections/`, both parallel to `src/core/`.
  Wiring stays at composition points only: `viewport.js` mounts overlay adapters,
  `adapters/plotCorrections/index.js` picks `ACTIVE_CORRECTION`. No file branches on "which
  implementation" with an if/else ladder — each interface has one wiring point, core code
  only ever calls through the interface.
- **Force field density bug, fixed.** Reported: touching the density slider made arrows
  disappear. Root cause: the max-magnitude ratchet (`forceFieldOverlay.js`) was a global
  grow-only value across every sample ever taken; changing density resamples entirely
  different grid coordinates, so a single sample landing close to a body (force blows up
  near r=0, capped only by the tiny `SOFTENING`) permanently poisoned the ratchet and
  collapsed every other arrow toward zero length. Fixed by excluding near-body samples
  (`RATCHET_EXCLUSION_RADIUS`) from the ratchet, and capping displayed magnitude
  (`MAX_NORMALIZED_MAGNITUDE`) so a genuinely close sample renders long, not infinite.
- **Per-body live calc readout (WI-4, first pass).** Object panel's body cards now show a
  live 3x3 grid — V, K, U, r, θ, φ, ṟ, θ̇, φ̇ — updated every frame from
  `snapshot.relativeBodies(store.origin)` via `metrics.js`'s existing registry. ψ/ψ̇ (needs
  rotational bodies) and dA/dt (not yet a registered metric) intentionally left out of this
  pass — see WORK_ITEMS.md for the split-out follow-ups.
- **Plot-correction strategy made swappable + Noop set active.** `PlotInstance` now depends
  on a `PlotCorrectionStrategy` interface (`computePlan`/`buildPoint`/`isBreak`) instead of
  hardcoding the ring-embedding logic. `circularEmbeddingCorrection` (the original behavior)
  kept as a full "previously tried" implementation; `noopPlotCorrection` (no ring embedding,
  no break-skipping, raw straight lines) is active now so you can compare against the
  cusps directly. Swap back by changing one export in `adapters/plotCorrections/index.js`.
- **Potential field: resolution slider + scale range extended.** `potentialFieldResolution`
  (4-60, geometry rebuilds live) and scale range widened to -1..3 (was -0.5..1.5).
- **Force field: density slider.** Already listed above under the bug fix — the density
  control itself (`forceFieldDensity`, 2-20) was net-new, not just the fix.
- **WI-9 — Phase-space plots.** No code needed — already possible today.
  `plotPanel.js`'s X/Y/Z metric pickers let any metric go on any axis independently
  (`getMetricOptions`/`computeMetric` in `metrics.js`), including two rate metrics at once.
  To plot phase space: Add plot → pick a coordinate system → set X to a rate metric (e.g.
  "φ̇ (azimuthal rate)") and Y to its paired coordinate (e.g. "r (radial)").

## Round 2 (fanned out across 13 worker tasks + 2 research reports, multi-session)

- **v<coordinate> plotting.** `vx`/`vy`/`vz` (cartesian), `ρ̇` (cylindrical radial velocity),
  `dA/dt` (areal velocity) added to `metrics.js`'s `DERIVED_METRICS` — spherical ṟ/θ̇/φ̇
  already existed. All selectable in any plot's X/Y/Z dropdowns now.
- **Editable body position.** Object panel body cards have x=/y=/z= inputs, same
  live-write + reset pattern as mass/speed (`objectPanel.js`).
- **New preset**: "Two body (inclined elliptical)" (`two-body-inclined` in `presets.js`) —
  unequal masses, 0.8x circular speed for eccentricity, 20° inclination. A starting point,
  not the user's precise example yet.
- **Equipotential contour lines.** `EquipotentialLinesCalculator` (marching squares over
  `PotentialFieldCalculator`'s grid) + `EquipotentialLinesOverlay` (one `THREE.LineSegments`
  per level, colored by depth). Toggle + line-count slider (2-20) in Display ▾.
- **Field lines** (magnetic-field-line-style visualization, first pass). `FieldLinesCalculator`
  traces streamlines via Fibonacci-sphere seeding around each body + fixed-step integration
  along the local force direction; `FieldLinesOverlay` renders lines with cone arrow markers.
  Caveat: gravity is attractive, so lines flow INTO masses (terminate there) rather than
  forming closed loops like real magnetic field lines — visually similar, different physics.
- **@api-as-interfaces migration completed.** `src/api/` holds exactly 3 interface classes
  (`FieldCalculator`, `OverlayRenderer`, `PlotCorrectionStrategy`); every calculator lives in
  `src/core/overlays/*Calculator.js` (classes extending `FieldCalculator`); every
  viewport/plot adapter is a class extending `OverlayRenderer`/`PlotCorrectionStrategy`.
  Path aliases (`@api`/`@core`/`@adapters`/`@viewport`/`@app`/`@plots`) wired in
  `vite.config.js`.
- **`DisplayOption` interface for display controls.** `@api/DisplayOption.js`
  (`BooleanDisplayOption`/`RangeDisplayOption`), `@app/displayOptions.js` (declarative
  `DISPLAY_OPTIONS` list, ~13 entries), `displayControls.js` rewritten to a single loop
  switching on `instanceof` (with an explicit `throw` for an unhandled type) instead of ~12
  copy-pasted option blocks. Fanned out as a 2-worker seam (data model vs. view renderer);
  one integration conflict (a checkbox landed in the old style mid-refactor) caught and
  reconciled after both sides finished.
- **Constants editable in UI.** `Simulation.js` now reads `config.softening` live (not
  cached at import) in `_derivatives()`/`totalEnergy()`; `Config.list` changed from a frozen
  snapshot to a live getter (with a `.key` field per entry); the object panel's Constants
  section rows are editable number inputs writing straight to `config.*`, refreshed every
  frame with the same focus-guard pattern as the body position inputs.
- **dA/dt readout** added to the object panel's per-body Calc grid (metric already existed
  from the v<coordinate> work above).
- **Gravitoelectromagnetism (GEM) equations** added to the Equations list — answers "is
  there a Maxwell's-equations analog for gravity" (yes, a weak-field GR linearization; not
  what this sim's Newtonian integrator actually computes, reference material only).
- **TDD regression suite for known bugs.** Exported `radialVelocity`/`polarRate`/
  `azimuthalRate`/`vx`/`vy`/`vz`/`cylindricalRhoDot`/`arealVelocity` from `metrics.js`;
  filled in the `it.todo` skeletons in both `test/plots/metrics.*.test.js` files with real
  assertions covering the pole-singularity fix and branch-cut continuity (20 tests). One bug
  found and fixed in the tests themselves along the way: an assertion wrongly expected
  `sin(φA)≈sin(φB)` for two genuinely mirror-opposite points (opposite-sign y) — fixed to
  check Euclidean distance of the embedded ring positions instead, which is what "no
  discontinuity" actually means there.
- **Ratchet-poisoning bug, generalized fix.** Extracted the near-body-exclusion check
  (previously duplicated in `forceFieldOverlay.js` and `potentialFieldOverlay.js`, and found
  ALSO duplicated in `equipotentialLinesOverlay.js`) into a shared pure `excludeNearBody`
  function (`src/adapters/overlays/ratchet.js`), with its own unit tests (6 tests). All 3
  overlays now import the shared check instead of each having their own copy.
- **Multi-session coordination contract** added to `WORK_QUEUE.md` (claim/done tags per
  task, single-owner locking for WORK_ITEMS.md/WORK_ITEMS_FINISHED.md during consolidation,
  announce-before-touching for anything outside a claimed task) — this session ran alongside
  a second Claude session on the same repo/branch for this whole round.

## Round 3

- **iDisplayOption interface** — `@api/DisplayOption.js` (`BooleanDisplayOption`/
  `RangeDisplayOption`/`SelectDisplayOption`), `@app/displayOptions.js` (declarative
  `DISPLAY_OPTIONS` list), `displayControls.js` a single loop switching on `instanceof`
  with an explicit `throw` for an unhandled type.
- **Force-field "scale" fixed** — was a flat length multiplier; redefined as a
  magnitude-to-size mapping gamma (`displayedMag = normalizedMag ** (1/scale)`, capped
  both before and after the curve to avoid overflow at low scale). 1x = true magnitude,
  >1x boosts weak/far arrows to read stronger than raw 1/r² falloff. Range 0.2..3.
- **Gravitoelectromagnetism (GEM) equations** added to the Equations list — answers "is
  there a Maxwell's-equations analog for gravity" (yes; reference material only, this sim
  is pure Newtonian).
- **Field lines** (magnetic-field-line-style, first pass) — `FieldLinesCalculator` traces
  streamlines via Fibonacci-sphere seeding + fixed-step integration along the local force
  direction; `FieldLinesOverlay` renders lines with cone arrow markers. Gravity is
  attractive, so lines flow INTO masses rather than forming closed loops like real
  magnetic field lines.
- **Equipotential contour lines** — `EquipotentialLinesCalculator` (marching squares over
  `PotentialFieldCalculator`'s grid) + `EquipotentialLinesOverlay` (one `LineSegments` per
  level, colored by depth). Toggle + line-count slider.
- **Editable body x/y/z position** in the object panel, same live-write + reset pattern as
  mass/speed.
- **v<coordinate> plotting** — `vx`/`vy`/`vz`, `ρ̇` (cylindrical radial velocity), `dA/dt`
  (areal velocity) added to `metrics.js`; selectable in any plot's X/Y/Z dropdowns.
- **`CountBasedFieldSampler` seam** — `ForceFieldCalculator`/`FieldLinesCalculator` now take
  `{radius, count}` instead of `{extent, resolution}`; `forceFieldRadius`/`forceFieldCount`
  and `fieldLinesRadius`/`fieldLinesCount`/`fieldLinesScale` all live and wired through
  `ForceFieldOverlay`/`BillboardArrowOverlay`/`FieldLinesOverlay`. Built as a 2-session
  parallel seam (calculator side / renderer side), including a "wire the new settings into
  3 overlay call sites" follow-up once both landed.
- **New preset**: "Two body (inclined elliptical)" — eccentric orbit, secondary body's
  orbital plane tilted via z-position/velocity. A starting point, not a precise
  user-supplied example yet.
- **`BillboardArrowOverlay`** — 2D camera-facing arrow billboards for the force field, as
  an ADDITIONAL toggle alongside the original 3D cone `ForceFieldOverlay` (not a
  replacement) so both are comparable live. Real bug found and fixed along the way: the
  initial billboard orientation used `Quaternion.setFromUnitVectors(quadNormal,
  toCameraDir)`, which is under-constrained on roll and only happened to look right for
  the one degenerate case (instance exactly on the camera's view axis) both the author's
  and a reviewer's hand-checks tested — replaced with a basis built directly from the
  camera's actual right/up vectors (`Matrix4.makeBasis` + `setFromRotationMatrix`),
  verified correct for general camera/instance positions, later confirmed live in-browser.
- **Swappable arrow style library** (Task 16) — `ARROW_STYLES` registry (`chevron`/
  `skinny`), wired through `SelectDisplayOption`. "Skinny" style: thin shaft, swept-back
  fletched barbs, ~2:1 shaft:head length ratio.
- **Constants editable in UI** — `Simulation.js` reads `config.softening` live (no cached
  import-time const); `Config.list` changed from a frozen snapshot to a live getter (with
  a `.key` per entry); the object panel's Constants section rows are editable number
  inputs writing straight to `config.*`, refreshed every frame with the same focus-guard
  pattern as the body position inputs.
- **dA/dt readout** added to the object panel's per-body Calc grid.
- **Gravitational-potential slider ranges bumped 10x** (scale -1..3 → -10..30; resolution
  4..60 → 4..600) and **unified "Gravitational Potential" display panel** built: two
  independently-toggleable multi-select pills (grav-potential surface, equipotential
  lines — matching the existing NLIPS pill styling) plus 3 shared sliders (scale,
  resolution, number of lines) relocated out of the generic flat `DISPLAY_OPTIONS`
  popover into one dedicated panel, top-right of the viewport. The z-offset slider was
  initially left behind in the old popover during this move — caught and relocated into
  the new panel too.
- **Two duplicate worktrees reconciled** (`task-16-arrow-style`, `task-17-radius-count`) —
  another actor was independently running the same WORK_QUEUE.md tasks in git worktrees;
  verified both matched (or were superseded by) what was already merged, adopted one
  small improvement from each (a defensive fallback, a zero-size-geometry guard), then
  removed both worktrees/branches. Established a `merge-coordinator` subagent role for
  this going forward, plus fixed a real bug this surfaced: neither `vite.config.js`'s dev
  server watcher nor `vitest`'s test discovery excluded `.worktrees/`/`.claude/worktrees/`,
  so tests were being triple-counted and the dev server actually crashed after serving a
  request for a path inside a worktree. Added exclude patterns for both.
