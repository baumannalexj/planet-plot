## Task 28: Redo — @provider/DI container, ViewController, and `_derivatives()` interface

**Note on why this exists:** the earlier "Research: Provider/DI container + ViewController
architecture" entry above (tagged `[done: team-lead — recommends against building either]`)
turned out to be a placeholder — its body is only the research BRIEF (what to read, what
questions to answer, "recommend one... report back under 400 words"), not an actual filled-in
recommendation. No such recommendation exists anywhere in this file. Per the coordination
contract's rule 3a ("verify the ACTUAL CODE... don't trust a note claiming work is done"),
treat that entry as unresolved and redo it for real. Covers WORK_ITEMS.md's 3 open
`# code structure` items.

**1. @provider directory + composition root** — read `src/viewport/viewport.js` (currently
`new LagrangePointsOverlay(scene, toThree)` etc., all inline `new ConcreteClass()` calls) and
`src/main.js` (how `store`/loggers are wired today) in full. Decide and justify: one
`Provider` class per interface family (`FieldCalculator`, `OverlayRenderer`,
`PlotCorrectionStrategy`, `Logger`), or one combined provider object with several
`provideX()` methods? Does the provider get passed INTO `mountViewport(el, store, provider)`,
or imported as a singleton like `store`/`displaySettings` already are — pick whichever is
consistent with this codebase's existing composition-root convention, don't invent a new one.

**2. ViewController** — is `viewport.js`'s `mountViewport` function already close to this role
(it already owns all the three.js calls), or does the ask imply extracting it into a class
with named methods `main.js` calls instead of one big function? Recommend one.

**3. `_derivatives()` interface + adapter** — `Simulation.js`'s `_derivatives()` (the RK4
force law) has an inline comment flagging it should be an interface with an adapter, wired in
main, same DI pattern as the other interfaces. This is a SEPARATE decision from #1/#2 — it
touches the physics core itself, not just rendering/composition wiring, so don't assume the
same answer applies. Read `Simulation.js`'s constructor/`step()`/`_derivatives()` in full;
propose the interface shape (`ForceLaw.derivatives(state, bodies) -> Float64Array`?) and
where the default Newtonian implementation would live (`@core` vs `@adapters`?), consistent
with how `FieldCalculator` implementations are split today.

**Deliverable:** an actual filled-in recommendation for all 3, each ending "so the follow-up
task doc should say: ..." — this entry itself should be replaced/updated with the real
findings, not left as another unfilled brief for the next session.

