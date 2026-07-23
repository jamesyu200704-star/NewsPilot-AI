# Changelog

本文件记录 NewsPilot AI 的重要变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

暂无未发布变更。

## [0.1.0] - 2026-07-22

### Added

- Initial open source release.
- 面向新闻学生、校园媒体和初级记者的主题输入与采访策划界面。
- “人物、制度、数据趋势”三个固定报道角度及统一的结构化结果。
- 浏览器本地 Mock 模式，默认无需后端或 API Key。
- Node.js Generator Service、GenerationProvider 接口、MockProvider 与可选 OpenAIProvider。
- OpenAI Responses API Structured Outputs、JSON Schema、Ajv 服务端校验和客户端运行时校验。
- OpenAI 到服务端 Mock、API 到浏览器本地 Mock 的双层降级链路。
- 单角度复制、完整方案复制和 UTF-8 Markdown 导出。
- 响应式布局、键盘焦点样式和 <code>prefers-reduced-motion</code> 支持。
- Schema、Provider、降级、客户端适配器和 HTTP API 测试。
- 开源 README、贡献指南、安全策略和变更记录。

### Security

- OpenAI API Key 仅由服务端环境读取，不进入浏览器构建。
- API 请求使用输入 Schema、32 KiB 请求体限制和通用错误响应。
- OpenAI 输出使用严格 JSON Schema、服务端二次校验、请求超时和 <code>store=false</code>。
- 生成接口要求 JSON Content-Type，并提供单进程请求窗口与并发上限，降低 API 成本和资源滥用风险。
- Markdown 导出将用户及模型文本转义为不可执行的纯文本语法。
- 默认服务只监听 <code>127.0.0.1</code>；公网部署边界在文档中明确说明。
- GitHub Actions 使用最小权限执行 <code>npm ci</code>、测试和生产构建。
