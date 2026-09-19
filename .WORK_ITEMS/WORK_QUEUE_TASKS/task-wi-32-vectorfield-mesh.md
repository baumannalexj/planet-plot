## Task 32 (blocked — needs a design decision from the user): Vector field as a mesh surface

**Do not start without an answer.** WORK_ITEMS.md: "change vector field to a mesh surface —
design decision needed." An earlier reply already surfaced the actual conflict and it's still
unanswered: `BillboardArrowOverlay` (2D camera-facing arrows) was built as an ADDITIONAL
toggle alongside the original cone `ForceFieldOverlay`, specifically so a continuous-mesh
option COULD coexist as a third alternative rather than replacing either.

**(research needed):** ask the user directly — do they want a continuous mesh/surface
representation of the force field (magnitude as height/color on a plane, like
`PotentialFieldOverlay` but for the vector field's magnitude) as a THIRD toggle alongside
cones and billboard arrows, or did the original ask mean something else (e.g. a vector
FIELD LINE mesh/ribbon rather than a magnitude surface)? Get a concrete answer before scoping
a calculator/overlay pair — this is exactly the kind of ambiguity a wrong guess would cost a
full implementation pass to undo.

---
