# 采访材料与证据

`InterviewEvidenceProcessor` 只生成候选主张、候选引语和报道线索，不生成采访内容，也不自动把陈述认定为事实。

用户确认纳入证据工作区后，材料会成为：

- `SourceRecord.sourceType = interview_material`
- `credibilityTier = unrated`
- 带公开称呼的短片段和追溯 ID
- 明确警告“须归因并独立核验”

采访材料可以支持、反驳或提供背景，但关键事实仍需原始文件、当事方回应、数据或独立来源。未确认、私密和 off-record 笔记不会进入公开证据导出。
