# Work Item Rules — multi-Claude coordination contract for this repo

Renamed from `WORK_QUEUE.md`'s old "Coordination contract" section to match the
`~/.claude/RULES/multi-agent-work-queue-protocol.md` template. `WORK_QUEUE.md` is now a
slim index only — full task detail lives in `WORK_ITEM_TASKS/`. See that global doc for
the full rationale; this file is the project-adapted, enforceable version of it.

## Roles

- **Orchestrator** — currently split across two interactive sessions (`planet-plot-04`,
  this one, and `planet-plot-f2`) acting as co-orchestrators until/unless the human
  designates one. Converts `WORK_ITEMS.md` entries into `WORK_ITEM_TASKS/*.md` docs, watches
  `WORK_QUEUE.md` for `READY_FOR_MERGE`, dispatches the merge-coordinator, marks `DONE`.
- **Worker** — a dispatched subagent (often `isolation:"worktree"`) or either interactive
  session picking up a `TODO` task directly.
- **Merge-coordinator** — whichever session/agent actually performs a merge; always
  rebases first, always verifies the real diff, always deletes the worktree+branch after.
- **Admin agent** — claiming/status-flipping is mechanical; delegate to a cheap subagent
  when the queue gets busy rather than spending an orchestrator turn on bookkeeping.

## Files

```
WORK_ITEMS.md              — human backlog. [ ] open · [~] converted to a task · [x] done · [?] blocked on a human answer
WORK_ITEM_RULES.md         — this file
WORK_QUEUE.md              — slim index: one line + status per active task
WORK_ITEM_TASKS/
  task-wi-<n>-<slug>.md     — full task doc
  research/                 — research-only task docs live here
  archive/                  — task docs whose WORK_QUEUE.md line has been archived (kept, not deleted)
WORK_QUEUE_ARCHIVE.md      — DONE queue lines, swept out of WORK_QUEUE.md periodically
WORK_ITEMS_FINISHED.md     — legacy done-log predating this system; superseded by WORK_QUEUE_ARCHIVE.md going forward, kept for history
```

## Claiming — optimistic lock via exact-string replace

1. Read `WORK_QUEUE.md`. Pick a line with `status: TODO`.
2. Copy that line **verbatim** as your edit's `old_string`.
3. New string = same line, status changed to `ASSIGNED`, plus a claim sub-bullet:
   `  - claimed by <session-name> @ <ISO-timestamp>`.
4. Edit with an exact match, no `replace_all`. If it fails (line already changed under
   you), you lost the race — re-read and pick a different line, don't retry the same one.
5. **Allocating a NEW task-wi-# uses the same discipline on the append point**: your
   `old_string` is the exact last line of `WORK_QUEUE.md` (or a unique end-of-file marker),
   so two sessions appending "the next task" at once can't silently both grab the same
   number — one edit wins, the other's `old_string` no longer matches and must re-read.
   (This repo hit a real duplicate-numbering collision — two unrelated tasks both called
   "Task 15" — before this rule existed; that's why it's explicit now.)

Statuses: `TODO` → `ASSIGNED` → `READY_FOR_MERGE: <worktree-branch, or research doc path,
or "direct edit: <commit sha>">` → `DONE` (orchestrator sets `DONE` only) — or `BLOCKED:
<what's needed>` at any point if a task can't proceed without a human decision (see below).

## Working in a worktree

Always base off the **current** integration branch, checked dynamically (`git branch
--show-current`), not a hardcoded name — this repo's base branch has been
`feat/simulator-mvp`, not `main`, this entire session; `main` is stale on purpose and gets
fast-forwarded only in a deliberate, separate step.

