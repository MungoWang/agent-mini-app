# Versioning (one lightweight history per app)

The host keeps a per-app commit tree via isomorphic-git (`runtime/apps/<appId>/.git`).

## When a commit happens

`mini_app_edit` / `mini_app_write` / `mini_app_delete` **auto-commit** by default; a successful `mini_app_reload` with a dirty worktree commits too. So the normal flow needs no manual commit.

Explicit control:

| Tool | Purpose |
|---|---|
| `mini_app_history_commit({ appId, message })` | Close out a batch you made with `commit: false`; `message` is required |
| `mini_app_history_list({ appId })` | List the commit tree (nodes + parentIds) — like `git log` |
| `mini_app_history_revert({ appId, commitId })` | **Forward** commit undoing an older one (`git revert` semantics); history stays |
| `mini_app_history_reset({ appId, commitId })` | Point main back at a commit and keep a backup ref — like `git reset`; **does not delete objects** |

Commit once after each round of work on an app (especially after a large AI-driven change) so a bad edit is recoverable.

## Differences from git (don't apply git instincts)

- **Single branch**: main only. Do not expect merge / rebase / cherry-pick.
- **Full snapshots**: `mini_app_history_commit` keeps the whole tree; do not treat "delete snapshots" as `git gc`.
- After `reset`, the old commits still exist (visible as a backup tip) — nothing was erased.
- `revert` creates a **new** commit, so the tree grows a side branch; that is not "history removed".
- Snapshots exclude `storage/`, `.git/`, `node_modules/` (they were never source files).
