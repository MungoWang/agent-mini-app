# 版控

每 app 一份轻量历史（类git）。

- `mini_app_history_commit` 全量保留，不要靠清快照 ≈ git commit
- list commits 是树 ≈ git log
- revert ≈ 从某 commit **分叉**，旁支还在
- 单分支，不要做 merge

生成或改完 app 后都 commit 一次，方便 AI 误操作后找回。
