## Task 31: Effective-potential (Jacobi) field visualization [claimed: planet-plot-f2]
  - claimed by planet-plot-f2
  - **DONE, merged into feat/simulator-mvp as `43aae73`** (fast-forward, no conflicts at
    merge time — one small mechanical rebase conflict in `gravitationalPotentialPanel.js`
    resolved earlier, against Task 25's retirement of `potentialFieldRadius`/
    `potentialFieldResolution`: dropped this branch's now-stale radius/resolution sliders,
    kept only the new Jacobi-scale slider).

**Note on why this is a full task now, not another research brief:** the earlier "Research:
Effective-potential (Jacobi) field for Lagrange points" entry above (tagged `[done: team-lead
— design doc only, not implemented]`) is also a placeholder — its body is the research
INSTRUCTIONS, not filled-in findings. However, the physics needed is well-established and
already stated in that entry, so this task specs the real implementation directly rather than
re-requesting another unfilled report.

**Goal:** a scalar-field overlay for the Jacobi/effective potential in the restricted 3-body
problem's rotating frame — `Φ_eff(x,y) = -G·m1/r1 - G·m2/r2 - ½ω²(x²+y²)`, where `r1`/`r2` are
distances to the two most massive bodies (the same "primary"/"secondary" selection
`LagrangePointsCalculator.js` already implements — reuse that selection logic, don't
reinvent it) and `ω` is their orbital angular rate. This is distinct from the existing
`PotentialFieldCalculator`'s raw gravitational U — the `-½ω²(x²+y²)` centrifugal term is what
makes L4/L5 into local maxima instead of saddle points.

**1. Compute ω** from the two primaries' current relative position + velocity: for a
2-body relative orbit, `ω = |r × v| / |r|²` where `r`/`v` are the secondary's position/velocity
relative to the primary (standard specific-angular-momentum-over-r² formula — this is exact
for a 2-body relative orbit, an approximation in the full N-body sim, same caveat
`LagrangePointsCalculator` already documents for its own L1-L5 computation).

**2. Calculator — new `src/core/overlays/JacobiPotentialCalculator.js`**, `class
JacobiPotentialCalculator extends FieldCalculator` (`@api/FieldCalculator.js`). Mirror
`PotentialFieldCalculator.js`'s grid-sampling structure exactly (same `G`/`SOFTENING` imports,
same planar z-fixed sampling), but: (a) select primary/secondary via the same logic
`LagrangePointsCalculator.js` uses, (b) compute `ω` per point #1 above (computed ONCE per
`compute()` call, not per grid point — it only depends on the two primaries' current state),
(c) evaluate `Φ_eff` at each grid point using ALL bodies for the `-Gm/r` terms (per the
coordination contract's rule 8 — gravity/potential sums are never radius-limited, only
sampling/rendering extent is) but the primaries specifically for identifying `r1`/`r2`, plus
the centrifugal term using the primaries' `ω` and each point's distance from their COM (not
world origin).

**3. Adapter — new `src/adapters/overlays/JacobiPotentialOverlay.js`**, `class
JacobiPotentialOverlay extends OverlayRenderer`. Recommended rendering: reuse
`PotentialFieldOverlay`'s displaced-mesh approach (same ratchet/exclusion pattern, same
`excludeNearBody`) rather than contour lines — the raw potential field already uses a
displaced mesh, and a Jacobi surface is the more visually informative of the two options here
since the L4/L5 "hilltop" shape is the whole point of this visualization (contour lines would
show it as an isolated closed loop, less immediately readable as "these are local maxima").

**4. Settings + UI** — `displaySettings.showJacobiPotential` (boolean, default false),
`jacobiPotentialScale` (mirrors `potentialFieldScale`). Add to `DISPLAY_OPTIONS` or the
dedicated Gravitational Potential panel (`gravitationalPotentialPanel.js`) — the latter is
more consistent, since this is another potential-surface variant, but flag your choice in the
report since that panel currently assumes exactly 2 sub-visualizations (surface + lines).

**Acceptance check:** `yarn test` passes, `yarn build` succeeds. `yarn dev`, toggle Jacobi
potential on, confirm L4/L5 (from the existing Lagrange-points overlay) sit at local maxima
("hilltops") on the new surface, and L1-L3 read as saddle points, not maxima — this is the
physical signature that distinguishes this from the plain gravitational potential.

**Do NOT** modify `PotentialFieldCalculator`/`PotentialFieldOverlay` — this is a new, parallel
calculator/overlay pair, not a variant flag on the existing ones.


**Merged files:** `src/core/overlays/JacobiPotentialCalculator.js` (new),
`src/adapters/overlays/jacobiPotentialOverlay.js` (new), `src/app/displaySettings.js`
(`showJacobiPotential`/`jacobiPotentialScale`), `src/viewport/gravitationalPotentialPanel.js`
(3rd pill + Jacobi-scale slider), `src/viewport/viewport.js` (wired into the render loop),
`test/core/overlays/JacobiPotentialCalculator.test.js` (new, 6 tests — verifies L4/L5 are
local maxima, L1/L2 are saddles, via a translation trick to sample the real calculator at
non-grid-aligned points rather than a separate reimplementation).

**UI location:** the dedicated Gravitational Potential panel, not `DISPLAY_OPTIONS` — that
panel already owns every potential-surface variant (Task 18), `DISPLAY_OPTIONS` isn't the
registry for this family anymore.

**Verified:** `yarn test` 32/32 (26 baseline + 6 new), `yarn build` clean — both re-verified
in the shared checkout after merge, not just trusted from the worktree. Live `yarn dev`
visual check (L4/L5 hilltop, L1-L3 saddle) not performed — browser MCP locked by concurrent
sessions throughout; the unit tests assert the same physical signature directly against the
production calculator instead.
