# Work Queue

Slim index only — see `WORK_ITEM_RULES.md` for the protocol, `WORK_ITEM_TASKS/` for full
task detail, `WORK_QUEUE_ARCHIVE.md` for completed work (Tasks 1-22, 27).

* task-wi-25-shell-discretization | WORK_ITEM_TASKS/task-wi-25-shell-discretization.md | status: READY_FOR_MERGE: task-25-shell-discretization
  - implemented by task-25-shell-discretization @ 2026-09-19T00:12Z
  - rebased onto feat/simulator-mvp (60ee538) and reconciled with Task 23's already-merged
    draw-radius fade by team-lead @ 2026-09-19T00:12Z — potentialFieldRadius setting
    retired in favor of the shared drawRadius; fade formula ported into the new
    triangle-list mesh with a 4-component (RGBA) color attribute. yarn test 26/26, yarn
    build clean, post-rebase.
* task-wi-26-svg-fieldline-arrows | WORK_ITEM_TASKS/task-wi-26-svg-fieldline-arrows.md | status: TODO
* task-wi-28-provider-di-viewcontroller | WORK_ITEM_TASKS/task-wi-28-provider-di-viewcontroller.md | status: TODO
* task-wi-29-shared-coord-system | WORK_ITEM_TASKS/task-wi-29-shared-coord-system.md | status: READY_FOR_MERGE: task-29-coord-system
  - claimed by task-29-coord-system
* task-wi-30-mesh-vs-surface | WORK_ITEM_TASKS/task-wi-30-mesh-vs-surface.md | status: BLOCKED: needs the human to describe what "mesh" vs "surface" should each look like
* task-wi-31-jacobi-potential | WORK_ITEM_TASKS/task-wi-31-jacobi-potential.md | status: ASSIGNED
  - claimed by planet-plot-f2
* task-wi-32-vectorfield-mesh | WORK_ITEM_TASKS/task-wi-32-vectorfield-mesh.md | status: BLOCKED: needs the human to say whether they want a magnitude-surface or a field-line mesh/ribbon
* task-wi-33-unused-constants | WORK_ITEM_TASKS/task-wi-33-unused-constants.md | status: BLOCKED: needs the human to name which specific constants they meant