**Fetch before every worktree creation, not just once per session.** Run `git fetch origin`
(or, for a purely local multi-session setup with no shared remote push happening, at least
re-check `git branch --show-current`/`git log -1` on the base branch) immediately before
`git worktree add`, every single time — the base branch moves under you constantly in this
setup (another session's merge, a checkpoint commit) and a worktree created from a stale
local ref inherits that staleness for its entire lifetime. This is exactly what caused two
of this session's worktrees to start missing 50+ files' worth of already-landed work.

**Two different things are both called "a worktree" — do not conflate them:**
- A harness-managed isolation worktree (`isolation:"worktree"` on a dispatched subagent)
  lives at `.claude/worktrees/agent-<id>` and the subagent is SANDBOXED to it — it cannot
  `cd`/`EnterWorktree` into any other worktree, even one in the same repo.
- A manually-created worktree (`git worktree add .worktrees/<branch-name>`) is a different
  path a task doc might name.
If a task doc tells an isolated subagent to work at a manual path, it has no way to get
there. Rule: if a worker was dispatched with `isolation:"worktree"`, its task doc must
NEVER name a worktree path — it's already in the only one it can reach. If the mismatch
already happened, the orchestrator (unsandboxed) fast-forwards the subagent's OWN pinned
worktree onto the current base branch directly, rather than trying to relocate the agent.

## Merging (merge-coordinator role)

1. Rebase the ready branch onto the current base branch FIRST, before diffing anything —
   real conflicts surface through git, not a file-by-file diff that can silently pick the
   wrong side.
2. Verify the ACTUAL diff matches what the task doc/report claims — a report can describe
   unmerged work as landed.
3. Merge (fast-forward when possible).
4. **Handle conflicts, don't just detect them.** A small, mechanical conflict (e.g. two
   tasks both added an unrelated line to the same settings file) gets resolved directly —
   read both sides, keep both additions, re-verify. A large or ambiguous conflict (many
   hunks, or two sides that changed the SAME logic differently) does not get force-resolved
   blind: abort the merge and either re-scope the losing task against current `HEAD` as a
   fresh task, or flag it back to the orchestrator/human — never commit a guessed
   resolution just to make the merge "succeed."
5. Re-run `yarn test`/`yarn build` in the shared checkout after merging, not just trust the
   worktree's earlier run.
6. **Delete the worktree AND its branch immediately after every successful merge** — no
   exceptions, not a later batch pass: `git worktree remove .worktrees/<branch-name>` (or
   the `.claude/worktrees/agent-<id>` path if that's where the work actually happened) then
   `git branch -d <branch-name>`. A leftover merged worktree is exactly the kind of stale
   state that causes the next session to misjudge what's landed.
7. **Never commit unresolved conflict markers.** This repo had literal `<<<<<<<` markers
   committed straight into the base branch once, breaking `yarn build` for every session
   until found. If a merge/cherry-pick produces more than a couple of trivial conflicts,
   abort per step 4 rather than forcing a large manual resolution blind.

## Shared-checkout concurrency (not just worktrees)

If more than one session drives Bash/git against the SAME working directory (not separate
clones — this repo has had two interactive sessions doing exactly that), a `git add`/commit
from one can interleave with another's mid-command. Treat any multi-file git operation in
a shared checkout with the same "announce before touching" discipline as a doc edit —
message the other session before a commit/merge/reset, not just before editing
`WORK_ITEMS.md`.

## Physics invariants (domain rule, not a coordination rule — applies to any task touching a calculator)

**"Draw radius"/sampling-extent settings (force field, potential field, equipotential
lines, field lines, the shell-discretization grid) bound SAMPLING and RENDERING only.**
They must never bound which bodies contribute to a force/potential summation — gravity has
infinite range. Every `accelerationAt`/`potentialAt`-style sum stays over ALL bodies, full
stop, regardless of any radius/shell setting. Do not add a distance-based body-exclusion
"optimization" to a physics sum as a side effect of a rendering-extent task.

## Blocked items

A task that can't proceed without a human decision gets `status: BLOCKED: <one-line ask>`
in `WORK_QUEUE.md` and stays flagged in `WORK_ITEMS.md` as `[?]` with a
`REQUIRED_ANSWER: ...` sub-bullet. Do not guess past a genuine ambiguity — a wrong guess on
a design question (e.g. what "mesh vs surface" should each look like) costs a full
implementation pass to undo.
