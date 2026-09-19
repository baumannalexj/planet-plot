## Task 33 (blocked — needs clarification from the user): Separate unused gravitational constants

**Do not start without an answer.** WORK_ITEMS.md: "separate related universal gravitational
orbit equation constants we may not be using." Already investigated once (see the `(me)`
reply in WORK_ITEMS.md) — confirmed by reading `src/core/constants.json`/`constants.js`: all
8 current constants are actively read by `constants.js`'s derivations. There is nothing
currently unused to separate out.

**(research needed):** ask the user which specific constants they had in mind — this may be
about constants that exist in physics references but aren't in this codebase at all yet (e.g.
`c` the speed of light, for the GEM/Maxwell-analog equations already added to the Equations
list per an earlier WORK_ITEMS answer), not about splitting up the existing 8. Get a concrete
list before scoping any file changes.

