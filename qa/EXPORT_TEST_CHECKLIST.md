# 导出人工验收清单

| ID | 导出物 | 检查 | 默认状态 | 严重度 |
|---|---|---|---|---|
| EX-01 | Markdown | 中文、标题层级、清单和换行正常 | not_tested | high |
| EX-02 | JSON | 可重新导入，版本字段有效 | not_tested | critical |
| EX-03 | DOCX | Word/LibreOffice 可打开，无损坏提示 | not_tested | critical |
| EX-04 | DOCX | 中文字体、标题、表格、分页适合课程提交 | not_tested | high |
| EX-05 | 证据矩阵 CSV | UTF-8 BOM、中文列名和多行内容正常 | not_tested | high |
| EX-06 | 私密备份 ZIP | 有明确警告，内容与课程导出隔离 | not_tested | critical |
| EX-07 | 所有课程导出 | 未确认引语、off the record、私人联系方式均不存在 | not_tested | critical |

记录实际使用的软件版本、文件名、打开结果和脱敏截图。仅验证文件生成不等于“可正常打开”。
