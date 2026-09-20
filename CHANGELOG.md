# Changelog

本文件记录 NewsPilot AI 的重要变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 新增 Vercel Serverless Functions 入口，复用现有 Express `/api/health` 与 `/api/generate`。
- 新增受保护 OpenAI Preview 验收脚本，自动检查健康状态、真实生成、降级状态和三 Agent 执行轨迹。

### Changed

- 将服务端 Provider 初始化提取为可复用运行时，支持在受保护的 Vercel Preview 中配置 OpenAI。
- OpenAI 非成功响应只记录经过白名单过滤的错误类型、错误代码与请求 ID，便于区分额度、限流和模型权限问题，同时避免把上游消息或请求内容写入日志。

### Security

- API Key 仍只由服务端环境变量读取，浏览器构建不包含密钥；公开生产环境默认继续使用 Mock。

## [1.1.0-beta.1] - 2026-08-14

### Added

- 统一的新闻线索 Composer，覆盖 Enter 提交、Shift + Enter 换行、中文输入法组合态、加载防重与失败后保留输入。
- P3 本地用户研究、匿名盲评、问题分级和 Beta Release Gate 工具。

### Changed

- 公开页面、README、发布门槛和版本元数据统一为 `v1.1.0-beta.1`。
- 明确历史 `v1.0.0` 不代表真实用户验证完成；当前仍为公开 Beta。

### Security

- 公开部署固定使用 Mock / Manual 安全能力并关闭研究记录。
- 补充生成目录忽略规则、发布前凭据与隐私扫描，以及 Vercel 安全响应头。

## [0.9.0-beta] - 2026-08-13

### Added

- P3 本地研究模式、匿名参与者与场次、真实/模拟数据隔离、最小产品事件和匿名研究包导入导出。
- 13 维匿名对照评测 Rubric；评分提交锁定后才允许揭盲。
- ProductIssue 优先级、功能冻结、自动/人工/研究 Release Gate 与保守的 Beta/V1 判断。
- P2 三类人工验收夹具和主流程、隐私、导出、移动端清单。
- 真实用户研究招募、筛选、同意、主持、协议、观察、问卷、复访、分析与导入材料。
- 三套虚构教学示例、GitHub Issue/PR 模板、Test/Build/Release Check 工作流和 P3 专项评测。

### Changed

- 公开发布线重新标记为 `v0.9.0-beta`；先前 `1.2.0` 是内部功能里程碑，不代表真实用户研究门槛已经通过。
- README 明确产品边界、当前真实样本为 0、Vercel Demo 与本地完整模式差异。

### Security

- 研究事件写入前剔除正文、逐字稿、联系方式、密钥、本地路径、private note 和非标量元数据。
- 真实研究结果目录默认忽略；公开包测试阻止 `.env`、`node_modules` 和私人研究数据进入 Git。

## [1.2.0] - 2026-08-13

### Added

- P2 九视图报道执行工作台：概览、倒排任务、采访对象、采访提纲、采访记录、证据缺口、报道结构、作业检查与导出中心。
- `ReportingTask / InterviewSource / OutreachAttempt / InterviewSession / InterviewQuestion / InterviewNote / InterviewTranscript / QuoteCandidate / ReportingLead / EvidenceGap / StoryOutline / AssignmentCheckItem` 领域模型。
- 人工 TXT/Markdown 转写和仅回环地址可用的 Local Whisper Provider；MP3、WAV、M4A、WebM 在浏览器与服务端双重校验。
- 六种证据支撑报道骨架、十二类证据缺口和不隐藏 blocking 项的作业检查。
- 九类脱敏导出、标准中文 DOCX 和固定六文件完整提交包。
- 20 个 P2 离线合成项目评测，覆盖十项指标并强制四项采访/隐私硬错误为 0。
- P2 执行、任务、信源、采访、转写、引语、证据、缺口、提纲、自查、DOCX、隐私和限制文档。

### Changed

- 本地项目数据从 v2 迁移到 v3，并持久化完整执行工作区；v1/v2 导入和浏览器旧数据自动迁移。
- 完整模式第四步升级为真实采访与课程提交闭环，P1 证据工作台保留在“证据”页。
- DOCX/ZIP 导出依赖按需加载，避免进入首页主包。

### Security

- 联系方式、匿名身份、私密笔记、off-record、未确认引语、音频和完整转写从课程/公开导出中排除。
- 采访完成、直接引语、证据纳入、提纲支撑和课程提交分别执行确定性门槛。
- 本地转写不写临时文件、不记录本地路径，只允许回环服务；失败保留人工转写路径。

