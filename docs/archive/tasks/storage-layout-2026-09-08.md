# ctx.storage: atomic writes, and a table that splits itself

> Archived 2026-09-08 · original location: `TODO.md` P2 (storage 单文件) + the design thread that came
> out of the AI-radar app's field report
>
> **Update 2026-09-08 (later):** auto-split was **withdrawn**. Measured cost (fsync per shard write +
> O(N) `stats()` on every `set`) made the common "many small keys" shape *slower* than rewriting a
> mid-sized JSON file. What remains: atomic write + `STORAGE_CORRUPT`, plus a host **panel banner**
> (never blocks writes) that names the heaviest keys and offers a copy-paste AI prompt. Leftover
> `<table>.d/` dirs from the withdrawn layout are absorbed back into one `.json` on first touch.

## What was wrong

Two separate defects in one 20-line function (`makeFileStorage`), neither visible until an app had
real data:

1. **A write could be observed half-done.** `writeFileSync(fp, JSON.stringify(obj, null, 2))`
   truncates the destination first, so a process killed mid-write leaves unreadable JSON.
2. **An unreadable file read back as empty.** `read()` swallowed the parse error and returned `{}`.
   The next `set()` then wrote a table containing *only its own key*. Total data loss, no error, UI
   merely looks like a fresh install. `storage/` is gitignored (`git-history.ts:31`), so there was no
   second copy anywhere.

Plus a cost that is not a bug but shaped the fix: **every `set` rewrites the whole table**. The radar
app kept 1400 items and the fetched body of each article in one table, so each save re-serialised
the entire thing — visible as a stall in the middle of a scan.

## The observation that made the fix cheap

`AppStorage` is `get/set/delete/clear/table`. **There is no enumeration** — no `keys()`, no `all()`,
no query. Every method addresses exactly one key. So the storage layout is not part of the contract,
and the platform can change it underneath an app that cannot tell. Splitting became a host decision
instead of an authoring rule.

## What shipped

`packages/host/src/apps/file-store.ts` now owns layout, and `ctx.storage` is a thin adapter over it:

| Layout | When | Where |
|---|---|---|
| whole table, one atomic write | default | `storage/<table>.json` |
| one file per key | first write past 512 KB | `storage/<table>.d/<sha1(key)[0..16]>.json` |

Rules that matter more than the shape:

- **Atomic everywhere.** Bytes go to `<target>.tmp-<pid>`, fsync, then `rename` — so a reader sees the
  old file or the new one, never a third thing.
- **Corruption is loud and keeps the evidence.** A parse failure moves the file to
  `<name>.corrupt-<timestamp>` and throws `HostError("STORAGE_CORRUPT")`. Silently returning `{}` was
  the data-loss mechanism.
- **A split is published by renaming a staged directory.** Writing shards straight into `<table>.d/`
  would make the split layout authoritative *while the migration is still running* — a crash at that
  point loses every key not yet copied. Staging in `<table>.d.tmp/` and renaming means a crash leaves
  the single file in charge. The old file is renamed to `<table>.json.split` rather than deleted.
- **A key is not a filename.** Keys are arbitrary strings (`a/b/c`, Chinese, URLs, `""`); shards are
  named by hash and carry the real key inside, verified on read — a collision reads as a miss, never
  as somebody else's value.
- **One table, one row.** `listStorageTables` folds `<name>.d` into a single entry with summed bytes
  and a key count, and `readTableView` returns the merged object, so the storage browser and the
  panel show the same table they always did. `.corrupt-*` / `.split` corpses are inert by name.
- Panel rows now lead with entries + human size (`3 entries · 2.0 MB`) instead of raw bytes.
- New in the contract: `ctx.storage.bytes()`. `retryTimes`/`notices` are unrelated and live in their
  own commits.

Guidance still shipped alongside the fallback, because the platform cannot know which of your maps is
the one that will grow: `ctx.md` → "Choosing a table" (rows that grow get their own table), and the
`onEvent → ctx.storage.set` sample that rewrote a whole file per agent step was replaced with
`ctx.push`.

## Deliberately not done

- **No query engine.** A split table answers one key cheaply; "all unread, sorted by heat" would mean
  walking shards. That is the boundary where SQLite earns its place, and `node:sqlite` needs
  `engines.node >= 22.5` while this repo declares `>=20` — recorded as a trigger, not a task.
- **No RxDB.** Its two Node-viable storages (Filesystem Node, SQLite) are both premium/paid; the free
  options are browser-local or memory-only. Its problem domain is multi-tab replication and reactive
  queries, not the write amplification we had; and a second persistence authority would be invisible
  to the panel's storage browser.
- **No merge-back.** A table that split stays split; flipping across the boundary on every write would
  re-migrate for nothing.

## Evidence

`packages/host/tests/storage-split.test.ts` (13 cases) asserts author-visible behaviour, not layout:
every key still reads back after a split, the next write costs one key rather than the table, a
crash-mid-split leaves the file authoritative, hash collisions cannot return another key's value,
illegal filenames survive round-trip, and the panel lists one entry per table. Canary-checked: forcing
the threshold off turns 8 of the 13 red. `storage-durability.test.ts` covers atomicity + quarantine.
`pnpm verify` 12/12; coverage `file-store.ts` 90.3 % lines; demo-host Playwright 13 passed.
