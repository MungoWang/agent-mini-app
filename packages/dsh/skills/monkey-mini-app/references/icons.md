# Icons

`import { Icon } from "@monkey-mini-app/ui"` — 一个 `Icon` 命名空间（来自 lucide）。`Icon.<Name>` 接受**任意 lucide React 组件名**（大驼峰）。下面是**常用推荐子集**，按用途分组、一句话告诉你什么时候用；没列到的按 lucide 命名规则也能用（如 `Icon.IconName`）。

```tsx
import { Icon } from "@monkey-mini-app/ui";
<Icon.Search size={16} strokeWidth={2} />
```

## 操作
| 名字 | 何时用 |
|---|---|
| `Plus` / `Minus` | 添加 / 减少 |
| `X` | 关闭、清除 |
| `Check` / `CheckCircle2` | 完成、成功 |
| `Trash2` | 删除 |
| `Pencil` / `PenLine` | 编辑、重命名 |
| `Copy` / `Clipboard` | 复制 |
| `Download` / `Upload` | 下载 / 上传 |
| `RefreshCw` | 刷新、重新拉取 |
| `Send` | 提交、发送 |
| `ExternalLink` | 打开新窗口 |
| `Link` | 复制链接 |

## 导航
| 名字 | 何时用 |
|---|---|
| `ChevronRight` / `ChevronLeft` | 进入/展开 或 返回 |
| `ChevronDown` / `ChevronUp` | 折叠/展开 |
| `ChevronsUpDown` | 可排序 |
| `ArrowUpRight` | 外链、跑分增长 |
| `ArrowLeftRight` / `ArrowUpDown` | 切换、传输 |
| `MoreHorizontal` | 更多菜单 |

## 状态
| 名字 | 何时用 |
|---|---|
| `Bell` / `BellOff` | 通知 / 免打扰 |
| `Eye` / `EyeOff` | 显示 / 隐藏敏感值 |
| `Info` | 信息提示 |
| `AlertCircle` / `TriangleAlert` | 警告 |
| `Loader2` / `LoaderCircle` | 加载中（配 animate） |
| `HelpCircle` | 帮助 |
| `BadgeCheck` | 已验证、通过 |
| `Star` / `Heart` | 收藏 / 喜欢 |

## 内容 & 输入
| 名字 | 何时用 |
|---|---|
| `Search` | 搜索框 |
| `Filter` | 筛选 |
| `SlidersHorizontal` | 高级筛选、设置参数 |
| `CalendarDays` | 日期 |
| `Clock` / `History` | 时间 / 历史 |
| `Tag` | 标签、分类 |
| `File` / `FileText` | 文件 / 文档 |
| `Folder` / `FolderOpen` | 目录 |
| `Image` | 图片 |
| `List` / `ListOrdered` | 列表 / 有序列表 |
| `Hash` | 编号、话题 |
| `Code2` / `Terminal` | 代码 / 命令行 |

## 系统 & 监控
| 名字 | 何时用 |
|---|---|
| `Activity` / `Zap` | 实时活动、性能 |
| `Gauge` / `BarChart3` | 指标、大盘 |
| `Server` / `Database` | 服务、数据存储 |
| `HardDrive` / `Cpu` / `MemoryStick` | 磁盘 / CPU / 内存 |
| `Cloud` / `Network` / `Globe` / `Wifi` | 网络、云、外部服务 |
| `TrendingUp` / `TrendingDown` | 涨 / 跌 |
| `GitBranch` / `GitMerge` / `GitPullRequest` | git 分支、合并、PR |
| `Rocket` | 发布、上线 |

## 媒体 / 用户 / 设置
| 名字 | 何时用 |
|---|---|
| `Play` / `Pause` | 播放 / 暂停 |
| `Music2` / `Video` / `Mic` / `Camera` | 音视频 |
| `Settings` / `Settings2` | 设置 |
| `Mail` / `MessageSquare` | 邮箱 / 评论 |
| `Lock` / `Unlock` / `KeyRound` | 权限、密钥 |
| `Home` | 首页 |
