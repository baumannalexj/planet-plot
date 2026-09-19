## Task 30 (blocked — needs clarification): Gravitational Potential — mesh vs "surface" toggle

**Do not start without an answer.** WORK_ITEMS.md asks: "for Gravitation Potential surface,
choose between 'mesh' and 'surface'." Task 23 (above) already implements the cylindrical
draw-radius FADE for the existing potential visualization — that's a separate, already-scoped
piece and is NOT this task.

**(research needed) — the actual blocker:** `PotentialFieldOverlay` (read the file) already
IS a vertex-displaced `THREE.PlaneGeometry` mesh with a vertex-color gradient — i.e. it's
already "a mesh" by any normal definition. It's unclear what a distinct second "surface" mode
would render that's visually different from what exists today (a smooth interpolated surface
vs. the current per-vertex-displaced grid? A different geometry entirely, like isosurface
marching cubes? Or is "mesh" meant to describe the discrete SAMPLE POINTS as small marker
glyphs, analogous to how force-field has both a continuous look (billboard arrows) and this
displaced-mesh look, with "surface" being a third, smoother option?). Ask the user directly
what "mesh" and "surface" are each supposed to look like, with 1-2 concrete visual references
if possible, before scoping an implementation — guessing here risks building the wrong thing
twice.