## [1.1.0] - 2026-08-12

### Added

- P1 证据工作台：待验证主张、可编辑检索计划、来源台账、证据片段绑定、交叉核验矩阵、冲突卡、引用抽屉与 Markdown/JSON 导出。
- Manual、明确标记的 Mock 与自托管 SearXNG Search Provider；提供本地 Docker Compose、超时重试、缓存、结果上限和失败回退 Manual。
- SSRF 防护网页获取（含 DNS 结果固定连接与重定向复检）、正文与元数据提取、URL 规范化、精确/近重复与转载识别、独立来源组和可修正的来源分类历史。
- TXT、Markdown、PDF 文本层、DOCX、CSV、JSON 浏览器本地解析，包含文件头/MIME/体积/解压限制和扫描 PDF 提示。
- 30 个 P1 合成证据与对抗评测案例，覆盖九项指标并强制关键事实 False Verification Rate 为 0。
- P1 搜索、证据、分级、去重、核验、冲突、上传、安全与隐私十份文档。
- 课程作业要求文本解析：覆盖十类字段，逐项展示原文依据、置信度和人工确认门槛，只有确认项会写入任务。
- 独立快速策划摘要：严格聚焦 Verdict、新闻问题、角度、3 类信源、3 项资料、最大风险和 3 个立即行动。
- 无账号本地项目管理：新建、自动保存、列表、重命名、复制、删除、最近修改时间、版本化 JSON 导入导出和损坏校验。
- 人工匿名对照工具：手动粘贴通用模型与学生结果，三方案随机匿名、九维人工评分、匿名 JSON/CSV 和独立揭盲密钥。
- `用户测试/` 真实测试协议与空数据模板，覆盖招募、三类任务、主持脚本、观察、问卷和反馈录入；未包含虚构参与者或结果。
- 十类策略的最低采访/证据要求、推荐对象、失败方式、伦理风险、学生难度、最少工作天数和来源审核状态。
- 面向新闻传播本科生的 `ReportingBrief → StudentReportingPlan` 工作流，默认使用课程作业模式，并提供校园媒体模式。
- `GO / REVISE / HOLD / DROP` 编辑判断、收窄建议与最小可行报道版本。
- 十类学生报道策略库与七维候选角度评分，不再限定为人物 / 制度 / 趋势三个固定角度。
- 信源地图、低可达信源替代方案、八层采访问题阶梯、证据账本和关键说法交叉验证矩阵。
- 快速 / 完整策划模式与“填写任务 → 拆选题 → 做采访 → 核查提交”四步工作台。
- 20 个校园报道案例与六维半自动回归评测命令 `npm run eval:campus`。

### Changed

- 本地项目数据从 v1 迁移到 v2，并持久化完整证据工作区；v1 导入自动迁移。
- 快速模式增加前三个关键证据缺口、优先来源类型和来源冲突提示。
- C 级转载、商业内容、未定级材料和社交线索不再把关键事实升级为“部分核实”；范围或时间不一致的 A 级材料保持部分核实。
- 首页从模型能力展示重构为学生记者任务工作台；Provider 和检索配置移至折叠的开发者设置。
- AI Provider 结果只补充新闻价值评分与资料线索；线索默认保持 `unverified`，不会自动成为已核实事实。
- Markdown 导出升级为课程采访策划案，包含任务约束、Verdict、信源、采访提纲、证据矩阵和提交自查。

### Removed

- 移除旧版首页 Demo / AI 模式选择和固定三角度结果组件，保留后端 Provider 基础设施供开发者可选使用。

### Security

- P1 证据 API 使用字段白名单、固定客户端头、基础限流与网页抓取并发上限；搜索内部配置不返回浏览器。
- Source Fetcher 阻止本机、内网、云元数据和非 HTTP(S) URL，每次重定向复检，并限制响应类型、体积和时间。
- 搜索、网页抓取、材料解析缓存与限流记录均设置容量或过期清理边界，避免长时间运行时无限增长。
- DOCX 宏、ActiveX、嵌入对象与压缩炸弹被拒绝；所有外部材料按 Prompt Injection 不可信数据隔离。
- 本地项目导入拒绝无格式标识、缺少/未知版本、字段损坏或畸形策划数据；数据去向明确为当前设备和浏览器。
- 盲评匿名结果不包含方案来源，揭盲密钥单独导出；未完成的人工评分不允许导出。
- 明确禁止在没有真实采访时生成引语或声称采访已完成。
- 用户材料与 Search / RAG 摘要只建立待核对证据记录，未读取原件前不支持任何事实主张。

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
