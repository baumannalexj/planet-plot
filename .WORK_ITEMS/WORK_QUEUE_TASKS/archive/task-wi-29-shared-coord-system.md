## Task 29: Shared, user-selectable coordinate system (bodies panel + plots) [worktree ready: task-29-coord-system]
  - claimed by task-29-coord-system

**Goal:** resolve two related WORK_ITEMS.md asks — "'bodies' and 'plot' should share
coordinate system" and "I should be able to change the coordinates." Current state (confirmed
by reading the actual code, not guessing): `src/plots/plotPanel.js`'s `PlotCard` already has
ITS OWN independent `coordSystemId` (defaults to `DEFAULT_COORD_SYSTEM = 'cartesian'` from
`src/core/coordinates.js`), user-changeable via a per-card `<select>` (`coordSelect`) — so
"change the coordinates" already half-exists, just scoped to one plot card at a time, with no
shared/global selection. `src/viewport/objectPanel.js`'s Calc readout grid, by contrast, has
`const CALC_COORD_SYSTEM = 'spherical'` HARDCODED with no selector at all — this is the actual
gap "bodies and plot should share coordinate system" is pointing at.

**Implemented exactly as scoped — override approach chosen for #3, per the recommendation:**

**1.** `src/app/displaySettings.js`: added `coordSystemId` (imports `DEFAULT_COORD_SYSTEM`
from `@core/coordinates.js` for the default, so it stays in sync with that constant rather
than duplicating the literal `'cartesian'` string).

**2.** `src/viewport/objectPanel.js`: removed the hardcoded `CALC_COORD_SYSTEM` const, the
`computeMetric(...)` call now reads `displaySettings.coordSystemId` live. Added a new
`<select>` row ("Coordinates:") right below the "Bodies" heading, same option-population
pattern as `plotPanel.js`'s `coordSelect` (`Object.values(COORD_SYSTEMS)`), writes via
`displaySettings.set('coordSystemId', ...)`, syncs back via `displaySettings.onChange`
(skipped while the select itself has focus, same "don't clobber while active" convention
used elsewhere in this file).

**3.** `src/plots/plotPanel.js`: `PlotInstance`'s `coordSystemId` now initializes from
`displaySettings.coordSystemId` instead of the bare `DEFAULT_COORD_SYSTEM` constant — chose
the OVERRIDE approach (new cards start in sync with the shared setting; an existing card's
independently-changed selector is never clobbered, since nothing re-reads
`displaySettings.coordSystemId` after construction). The special-cased default-first-plot
override (`plot.coordSystemId = 'spherical'`, a few lines below) is unaffected — it already
runs AFTER construction and still wins, same as before.

**Known display quirk (expected, not a bug):** `objectPanel.js`'s `CALC_METRICS` list is a
fixed set of ids (`r`/`theta`/`phi`/`rdot`/etc., spherical-flavored). Switching the shared
coordinate system to `cartesian` makes those rows compute to `NaN` (an axis id not present in
`cartesian`'s `COORD_SYSTEMS.cartesian.axes`) and render as `—`, same as any other
undefined-metric case already handled in this file. Making `CALC_METRICS` itself
coordinate-system-aware (swapping which rows show up) was out of scope for this task — noting
it in case the user wants that as a fast follow-up.

**Verified:** `yarn test` 26/26, `yarn build` clean. Live `yarn dev` visual check not done —
every browser MCP (chrome-devtools, playwright, isolated context attempts) locked by other
concurrent sessions. Confirmed by code reading: `_buildDom()` runs after `this.coordSystemId`
is set in `PlotInstance`'s constructor, so the per-card select's initial value correctly
reflects the shared default; no circular import risk (`coordinates.js` has zero imports of
its own).

**Files touched (commit is scoped to exactly these — this worktree's rsync copy also picked
up 3 other files' uncommitted, NOT-MINE changes from the shared checkout —
`equipotentialLinesOverlay.js`/`potentialFieldOverlay.js`/`gravitationalPotentialPanel.js`,
presumably Task 23's fade work in progress — deliberately left untouched/uncommitted here,
not part of this task):** `src/app/displaySettings.js`, `src/viewport/objectPanel.js`,
`src/plots/plotPanel.js`.

