## task-wi-35: Implement the Provider/DI + ForceLaw split (task-wi-28's recommendation)

**Goal:** implement the three findings from `task-wi-28`'s research pass (archived at
`WORK_ITEM_TASKS/archive/task-wi-28-provider-di-viewcontroller.md` — read it in full first,
this task doc only summarizes the "so the follow-up task doc should say" lines).

**1. Provider directory.** Create `src/provider/` with `FieldCalculatorProvider.js`,
`OverlayRendererProvider.js`, `PlotCorrectionStrategyProvider.js`, `LoggerProvider.js`,
`ForceLawProvider.js` — one class per `@api` interface family, each with one
`provide<ConcreteName>...()` method per concrete adapter it knows about, each file also
exporting a singleton instance (`export const overlayRendererProvider = new
OverlayRendererProvider();`), matching this codebase's existing `store`/`displaySettings`/
`ACTIVE_CORRECTION` singleton-import convention exactly — do NOT thread a provider into any
`mountX(el, store)` function's parameters.

**2. Wire `viewport.js` through the provider.** Replace its ~7 inline `new XOverlay(scene,
toThree[, camera])` calls with calls through the imported `overlayRendererProvider` singleton.
`mountViewport(el, store)`'s signature does not change — no `ViewController` class (task-wi-28
explicitly recommends against one; `mountViewport` already matches its 5 sibling panels'
shape).

**3. Wire `main.js`'s Logger selection through `loggerProvider`** instead of the current
inline `new MultiLogger([...])` block (~lines 16-27).

**4. New `@api/ForceLaw.js` interface**: `derivatives(state: Float64Array, bodies: Body[],
softening: number) -> Float64Array`. New `@core/NewtonianForceLaw.js`: the current
`Simulation._derivatives()` body, adapted to this signature, NO behavior change — same
softened `1/r^3` sum over ALL bodies (physics invariant in `WORK_ITEM_RULES.md`: never add a
distance-based cutoff). Add `provideNewtonianForceLaw()` to `ForceLawProvider`.

**5. `Simulation`'s constructor** gains an optional `forceLaw` opt, same pattern as its
existing `logger` opt (default `null`; if not supplied, `Simulation.js` can default to its own
`NewtonianForceLaw` instance — but `main.js` should pass
`forceLawProvider.provideNewtonianForceLaw()` in explicitly so the composition root is the one
actually deciding, not an in-module default). `step()`'s 4 call sites (`k1`-`k4`) change from
the private `this._derivatives(s)` to `this.forceLaw.derivatives(s, this.bodies,
config.softening)`. No change to RK4 structure, `totalEnergy()`, or any existing test's
numeric output — this is a pure refactor.

**Do NOT** change `store.js`/`displaySettings.js`/`plotPanel.js`'s existing singleton-import
pattern — it's the convention being extended, not replaced.

**Acceptance check:** `yarn test` passes with IDENTICAL numeric results (32/32 — if any energy/
orbit test's expected values change, something broke the physics, not just the wiring).
`yarn build` succeeds. `yarn dev`, confirm every overlay (force field, potential field,
equipotential lines, field lines, Lagrange points, billboard arrows) still renders and every
toggle/slider still works — this is a pure refactor, zero visible behavior change expected.
