## Task 25: Shared adaptive spherical-shell discretization

**Verified:** `yarn test` 26/26, `yarn build` clean, in the
`task-25-shell-discretization` worktree. Not exercised live in `yarn dev` —
sanity-checked instead via `vite-node` scratch scripts: confirmed
`shellRingSizes` exactly matches `computeShellGrid`'s per-shell point counts
(both gave 20 for `radiusIterations=4, thetaIterations=8, skew=1.5`, ring
sizes `[8,4,4,4]`), and that `skew=1.5` vs `skew=0` visibly changes total
sampled point count (96 vs 192 for the same iteration settings, confirming
higher skew concentrates density toward the center as intended).

**Files touched:** new `src/core/overlays/DiscretizationGrid.js`
(`computeShellGrid` per the spec, verbatim; `shellRingSizes`, a small helper
so consumers can re-derive shell/ring structure from the flat `points` array
`computeShellGrid` returns; `decimateToLimit`, the `iconCount` hard
render-count ceiling). `ForceFieldCalculator.js`/`FieldLinesCalculator.js`
now sample/seed via `computeShellGrid` (non-planar) centered on the bodies'
center of mass, decimated to `iconCount` before evaluating
`accelerationAt`/tracing. `PotentialFieldCalculator.js` samples via
`computeShellGrid` (planar) centered at `[com.x, com.y, potentialFieldZ]` —
deliberately does NOT apply `iconCount` decimation, since
`EquipotentialLinesCalculator`/the surface mesh both need its full,
structurally-predictable ring layout. `accelerationAt`/`potentialAt` in
every calculator still sum over every body in `bodies` unconditionally —
`drawRadius` only bounds where sample points are placed, never which bodies
contribute to the force/potential sum (gravity has infinite range, per rule
8 in `WORK_ITEMS_RULES.md`).

**Equipotential-lines adjacency (the flagged risk):** the old marching-squares
code assumed a flat rectangular `points[i*resolution+j]` grid from
`PotentialFieldCalculator`, which no longer holds now that sampling moved to
shells of rings. Went with the simpler first-pass fallback the task doc
explicitly sanctioned rather than a full redesign: within a shell, cells span
angularly-adjacent ring points; between two adjacent shells, each inner-ring
point is matched to the point at the *proportionally* nearest theta index on
the outer ring (ring sizes can differ across shells when `skew != 0`, so this
is an approximate angle-match, not an exact geometric nearest-neighbor).
Known limitations, called out in the class doc comment: no contour fill
inside the innermost shell or outside the outermost, and the proportional
theta-match is only approximate when adjacent shells have different ring
point counts. `PotentialFieldOverlay`'s surface mesh hit the identical
rectangular-grid assumption (its old code fed a `PlaneGeometry` built with
fixed row/col segments) — not explicitly flagged in the task doc, but the
same underlying break, so it got the same treatment: rebuilt as a
non-indexed triangle-list `BufferGeometry` triangulated between adjacent
shells using the identical ring-adjacency scheme, with the same "small
unfilled hole at the very center" limitation noted in its doc comment.

**UI:** new `src/viewport/discretizationPanel.js` (bottom-left, mirrors
`gravitationalPotentialPanel.js`'s self-contained mount pattern), one slider
per shared setting (`drawRadius`, `radiusIterations`, `thetaIterations`,
`phiIterations`, `magnitudeModSkewAll`, `iconCount`,
`magnitudeModForceField`, `magnitudeModPotential`,
`magnitudeModEquipotentialLines`), mounted in `viewport.js` alongside the
other two panels. `displaySettings.js`/`displayOptions.js`: removed
`forceFieldRadius`/`forceFieldCount`/`potentialFieldResolution`/
`fieldLinesRadius`/`fieldLinesCount` and their control entries, per the
task's explicit replacement list; `potentialFieldScale`/`potentialFieldZ`/
`equipotentialLineCount`/`forceFieldScale`/`fieldLinesScale` left untouched
(orthogonal). The 3 `magnitudeMod*` per-overlay-type settings are applied as
an extra multiplier on top of each overlay's existing scale/opacity handling
(rendered-magnitude axis, separate from sampling density).

**Process note:** based the worktree off `feat/simulator-mvp` as instructed,
but mid-task the shared checkout's uncommitted work (all the overlay/adapter
infrastructure this task builds on) got checkpointed into that branch as a
new commit (`fe73099`) — had to fast-forward the work branch onto that
before any of `src/core/overlays`/`src/adapters/overlays` existed to build
on. Branch is `task-25-shell-discretization`, commit `0cfcca4`.

---

**Research verdict (resolved, implement exactly):** power-law radial spacing and `1/r^v`
density skew are the SAME idea (shell volume ~r²dr ⇒ `r_i = R*(i/N)^p` with `p=1/(3-skew)`,
special-cased to `p=1` at `skew=0` for guaranteed uniformity). AMR/octree is overkill —
skip it, this is a fixed precomputed visualization grid, not a physics solver. E&M
flux-proportional seeding maps onto `FieldLinesCalculator` by reusing the same shell
schedule for seed placement (more seeds on inner shells) instead of a separate scheme.
`MAGNITUDE_MOD_SKEW_ALL` is the ONE density knob; `MAGNITUDE_MOD_G*` stay separate
(rendered magnitude/opacity, orthogonal axis).

