## Task 28: @provider/DI container, ViewController, and `_derivatives()` interface — RESOLVED

**Status: research complete, filled in for real** (the original archived research entry was
a placeholder — brief only, no recommendation ever written). Findings below are the actual
recommendation; a follow-up implementation task should be opened from the three "so the
follow-up task doc should say" lines.

Read in full: `src/viewport/viewport.js`, `src/main.js`, `src/app/store.js`,
`src/app/displaySettings.js`, `src/api/FieldCalculator.js`, `src/api/OverlayRenderer.js`,
`src/api/PlotCorrectionStrategy.js`, `src/core/overlays/ForceFieldCalculator.js`,
`src/plots/plotPanel.js` (its `ACTIVE_CORRECTION` import), `src/core/Simulation.js`.

### 1. @provider directory + composition root

**Existing convention, confirmed from code, not assumed:** every shared/singleton dependency
in this app is a module-level instance exported directly from its own file and imported
directly by whoever needs it — `export const store = new AppStore()` (`store.js`),
`export const displaySettings = new DisplaySettings()` (`displaySettings.js`), and
`ACTIVE_CORRECTION` exported from `@adapters/plotCorrections/index.js` and imported straight
into `plotPanel.js`. Nothing in this codebase is constructed in `main.js` and threaded through
function parameters into a panel — `mountObjectPanel(el, store)`, `mountPlotPanel(el, store)`,
`mountViewport(el, store)` all take the *store*, never a bag of adapters. The one partial
exception is `Logger`: `main.js` picks `ConsoleLogger`/`CsvFileLogger`/`MultiLogger` and
assigns the result onto `store.sim.logger` — composition root decides the concrete class, but
still pushes it onto an existing singleton rather than passing it as a constructor arg
anywhere else.

WORK_ITEMS.md's own wording already specifies the per-interface shape (`<ApiName>Provider.js`
with `provide<ConcreteName><ApiName>()` methods, "composition root holds providers which have
singletons") — verified against the actual @api surface, that maps cleanly onto the 4
existing interfaces plus the new one from part 3: `FieldCalculatorProvider`,
`OverlayRendererProvider`, `PlotCorrectionStrategyProvider`, `LoggerProvider`,
`ForceLawProvider`. One class per family (not one combined object) because the families
don't share callers — `viewport.js` only ever needs `OverlayRendererProvider`, `main.js` only
ever needs `LoggerProvider`/`ForceLawProvider`, `plotPanel.js` only ever needs
`PlotCorrectionStrategyProvider` — a combined object would just be an unused-import magnet for
every consumer.

Each provider file exports a singleton instance (`export const overlayRendererProvider = new
OverlayRendererProvider();`), imported directly by the consumer that needs it — matching
`store`/`displaySettings`/`ACTIVE_CORRECTION`, not a new "pass the provider into
`mountViewport`" convention. `mountViewport(el, store)`'s signature does not change.

**So the follow-up task doc should say:** create `src/provider/` with
`FieldCalculatorProvider.js`, `OverlayRendererProvider.js`, `PlotCorrectionStrategyProvider.js`,
`LoggerProvider.js`, `ForceLawProvider.js`, each a class with one `provide<ConcreteName>...()`
method per concrete adapter it knows about, each file also exporting a singleton instance.
Update `viewport.js` to replace its 7 inline `new XOverlay(scene, toThree[, camera])` calls
with calls through the imported `overlayRendererProvider` singleton; update `main.js`'s
Logger-wiring block (lines ~16-27) to go through `loggerProvider` instead of inline
`new MultiLogger([...])`; leave `store.js`/`displaySettings.js`/`plotPanel.js`'s existing
singleton-import pattern untouched — it's already the convention being extended, not
replaced.

### 2. ViewController

