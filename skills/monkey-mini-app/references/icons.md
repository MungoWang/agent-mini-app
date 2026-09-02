# Icons

`import { Icon } from "@monkey-mini-app/sdk"` — a single `Icon` namespace (lucide). `Icon.<Name>` accepts **any lucide React component name** (PascalCase). Below is a **curated subset**, grouped by purpose with a one-line note on when to reach for it; anything not listed still works by lucide's naming rule (`Icon.IconName`).

```tsx
import { Icon } from "@monkey-mini-app/sdk";
<Icon.Search size={16} strokeWidth={2} />
```

Icon-only buttons must carry an accessible name: `<Button size="icon" aria-label="Refresh"><Icon.RefreshCw /></Button>`.

## Actions

| Name | Use for |
|---|---|
| `Plus` / `Minus` | Add / remove |
| `X` | Close, clear |
| `Check` / `CheckCircle2` | Done, success |
| `Trash2` | Delete |
| `Pencil` / `PenLine` | Edit, rename |
| `Copy` / `Clipboard` | Copy |
| `Download` / `Upload` | Download / upload |
| `RefreshCw` | Refresh, re-fetch |
| `Send` | Submit, send |
| `ExternalLink` | Open in a new window |
| `Link` | Copy link |

## Navigation

| Name | Use for |
|---|---|
| `ChevronRight` / `ChevronLeft` | Enter / expand, or back |
| `ChevronDown` / `ChevronUp` | Collapse / expand |
| `ChevronsUpDown` | Sortable column |
| `ArrowUpRight` | External link, score went up |
| `ArrowLeftRight` / `ArrowUpDown` | Swap, transfer |
| `MoreHorizontal` | Overflow menu |

## Status

| Name | Use for |
|---|---|
| `Bell` / `BellOff` | Notifications / muted |
| `Eye` / `EyeOff` | Show / hide a secret |
| `Info` | Informational hint |
| `AlertCircle` / `TriangleAlert` | Warning |
| `Loader2` / `LoaderCircle` | In progress (pair with an animate class) |
| `HelpCircle` | Help |
| `BadgeCheck` | Verified, passed |
| `Star` / `Heart` | Favourite / like |

## Content & input

| Name | Use for |
|---|---|
| `Search` | Search box |
| `Filter` | Filter |
| `SlidersHorizontal` | Advanced filter, tuning parameters |
| `CalendarDays` | Date |
| `Clock` / `History` | Time / history |
| `Tag` | Label, category |
| `File` / `FileText` | File / document |
| `Folder` / `FolderOpen` | Directory |
| `Image` | Image |
| `List` / `ListOrdered` | List / ordered list |
| `Hash` | Identifier, topic |
| `Code2` / `Terminal` | Code / command line |

## System & monitoring

| Name | Use for |
|---|---|
| `Activity` / `Zap` | Live activity, performance |
| `Gauge` / `BarChart3` | Metrics, overview |
| `Server` / `Database` | Service, storage |
| `HardDrive` / `Cpu` / `MemoryStick` | Disk / CPU / memory |
| `Cloud` / `Network` / `Globe` / `Wifi` | Network, cloud, external services |
| `TrendingUp` / `TrendingDown` | Up / down |
| `GitBranch` / `GitMerge` / `GitPullRequest` | Git branch, merge, PR |
| `Rocket` | Release, ship |

## Media / user / settings

| Name | Use for |
|---|---|
| `Play` / `Pause` | Play / pause |
| `Music2` / `Video` / `Mic` / `Camera` | Audio, video |
| `Settings` / `Settings2` | Settings |
| `Mail` / `MessageSquare` | Mail / comment |
| `Lock` / `Unlock` / `KeyRound` | Permission, secret |
| `Home` | Home |

## Empty-state illustrations (`Illu*`)

**Exactly these 10 names** (unDraw sources, tokenised so they follow `--primary` / `--muted`). Unlike lucide, these cannot be guessed — if a name is not in this list, fall back to an `Icon` plus text.

```tsx
import { IlluEmpty } from "@monkey-mini-app/sdk";
<IlluEmpty className="mx-auto w-40" />
```

| Name | Use for |
|---|---|
| `IlluEmpty` | Generic empty list / first run with no data |
| `IlluNoData` | A filter is applied and the result is empty |
| `IlluSearch` | Search returned nothing |
| `IlluLoading` | First load / placeholder |
| `IlluServerStatus` | Service unavailable, fetch failed |
| `IlluAccessDenied` | No permission / secret missing |
| `IlluPageNotFound` | Target missing, stale id |
| `IlluDataProcessing` | Background job running (pair with `scanStatus`) |
| `IlluBugFixing` | Error state, empty failure detail |
| `IlluCodeReview` | Diff / review empty state |