**1. New shared file `src/core/overlays/DiscretizationGrid.js`** — one real shared function
(deliberately NOT following the "duplicate tiny helpers" convention from Task 8's
`accelerationAt` note; this is substantial shared feature logic, not a 15-line helper):
```js
export function computeShellGrid(center, { drawRadius, radiusIterations, thetaIterations, phiIterations, skew, planar = false }) {
  const points = [];
  for (let s = 1; s <= radiusIterations; s++) {
    const p = skew === 0 ? 1 : 1 / ((planar ? 2 : 3) - skew);
    const r = drawRadius * Math.pow(s / radiusIterations, p);
    const r1 = drawRadius * Math.pow(1 / radiusIterations, p);
    const falloff = skew === 0 ? 1 : Math.pow(r1 / r, skew);
    const thetaCount = Math.max(4, Math.round((skew === 0 ? thetaIterations : thetaIterations * falloff)));
    const phiCount = planar ? 1 : Math.max(4, Math.round((skew === 0 ? phiIterations : phiIterations * falloff)));
    for (let ti = 0; ti < thetaCount; ti++) {
      const theta = (ti / thetaCount) * 2 * Math.PI;
      if (planar) {
        points.push({ position: [center[0] + r * Math.cos(theta), center[1] + r * Math.sin(theta), center[2]], r });
        continue;
      }
      for (let pi = 0; pi < phiCount; pi++) {
        const phi = -Math.PI / 2 + (pi / (phiCount - 1)) * Math.PI; // -pi/2..pi/2, poles included
        const x = r * Math.cos(phi) * Math.cos(theta);
        const y = r * Math.cos(phi) * Math.sin(theta);
        const z = r * Math.sin(phi);
        points.push({ position: [center[0] + x, center[1] + y, center[2] + z], r });
      }
    }
  }
  return points; // { position:[x,y,z], r }[]
}
```
`planar` mode (theta-ring only, no phi loop, fixed z via `center[2]`) is what
`PotentialFieldCalculator`/`EquipotentialLinesCalculator` use (they already sample a single
z-plane, not a full sphere); `ForceFieldCalculator`/`FieldLinesCalculator` use the full 3D
(`planar: false`) mode.

**2. Wire into all 4 calculators**, replacing each one's own grid-building loop:
- `ForceFieldCalculator.compute(bodies, opts)`: call `computeShellGrid(centerOfMass(bodies), {..., planar: false})`, evaluate `accelerationAt` at each returned position.
- `PotentialFieldCalculator.compute(bodies, opts)`: same call with `planar: true`, `center = [com.x, com.y, potentialFieldZ]`, evaluate `potentialAt` per point.
- `EquipotentialLinesCalculator`: unchanged marching-squares logic, but now consumes `PotentialFieldCalculator`'s new shell-sampled (non-rectangular-grid) output — **note this breaks the existing `points[i*resolution+j]` rectangular-index assumption in the marching-squares code; the implementer must re-derive cell adjacency from the shell/ring structure (adjacent theta index within a shell, and nearest ring in the adjacent shell) instead of a flat 2D array index.** Flag back to team-lead if this turns out bigger than expected rather than guessing at a redesign.
- `FieldLinesCalculator.compute(bodies, opts)`: use `computeShellGrid(centerOfMass(bodies), {..., planar: false})` for SEED placement (replacing the flat Fibonacci-sphere seeding), one seed per returned point; streamline integration/termination logic unchanged.

**3. Settings** — `src/app/displaySettings.js`: add shared `drawRadius` (20), `radiusIterations` (12), `thetaIterations` (24), `phiIterations` (12), `magnitudeModSkewAll` (1.5), `iconCount` (4096, hard render-count ceiling — stride-decimate returned points if count exceeds it before instancing/rendering), `magnitudeModForceField`/`magnitudeModPotential`/`magnitudeModEquipotentialLines` (1.0 each — multiply the final rendered magnitude/opacity per type, orthogonal to sampling density). These REPLACE `forceFieldRadius`/`forceFieldCount`/`potentialFieldResolution`/`fieldLinesRadius`/`fieldLinesCount` (delete those fields and their call sites) — leave `potentialFieldZ`/`potentialFieldRadius`(Task 23's fade radius — reuse as `drawRadius` if Task 23 landed first, don't create a duplicate)/`equipotentialLineCount`/`forceFieldScale`/`fieldLinesScale` untouched, they're orthogonal.

**4. UI** — new file `src/viewport/discretizationPanel.js`, `mountDiscretizationPanel(container)`, same self-contained-module pattern as `gravitationalPotentialPanel.js` (copy its structure). One shared box, `position: absolute; bottom: 10px; left: 10px`, sliders for all settings in point 3. Mount alongside the other panels in `viewport.js`.

**Acceptance check:** `yarn test` passes, `yarn build` succeeds. `yarn dev`, confirm all 4
overlays still render, dragging `magnitudeModSkewAll` up visibly concentrates points/samples
near the CoM, `skew=0` looks uniform.

---