`mountViewport` already fills this role and should NOT be extracted into a class. Evidence:
every other panel in the app — `mountObjectPanel`, `mountPlotPanel`, `mountDisplayControls`,
`mountGravitationalPotentialPanel`, `mountDiscretizationPanel` — is the identical shape:
a `mountX(el, store)` function, called exactly once from `main.js`, fully self-contained
afterward (internal closures, its own `store.onFrame`/`onOriginChange`/`onPresetChange`
subscriptions, its own render/resize loop). `main.js` never calls a second method on any of
them post-mount; all further interaction flows one-way through `store`/`displaySettings`
pub-sub, which `mountViewport` already subscribes to internally. Extracting a
`ViewController` class with named methods would give `main.js` methods it never calls (nothing
in `main.js` needs to command the viewport imperatively after mount) while making
`mountViewport` inconsistent with its 5 siblings for no benefit — the actual gap isn't the
function/class shape, it's that `mountViewport` reaches directly into `@adapters` (7 concrete
overlay imports) instead of through a provider, which part 1 above already fixes.

**So the follow-up task doc should say:** no `ViewController` class — keep `mountViewport`
as a function with the same `mountViewport(el, store)` signature; the only change to
`viewport.js` is swapping its adapter imports/`new` calls for calls through
`overlayRendererProvider` (part 1).

### 3. `_derivatives()` interface + adapter

This is genuinely separate from #1/#2's rendering-composition question, and lands on the
opposite side of the @core/@adapters split from `OverlayRenderer`. `FieldCalculator`'s
concrete implementations (`ForceFieldCalculator`, `PotentialFieldCalculator`) already
establish the precedent: they live in `@core/overlays/`, not `@adapters/`, specifically
because they're pure physics math with no THREE.js/DOM/IO dependency — `@api/FieldCalculator.js`
says this explicitly ("Concrete implementations live in @core ... since they ARE domain
physics, not a separate concern needing its own adapter"). `Simulation._derivatives()` is the
same category: pure math over a packed state vector, `G`, and `config.softening`, no
framework dependency at all. So the default Newtonian implementation belongs in `@core`
(e.g. `src/core/NewtonianForceLaw.js`), with the interface itself in `@api`
(`src/api/ForceLaw.js`) alongside `FieldCalculator`/`OverlayRenderer`/`PlotCorrectionStrategy`
— `@adapters` stays reserved for implementations with a real external dependency (three.js
overlays, console/CSV loggers, plot-correction rendering strategies), which a Newtonian force
law has none of.

Interface shape, matching `FieldCalculator.compute(bodies, opts)`'s plain-data-in/
plain-data-out convention rather than `Simulation`'s closure-heavy `_derivatives(s)`:
`ForceLaw.derivatives(state: Float64Array, bodies: Body[], softening: number) ->
Float64Array`. `Simulation`'s constructor gains an optional `forceLaw` opt (same pattern as
its existing optional `logger` opt — default `null`, composition root supplies a concrete
instance, `@core` never imports `@adapters`... except here there's no adapter to import, only
another `@core` class, so `Simulation.js` can import `NewtonianForceLaw` as its own in-module
default if `forceLaw` isn't supplied, the same way it already hardcodes `G` and reads
`config.softening` directly today). `step()`/`_derivatives()` change from a private method
reading `this.bodies` to `this.forceLaw.derivatives(s, this.bodies, config.softening)`.

**So the follow-up task doc should say:** add `src/api/ForceLaw.js` (interface:
`derivatives(state, bodies, softening) -> Float64Array`) and `src/core/NewtonianForceLaw.js`
(the current `_derivatives()` body, adapted to the new signature, no behavior change — same
softened `1/r^3` sum over all bodies, still unbounded/no radius cutoff per the physics
invariants in WORK_ITEMS_RULES.md). Add a `ForceLawProvider` (part 1) with
`provideNewtonianForceLaw()`. `Simulation`'s constructor accepts an optional `forceLaw` opt
wired the same way `logger` already is; `main.js` passes `forceLawProvider.provideNewtonianForceLaw()`
in explicitly rather than relying on the in-`Simulation.js` default, so the composition root
is the one actually deciding the concrete class per the DI ask. `step()` calls
`this.forceLaw.derivatives(...)` in place of the current private `this._derivatives(...)`
calls (4 call sites: `k1`-`k4`). No change to `RK4` structure, `totalEnergy()`, or any
existing test's numeric output.
