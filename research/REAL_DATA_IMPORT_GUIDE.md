# 真实研究数据导入指南

1. 从 `templates/研究包模板.json` 复制空模板到 Git 忽略的 `research/results/`；新包必须使用 `schemaVersion: 2`。
2. 使用 P001 形式编号；删除姓名、学号、电话、微信、邮箱、成绩、路径、密钥、采访原文、逐字稿和 private note。
3. 所有参与者确认同意；真实记录设 `synthetic:false`，演练/Mock 设 `synthetic:true`。
4. 运行 `npm run eval:p3`，确认匿名、分离和发布判断。
5. 本地 `.env.local` 设置 `VITE_RESEARCH_MODE=true`，启动后在研究页面导入匿名包。
6. 默认“真实数据”筛选核对样本数，再切换“模拟数据”确认没有混入。
7. 原始研究资料不提交 Git；对外只发布汇总且披露限制。

旧版兼容：导入器接受 `dataVersion: 1`，并将事件对象的 `name` 迁移为 `eventName`。首次由本地研究仓库读取后会回写 v2 结构；请勿手工把 `name` 加入隐私白名单。新建、保存和导出的事件只能包含 `eventName`。

当前尚未完成真实用户验证。
以下内容为测试框架或模拟演示数据。
