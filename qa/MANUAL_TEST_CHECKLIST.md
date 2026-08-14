# P2 主流程人工验收清单

状态填写：`not_tested / passed / failed / blocked / needs_review`。以下默认值不是通过结论。

| ID | 类别 | 验收项 | 预期结果 | 默认状态 | 失败严重度 |
|---|---|---|---|---|---|
| WF-01 | workflow | 导入人物特稿夹具 | 项目可打开，字段完整 | not_tested | critical |
| WF-02 | workflow | 导入校园调查夹具 | 项目可打开，线索与假设保持区分 | not_tested | critical |
| WF-03 | workflow | 导入政策观察夹具 | 项目可打开，日期与适用范围仍待核验 | not_tested | critical |
| WF-04 | workflow | 快速策划 | 十分钟内可确认新闻问题、前三类信源与前三项行动 | not_tested | high |
| WF-05 | evidence | 证据矩阵 | 未核实内容不显示为已核实 | not_tested | critical |
| WF-06 | interview | 主角与旁证 | 人物特稿中角色被明确区分 | not_tested | high |
| WF-07 | interview | 引语确认 | 未确认引语不能进入课程导出 | not_tested | critical |
| WF-08 | evidence | 冲突来源 | 不同观点并列保留，系统不擅自裁决 | not_tested | critical |
| WF-09 | workflow | 报道大纲 | 结构与任务类型匹配，并引用证据/采访材料 | not_tested | high |
| WF-10 | workflow | 作业自查 | 硬性要求可追溯，阻断项可见 | not_tested | high |
| DP-01 | data_persistence | 刷新恢复 | 刷新后当前项目仍存在 | not_tested | critical |
| DP-02 | data_persistence | 删除项目 | 删除后本地存储不再包含该项目 | not_tested | critical |
| AC-01 | accessibility | 键盘流程 | 主要操作可用键盘完成，焦点可见 | not_tested | high |
| PF-01 | performance | 常规交互 | 不出现持续冻结或阻塞核心流程 | not_tested | high |

实际执行时为每项补充：`actualResult`、`testedBy`、`testedAt`、浏览器/视口、证据路径和备注。QA 通过不等于真实用户验证通过。
