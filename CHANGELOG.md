# Changelog

本文件记录 NewsPilot AI 的重要变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.0.0] - 2026-08-05

### Added

- 新闻策略知识库：六维新闻价值理论、优秀报道结构案例与分类采访策略。
- Search + RAG：自动生成主题、政策、公开数据和近期报道查询，并通过可选 Brave Search API 合并实时证据。
- 三 Agent 工作流：新闻策划 Agent、事实核查/风险审核 Agent、新闻编辑 Agent 严格顺序执行。
- 独立 QwenProvider，通过 Ollama 对三个 Agent 分别执行结构化模型调用。
- 可追溯证据面板、事实核查发现、风险闸门、编辑终审和 Agent 轨迹界面。
- 完整 V1.0 Markdown 报告，包含知识来源、搜索状态、证据 ID 和 Agent 审核结果。

### Changed

- <code>GenerationResult</code> 升级为完整新闻工作流契约，新增检索上下文与 Agent 审核结果。
- OpenAI、Ollama 和 Qwen Provider 均从单次生成升级为策划、核查、终审三次独立 Structured Output 调用。
- 默认 Demo 在浏览器本地执行知识检索和确定性三 Agent 流程，但明确标记为未实时联网。
- 包版本升级至 <code>1.0.0</code>。

### Security

- Brave Search 密钥只允许由服务端读取；搜索结果 URL 必须是 HTTP/HTTPS，网页摘要只作为不可信数据注入 Prompt。
- 事实核查 Agent 只能引用检索上下文中存在的证据 ID，搜索摘要不得直接标记为已核实事实。
- 最终结果在服务端 Ajv 与浏览器运行时执行完整结构校验。

## [0.2.0] - 2026-08-01

### Added

- 主题分析模块：识别议题类别、报道对象、核心矛盾与方法论摘要。
- 六维新闻价值评估：按时效性、重要性、接近性、冲突性、人物性和趣味性给出可解释评分。
- 类型安全的新闻规则引擎：针对校园教育、政策治理、技术问责和消费市场议题补齐采访角色、资料来源、核验重点与风险。
- 分步骤新闻编辑 Prompt Engine，要求模型按新闻价值、核心矛盾、人物入口、数据支撑、采访路径和事实风险进行结构化推理。
- 新闻策划报告界面与 Markdown 导出，覆盖方法论、角度、资料需求、核查清单、风险和下一步行动。
- 结构化 Bug 与改进建议表单、Pull Request 检查清单和每周非破坏性 Dependabot 更新。
- 独立的健康检查契约测试，覆盖 Provider 状态与禁止缓存响应头。
- 编辑器基础格式约定。

### Changed

- Provider 只负责生成结构化业务草案，新闻方法论分析和确定性规则由 Generator Service 统一执行与合并。
- 浏览器 Mock、Ollama 和 OpenAI 现在共享同一套 V0.2 新闻工作流与结果契约。
- 产品定位从选题文本生成器升级为“基于新闻生产方法论的 AI 新闻策划 Agent”。
- Ollama 页面文案与文档改为描述实际配置地址，不再把自定义 <code>OLLAMA_BASE_URL</code> 误称为必然本机处理。
- 复制与 Markdown 导出的操作反馈延长到 3 秒，减少提示来不及阅读的情况。
- GitHub Actions 仅在 <code>main</code>、面向 <code>main</code> 的 Pull Request 或手动触发时运行，并增加超时与高危依赖审计。
- 生产环境的静态 Mock 构建不再请求不存在的 Provider 健康接口，消除线上控制台 404。

### Security

- Prompt 明确禁止编造事实、数据和受访者，并将用户输入作为数据而非指令处理。
- 新闻价值评分与规则匹配由确定性代码执行，避免关键判断完全交给模型。
- GitHub Actions 固定到官方发布提交，并关闭 checkout 凭据持久化。

## [0.1.0] - 2026-07-29

### Added

- Initial open source release.
- 面向新闻学生、校园媒体和初级记者的主题输入与采访策划界面。
- “人物、制度、数据趋势”三个固定报道角度及统一的结构化结果。
- 浏览器本地 Mock 模式，默认无需后端或 API Key。
- Node.js Generator Service、GenerationProvider 接口、MockProvider 与可选 OpenAIProvider。
- OllamaProvider、可配置的 Qwen 本地推理和已验证的轻量默认模型。
- OpenAI Responses API Structured Outputs、JSON Schema、Ajv 服务端校验和客户端运行时校验。
- OpenAI 到服务端 Mock、API 到浏览器本地 Mock 的双层降级链路。
- Demo / AI 页面模式选择、Provider 健康检查、准确的数据去向提示与不可用状态禁用。
- Ollama JSON Schema 请求、JSON 解析重试和可操作的自动降级提示。
- 单角度复制、完整方案复制和 UTF-8 Markdown 导出。
- 响应式布局、键盘焦点样式和 <code>prefers-reduced-motion</code> 支持。
- Schema、Provider、降级、客户端适配器和 HTTP API 测试。
- 开源 README、贡献指南、安全策略和变更记录。

### Changed

- Generator Service 改为 Express，并按路由、服务和 Provider 分层。
- <code>npm run dev</code> 同时启动后端 API 与 Vite 前端。
- OpenAI 与 Ollama 共用同一套系统提示词、输入数据边界和防提示词注入说明。

### Security

- OpenAI API Key 仅由服务端环境读取，不进入浏览器构建。
- API 请求使用输入 Schema、32 KiB 请求体限制和通用错误响应。
- OpenAI 输出使用严格 JSON Schema、服务端二次校验、请求超时和 <code>store=false</code>。
- 生成接口要求 JSON Content-Type，并提供单进程请求窗口与并发上限，降低 API 成本和资源滥用风险。
- Markdown 导出将用户及模型文本转义为不可执行的纯文本语法。
- 默认服务只监听 <code>127.0.0.1</code>；公网部署边界在文档中明确说明。
- GitHub Actions 使用最小权限执行 <code>npm ci</code>、测试和生产构建。
- 忽略本地模型目录、Ollama 数据目录和所有真实环境文件。
- Vercel 静态部署使用 <code>npm ci</code> 并设置 CSP、防嵌入、MIME 嗅探保护、Referrer Policy 与 Permissions Policy。
