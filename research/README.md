# NewsPilot P3 用户研究

当前尚未完成真实用户验证。
以下内容为测试框架或模拟演示数据。

本目录用于真实用户招募、知情同意、主持、观察、匿名导入与分析。仓库当前真实参与者 `0`、真实场次 `0`；不得用自动化测试、Mock 或模型生成反馈补齐。

建议第一轮招募 8—12 名新闻传播专业学生，覆盖大一至大三；至少 2 名校园媒体成员、2 名无独立采访经验者、2 名使用过通用 AI 工具者。可选邀请 1—2 名教师或高年级学生担任盲评评审。这是目标配额，不代表已招募。

数据默认本地保存。真实研究包放在不提交 Git 的 `research/results/`，只在完成脱敏、同意确认和人工审查后导入研究模式。公开报告必须披露样本量、任务、时间、限制和真实/模拟筛选。

匿名研究包当前使用 `schemaVersion: 2`。产品事件字段为 `eventName`；导入器会把旧版 `dataVersion: 1` 中的 `ProductEvent.name` 无损迁移为 `eventName`，新保存和导出的数据不会继续写入通用 `name` 字段。结构定义见 [`schemas/research-data-bundle.schema.json`](schemas/research-data-bundle.schema.json)，空包见 [`templates/研究包模板.json`](templates/研究包模板.json)。
