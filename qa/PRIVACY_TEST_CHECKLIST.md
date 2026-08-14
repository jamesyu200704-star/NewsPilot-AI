# 隐私人工验收清单

| ID | 操作 | 预期 | 默认状态 | 严重度 |
|---|---|---|---|---|
| PR-01 | 输入虚构联系方式并生成课程导出 | 私人联系方式不进入课程导出 | not_tested | critical |
| PR-02 | 添加 private note | 只进入明确标记的私密备份，不进入课程导出 | not_tested | critical |
| PR-03 | 标记 off the record 内容 | Markdown、DOCX、证据表均排除 | not_tested | critical |
| PR-04 | 创建未确认直接引语 | 导出被阻断或排除该引语 | not_tested | critical |
| PR-05 | 启用研究模式 | 事件只在本地存储，不发生外部请求 | not_tested | critical |
| PR-06 | 记录问题编辑事件 | 不保存问题正文、逐字稿、音频、路径或密钥 | not_tested | critical |
| PR-07 | 导出匿名研究包 | 只含 P001 形式编号，不含姓名/学号/联系方式 | not_tested | critical |
| PR-08 | 删除全部本机项目 | 对应浏览器存储被清除 | not_tested | critical |

若出现真实个人信息，立即停止、隔离文件，不上传截图，不提交 Git；由项目负责人决定删除方式。
