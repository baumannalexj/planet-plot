# Multi-Claude coordination system

How this repo is being worked by more than one Claude session at once, and why it's
built this way. `WORK_QUEUE.md`'s "Coordination contract" section is the enforceable
rulebook — this doc is the narrative explanation of the same system, for a human reading
it cold.

## The problem

Several Claude sessions (interactive peers like `planet-plot-f2`, plus each session's own
dispatched subagents) can be touching this repo simultaneously. Left alone, that produces:
uncommitted work silently overwritten, doc files (`WORK_ITEMS.md`/`WORK_QUEUE.md`) edited
out from under each other, and — the specific failure this session just hit — a worker
pinned to one git worktree while its task doc points at a different, unreachable path.

## Roles

- **Team lead** (the interactive session a human is talking to, e.g. this one or
  `planet-plot-f2`) — scopes work into tasks, writes task docs precise enough that a
  low-context worker doesn't have to make design decisions, dispatches workers, and does
  NOT implement large features itself. Stays "open" to keep orchestrating rather than
  going heads-down on one task.
- **Worker** (a dispatched subagent, `isolation:"worktree"`, or an interactive peer
  picking up a claimed task) — implements exactly one task, in its own git worktree,
  commits as it goes, reports back with test/build results.
- **Merge-coordinator** (any session, often a cheap/fast model, taking on this role for a
  moment) — rebases a `[worktree ready: ...]` branch onto the current base branch, verifies
  the actual code (not just the doc's claim), merges, then deletes the worktree + branch.
- **Researcher** (a dispatched subagent with no code-editing tools) — answers a design
  question or root-causes a bug *before* a worker starts, so the worker's task doc has zero
  open design decisions left in it.

## Artifacts

- **`WORK_ITEMS.md`** — the human-facing backlog. `[ ]` open, `[~]` moved into
  `WORK_QUEUE.md` as a scoped task, `[x]` done and verified. Sub-bullets (`- (me): ...`)
  hold the team lead's answers/status notes and open questions back to the human.
- **`WORK_QUEUE.md`** — worker-ready task docs, one per numbered task, each self-contained
  (files to touch, exact code/formula, acceptance check, explicit "do NOT" boundaries) so a
  worker never has to re-derive a decision already made. Also holds the **coordination
  contract** (the enforceable rules below) and any pending research write-ups.
- **`WORK_ITEMS_FINISHED.md`** — append-only done-work log, organized into dated rounds
  during consolidation passes. Single-owner while a consolidation pass is in progress (rule
  #6) since this file and `WORK_ITEMS.md` have had real edit races.

## The contract, in short (full text lives in `WORK_QUEUE.md`)

1. Claim a task before touching it — tag it with your session name.
2. Work in a worktree, based off the *current* integration branch (checked dynamically,
   not hardcoded — this was explicitly corrected once already: it's `feat/simulator-mvp`
   right now, not `main`). Commit as you go.
3. Mark `[worktree ready: <branch-name>]` when done, with files touched + test/build
   results — the branch name is the actionable handle, not a session name.
3a. The merge-coordinator rebases the ready branch onto the current base branch FIRST,
   before diffing anything — this surfaces real conflicts through git instead of a
   file-by-file diff that can silently pick the wrong side. Verify the actual code, not a
   doc's claim that work is "done" (a doc has claimed unmerged work as landed at least once).
3b. Once merged, delete the worktree AND its branch immediately — stale merged worktrees
   are exactly the kind of leftover state that causes confusion (see the gotcha below).
4. Leave a `(research needed)` sub-bullet if blocked on a design decision — name the
   decision, don't guess or stall silently.
5. Announce file locks for anything outside an already-claimed task.
6. `WORK_ITEMS.md`/`WORK_ITEMS_FINISHED.md` are single-owner during consolidation.
7. When in doubt, message another session before editing a shared file.
8. A "draw radius"/sampling-extent setting bounds rendering and sampling only — it must
   never bound which bodies contribute to a physics calculation (gravity has infinite
   range). Added after this specific confusion looked likely to recur across two
   discretization-related tasks at once.

## Known gotcha: two different things are both called "a worktree"

This tripped a worker today, worth stating plainly:

- **Harness-managed isolation worktree** — created automatically when a session dispatches
  a subagent with `isolation:"worktree"`. Lives under `.claude/worktrees/agent-<id>`. The
  worker's Bash/EnterWorktree tools are *sandboxed to this path* — it cannot `cd` or
  `EnterWorktree` into any other worktree, even one in the same repo.
- **Manually created worktree** — created by `git worktree add .worktrees/<branch-name>`,
  per contract rule #2, at a path of the task-writer's choosing.

If a task doc tells a harness-isolated worker to go work in a manually-created path, the
worker has no tool that can reach it — it's stuck on whatever commit its isolation worktree
happened to be created from. When this happened (Task 23), the fix was for the *team
lead* — which has an unsandboxed shell — to fast-forward the worker's own pinned isolation
worktree directly, and to stop telling isolated workers to `cd` anywhere else. Rule of
thumb: if a worker was dispatched with `isolation:"worktree"`, its task doc should never
name a worktree path at all — it's already in the right one.
