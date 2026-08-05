# NewsPilot AI

[![Build](https://github.com/jamesyu200704-star/NewsPilot-AI/actions/workflows/build.yml/badge.svg)](https://github.com/jamesyu200704-star/NewsPilot-AI/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/jamesyu200704-star/NewsPilot-AI)](https://github.com/jamesyu200704-star/NewsPilot-AI/releases/latest)
[![License](https://img.shields.io/github/license/jamesyu200704-star/NewsPilot-AI)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?logo=vercel)](https://newspilot-ai-ashy.vercel.app)

NewsPilot AI 是一个面向新闻学生、校园媒体和初级记者的 AI 新闻策划 Agent。它把新闻价值判断、选题策略、采访方法和事实核查流程转化为可解释的数字化新闻工作流。

AI-assisted news topic planning and interview preparation tool for journalism students.

当前版本默认使用浏览器本地 Demo，不需要后端或 API Key；Demo 仍会执行知识库检索与确定性三 Agent 流程，但不会伪装成实时网络搜索。需要真实模型与实时证据时，可通过后端启用 Qwen/Ollama/OpenAI 和 Brave Search。

## Live Demo

[打开 NewsPilot AI 在线演示](https://newspilot-ai-ashy.vercel.app)

线上版本运行在 Vercel，固定使用浏览器本地 Demo：包含方法论、知识库 RAG 和三 Agent 审核演示，不需要 API Key，也不会把用户输入发送到外部服务；实时 Search 与真实 LLM 需要运行后端。
生产构建在 <code>VITE_GENERATION_MODE=mock</code> 时不会请求不存在的
<code>/api/health</code>；只有显式配置为 <code>local-ai</code> 才会探测生成后端。

## 项目简介

NewsPilot AI 聚焦新闻报道的前期准备，而不是替代采访、调查或事实核验。用户输入线索后，系统依次完成主题分析、六维新闻价值评估、规则匹配、知识库与公开来源检索、策划生成、事实/风险审核和编辑终审，最后形成可追溯的新闻策划报告。

生成结果仅是策划建议。正式报道前仍需核实人物身份、制度原文、数据口径、回应权、隐私风险与素材授权。

## 产品背景

新闻初学者在选题阶段常遇到三个问题：

1. **主题过于宽泛**：知道想报道什么，却难以拆成可落地的新闻角度。
2. **采访准备分散**：采访对象、问题、事实核查任务与风险提醒缺少统一结构。
3. **AI 内容边界模糊**：生成文本容易被误当成已核验事实，需要明确来源模式和核验责任。

NewsPilot AI 将准备过程组织为：

**新闻线索 → 主题分析 → 新闻价值评估 → Rules Engine → Search + RAG → 新闻策划 Agent → 事实核查/风险审核 Agent → 新闻编辑 Agent → 最终策划报告**

## 核心功能

- 填写新闻主题、报道类型、目标受众、报道范围和补充背景。
- 对时效性、重要性、接近性、冲突性、人物性和趣味性进行六维评分，并给出可解释理由与综合置信度。
- Rules Engine 根据校园教育、政策治理、技术问责和消费市场等议题自动补齐采访角色、资料来源、核查重点与风险。
- Prompt Engine 要求 AI 按六步新闻编辑流程工作，禁止编造事实、数据和受访者。
- 内置新闻价值理论、优秀报道结构和采访策略知识库，不存储完整新闻正文。
- 自动生成主题、政策、公开数据和近期报道查询；可选 Brave Search 为 Prompt 提供可追溯实时证据。
- 新闻策划、事实核查/风险审核、新闻编辑三个 Agent 独立执行，AI 模式会进行三次结构化模型调用。
- 每项核查发现包含严重程度、支持状态、必须行动和证据 ID；搜索摘要最多只能视为部分支持。
- 生成“人物、制度、数据趋势”三个固定报道角度。
- 输出完整新闻策划报告，包含主题分析、核心矛盾、规则轨迹、报道角度、资料需求、事实核查、风险和下一步行动。
- 支持复制单个角度、复制完整方案和导出 UTF-8 Markdown 文件。
- 默认使用浏览器本地 Mock，不上传输入，也不需要 API Key。
- 页面会通过健康检查识别项目后端配置的 Qwen、Ollama、OpenAI 或 Mock；只有后端报告已配置 AI Provider 时才允许选择对应模式。
- Express Generator Service 通过 Provider 层支持 Mock、Qwen、Ollama 与 OpenAI Provider。
- Ollama 默认连接本机 Qwen，并使用 JSON Schema Structured Outputs；也可显式配置其他可信 Ollama 地址。
- Ollama/OpenAI 失败时服务端降级到 MockProvider；API 不可用时前端继续降级到浏览器本地 Mock。
- 通过结果中的 <code>mode</code>、<code>retrievalContext</code> 和 <code>agentReview.trace</code> 明确区分内容、证据与 Agent 的来源。

## 界面预览

### 主题输入

![NewsPilot AI 主题输入首页](docs/homepage.png)

### 结构化策划结果

![NewsPilot AI Search、RAG 与可追溯证据结果页](docs/result.png)

### 复制与 Markdown 导出

![NewsPilot AI 复制和导出功能](docs/export.png)

截图拍摄、更新和隐私检查方式见 [截图指南](docs/SCREENSHOT_GUIDE.md)。

## 技术架构

核心链路：

**User → Deterministic Methodology → Search + RAG → Planning Agent → Fact-check/Risk Agent → Editor Agent → Validated Report**

~~~mermaid
flowchart LR
    U["User"] --> F["React Frontend"]
    F --> E["Express API"]
    E --> G["Generation Service / News Workflow"]
    G --> T["Topic Analyzer"]
    T --> N["News Value Engine"]
    N --> RE["Rules Engine"]
    RE --> S["Search + Knowledge RAG"]
    S --> PE["Prompt Engine"]
    PE --> P1["Planning Agent"]
    P1 --> P["Provider Layer"]
    P --> M["Mock Provider"]
    P --> O["Ollama Provider"]
    P --> QP["Qwen Provider"]
    P --> A["OpenAI Provider"]
    M --> D["Structured Draft"]
    O --> Q["Configured Ollama / Qwen"]
    QP --> Q
    Q --> V["JSON Schema + Ajv Validation"]
    A --> V["JSON Schema + Ajv Validation"]
    V --> D
    O -. "失败或非法结构" .-> M
    QP -. "失败或非法结构" .-> M
    A -. "失败、超时或非法结构" .-> M
    D --> FC["Fact-check + Risk Agent"]
    FC --> ED["Editor Agent"]
    ED --> R["Ajv Validation + Final Report"]
    R --> F
~~~

实际运行包含四种 Provider 路径：

- **浏览器 Demo**：执行共享新闻方法论、内置知识库 RAG 和确定性三 Agent，不上传输入、不实时联网。
- **QwenProvider**：通过本机 Ollama 对策划、核查、终审分别调用 Qwen，页面明确显示 Qwen Agent。
- **Ollama AI（默认本机）**：React 前端调用 <code>POST /api/generate</code>，Express API 经 <code>GeneratorService</code> 调用配置的 Ollama / Qwen；默认地址为本机回环地址。
- **OpenAI**：服务端可选择 OpenAIProvider；页面会明确显示云端 Provider 和数据去向，不会误标为本地处理。

共享的 <code>BriefInput</code>、<code>PlanningContext</code>、<code>RetrievalContext</code>、<code>AgentReview</code>、<code>GenerationResult</code> 和 JSON Schema 位于 <code>shared/generation.ts</code>。确定性评分与规则不交给模型，检索结果作为不可信数据注入，三个 Agent 的输出逐层校验后才合并为最终响应。

### 技术栈

- React 19、Vite 7、TypeScript 5（严格模式）
- Node.js、Express 5
- Ajv JSON Schema 校验
- Ollama REST API、Qwen 本地推理与 Structured Outputs
- OpenAI Responses API Structured Outputs
- Brave Search API（可选实时检索）
- 原生 CSS

## 当前版本

### V1.0 News Agent Release

- 默认模式：浏览器本地 Mock。
- 可选模式：Express Generator Service + Ollama/Qwen（默认本机）或 OpenAI Provider。
- Provider 状态：页面通过 <code>GET /api/health</code> 识别项目后端配置；未连接或仅配置 Mock 时禁用 AI 选项并安全回到 Demo，上游调用失败时仍会自动降级。
- 当前包版本：<code>1.0.0</code>。
- 已实现：V0.2 方法论与规则、V0.3 Knowledge Base/Search/RAG、V0.4 多 Agent 审核和 V1.0 完整新闻工作流。
- Demo 会明确标记“本地知识库”；只有 <code>SEARCH_MODE=brave</code> 且服务端配置密钥时才标记为实时检索。
- 当前不包含账号、权限、数据库、历史记录或生产级 API 网关。

## 快速开始

环境要求：Node.js 20.19+ 或 22.12+，以及 npm。

### 1. 安装依赖

~~~bash
npm install
~~~

### 2. 准备本地环境文件

优先复制为 <code>.env.local</code>；也可以复制为 <code>.env</code>。服务端按 <code>.env.local</code>、<code>.env</code> 的顺序读取第一个存在的文件。

macOS、Linux 或 Git Bash：

~~~bash
cp .env.example .env.local
~~~

Windows PowerShell：

~~~powershell
Copy-Item .env.example .env.local
~~~

### 3. 启动默认 Mock 模式

~~~bash
npm run dev
~~~

该命令会同时启动 Express API 与 Vite 前端。访问终端显示的前端地址，通常为 <http://localhost:5173>。默认 <code>VITE_GENERATION_MODE=mock</code>，页面初始选择 Demo 模式，输入不会离开浏览器。

### 4. 构建

~~~bash
npm run build
~~~

该命令构建前端 <code>dist/</code> 与服务端 <code>dist-server/</code>。可用 <code>npm run preview</code> 预览前端构建结果。

## Ollama AI Mode（默认本机）

默认配置不需要付费 API：新闻主题会发送到本机 Express 服务和 <code>http://localhost:11434</code> 的 Ollama。若修改 <code>OLLAMA_BASE_URL</code>，输入会发送到你配置的地址；请确认该服务可信、连接受到保护，并相应调整隐私判断。

### 1. 安装 Ollama

从 [Ollama 官网](https://ollama.com) 下载并安装适合当前系统的版本。

### 2. 下载默认 Qwen 模型

~~~bash
ollama pull qwen2.5:1.5b
~~~

模型名称不写死在代码中。需要使用其他本地模型时，先执行 <code>ollama pull &lt;模型名&gt;</code>，再修改 <code>OLLAMA_MODEL</code>。

### 3. 启用 QwenProvider

复制 <code>.env.example</code> 为 <code>.env.local</code>，至少修改：

~~~dotenv
GENERATION_MODE=qwen
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
~~~

### 4. 启动 Ollama 和项目

~~~bash
# 终端 1
ollama serve

# 终端 2
npm install
npm run dev
~~~

打开页面后选择“Qwen Agent”并生成。Qwen 会依次执行策划、事实核查和编辑终审。若 Ollama 未启动、模型不存在、返回 JSON 非法或请求失败，应用会给出可操作提示并自动降级到 Demo；JSON 解析失败会先自动重试一次。

### 支持哪些模型

默认模型是已完成真实链路验证、对普通电脑更友好的 <code>qwen2.5:1.5b</code>。如果设备内存充足并希望获得更好的策划质量，可改用 <code>qwen3:8b</code>。也支持其他已安装、能够遵循所提供 JSON Schema 的 Ollama 聊天模型；只需修改 <code>OLLAMA_MODEL</code>，无需改代码。模型实际可用性取决于 Ollama 版本、模型能力和本机内存。

## 环境配置

<code>.env.example</code> 只包含安全示例和空密钥。复制后按运行模式修改 <code>.env.local</code> 或 <code>.env</code>，不要提交这些本地文件。

### 服务端 Mock API

~~~dotenv
GENERATION_MODE=mock
~~~

启动开发环境：

~~~bash
npm run dev
~~~

前端经 Vite 开发代理请求 <code>http://127.0.0.1:8787/api/generate</code>。该模式用于验证完整 API 链路，不需要 API Key。

### 可选 OpenAI Provider

~~~dotenv
GENERATION_MODE=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
~~~

<code>OPENAI_API_KEY</code> 仅由服务端 <code>server/config.ts</code> 读取。不要创建 <code>VITE_OPENAI_API_KEY</code>，也不要给任何秘密加 <code>VITE_</code> 前缀；Vite 会把这类变量暴露给浏览器构建。

### 可选实时 Search

~~~dotenv
SEARCH_MODE=brave
BRAVE_SEARCH_API_KEY=
BRAVE_SEARCH_TIMEOUT_MS=10000
~~~

Brave 密钥只由服务端读取。启用后，系统把自动生成的检索词发送到 Brave Search API；返回的标题、URL 和摘要仅作为待核验线索，不会被直接标记为事实。

### 环境变量参考

| 变量 | 默认值 | 读取位置 | 说明 |
| --- | --- | --- | --- |
| <code>VITE_GENERATION_MODE</code> | <code>mock</code> | 浏览器 | <code>mock</code> 在生产构建中不探测后端并使用 Demo；<code>local-ai</code> 会健康检查 AI 后端，可用后默认选中 AI，不可用时回到 Demo；兼容旧值 <code>api</code>。 |
| <code>VITE_API_PROXY_TARGET</code> | <code>http://127.0.0.1:8787</code> | Vite 开发服务器 | 本地开发 API 代理地址，不得包含密钥。 |
| <code>VITE_API_TIMEOUT_MS</code> | <code>120000</code> | 浏览器 | API 请求超时，默认覆盖本地模型首次加载时间；超时后降级到本地 Mock。 |
| <code>GENERATION_MODE</code> | <code>mock</code> | 服务端 | <code>mock</code>、<code>qwen</code>、<code>ollama</code> 或 <code>openai</code>；其他值按 <code>mock</code> 处理。 |
| <code>SERVER_HOST</code> | <code>127.0.0.1</code> | 服务端 | Generator Service 监听地址。 |
| <code>SERVER_PORT</code> | <code>8787</code> | 服务端 | Generator Service 监听端口。 |
| <code>OLLAMA_BASE_URL</code> | <code>http://localhost:11434</code> | 服务端 | 本机 Ollama REST API 地址。 |
| <code>OLLAMA_MODEL</code> | <code>qwen2.5:1.5b</code> | 服务端 | 已验证的轻量默认模型；可按设备能力替换。 |
| <code>OLLAMA_TIMEOUT_MS</code> | <code>90000</code> | 服务端 | 单次本地模型请求超时，单位毫秒。 |
| <code>SEARCH_MODE</code> | <code>mock</code> | 服务端 | <code>mock</code> 只使用内置知识库；<code>brave</code> 启用实时 Search。 |
| <code>BRAVE_SEARCH_API_KEY</code> | 未设置 | 服务端 | BraveSearchProvider 使用；不得进入浏览器或仓库。 |
| <code>BRAVE_SEARCH_TIMEOUT_MS</code> | <code>10000</code> | 服务端 | 单次 Brave Search 请求超时。 |
| <code>OPENAI_API_KEY</code> | 未设置 | 服务端 | 仅 OpenAIProvider 使用；缺失时服务端降级到 MockProvider。 |
| <code>OPENAI_MODEL</code> | <code>gpt-5.6-terra</code> | 服务端 | Responses API 模型名称。 |
| <code>OPENAI_TIMEOUT_MS</code> | <code>30000</code> | 服务端 | 单次 OpenAI 请求超时，单位毫秒。 |

## Structured Outputs 与降级链路

Qwen/OllamaProvider 调用 <code>POST /api/chat</code>，OpenAIProvider 使用 Responses API。每个 AI Provider 都按策划、事实核查、编辑终审执行三次独立 Structured Output 调用；主题分析、新闻价值评分和 Rules Engine 仍由程序确定性执行。

服务端执行多层校验：

1. <code>POST /api/generate</code> 的 <code>BriefInput</code> 必须满足输入 Schema；额外字段和超长内容会被拒绝。
2. Search 结果只接受 HTTP/HTTPS 来源地址，并与内置知识库合并为最多 16 条可追溯证据。
3. 策划、事实/风险审核、编辑终审分别通过独立 JSON Schema；三个角度必须依次为 <code>people</code>、<code>system</code>、<code>trend</code>。
4. 合并后的 <code>GenerationResult</code> 必须包含六维评分、规则、检索证据、Agent 轨迹和完整策划清单，并再次通过服务端与浏览器校验。

降级顺序：

1. Ollama JSON 解析失败时自动重新请求一次。
2. Qwen/Ollama/OpenAI 任一 Agent 调用失败、超时、拒绝、JSON 非法、结构非法、模型缺失或缺少配置时，<code>GeneratorService</code> 切换到完整 Mock 三 Agent 工作流。
3. Brave Search 不可用时保留内置知识库并明确标记检索降级。
4. 浏览器无法访问服务端、请求超时、收到非 2xx 或无效 <code>GenerationResult</code> 时，前端切换到浏览器本地 Demo。

## API

### <code>POST /api/generate</code>

请求示例：

~~~json
{
  "topic": "校园夜间照明",
  "reportType": "深度报道",
  "audience": "高校学生",
  "scope": "校内",
  "background": "关注安全、能耗与学生体验"
}
~~~

成功时返回 <code>GenerationResult</code>。输入 JSON 或 Schema 不合法时返回 <code>400</code>；请求体超过 32 KiB 时返回 <code>413</code>；非 JSON Content-Type 返回 <code>415</code>；触发单进程请求窗口或并发上限时返回 <code>429</code>。响应包含 <code>Cache-Control: no-store</code>。

### <code>GET /api/health</code>

返回当前配置的主 Provider、降级 Provider 与 Search Provider 名称，不探测上游模型，也不返回密钥。

## 构建与测试

~~~bash
# 前端与服务端生产构建
npm run build

# Schema、Provider、降级、客户端适配器和 HTTP API 测试
npm test

# 运行已构建的服务端
npm run start:server

# 预览前端构建
npm run preview
~~~

## Deployment

仓库已提供 [`vercel.json`](vercel.json)，并固定使用以下构建设置：

- Framework：Vite
- Install Command：`npm ci`
- Build Command：`npm run build`
- Output Directory：`dist`

当前 GitHub 仓库已连接 Vercel；变更合并到 `main` 后会自动触发 Production 部署。Vercel 配置还会为所有静态响应添加 CSP、防嵌入、MIME 嗅探保护、Referrer Policy 与 Permissions Policy。

使用 Vercel Dashboard 导入本仓库，或在项目根目录执行：

~~~bash
npm install -g vercel
vercel
~~~

公开演示建议在 Vercel 的 Production 环境中设置：

~~~dotenv
VITE_GENERATION_MODE=mock
~~~

该变量不是秘密；它选择浏览器本地 Demo，仍会展示知识库与三 Agent 工作流，但不会实时联网或调用模型。不要在 Vercel 的前端环境中配置 `OPENAI_API_KEY`、`BRAVE_SEARCH_API_KEY`，也不要创建任何带 `VITE_` 前缀的秘密。真实 Provider 必须由独立受保护的服务端使用 Secret 调用。

## 项目结构

~~~text
NewsPilot AI/
├── .github/
│   ├── ISSUE_TEMPLATE/           # Bug、建议与安全报告入口
│   ├── workflows/build.yml       # 测试、审计与生产构建
│   ├── dependabot.yml            # 每周非破坏性依赖更新
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/                         # 截图与作品集文档
├── knowledge/
│   ├── 新闻价值理论.ts           # 六维新闻价值方法
│   ├── 优秀报道案例.ts           # 报道结构摘要，不含完整新闻
│   ├── 采访策略.ts               # 教育、政策、消费、技术采访规则
│   └── 知识库.ts                 # 轻量 RAG 检索与排序
├── prompts/
│   ├── 新闻编辑提示词.ts         # 新闻策划 Agent
│   ├── 事实核查提示词.ts         # 事实与风险审核 Agent
│   └── 新闻编辑终审提示词.ts     # 新闻编辑 Agent
├── rules/
│   └── 新闻规则.ts               # 类型安全的确定性新闻规则
├── server/
│   ├── providers/                # Mock、Qwen、Ollama、OpenAI Provider
│   ├── search/                   # Mock 与 Brave Search Provider
│   ├── routes/                   # Express /api/generate 路由
│   ├── services/                 # Agent 工作流、检索服务、Ollama 客户端与降级
│   ├── tests/                    # Schema、Provider、API 与客户端适配测试
│   ├── types/                    # 服务端共享类型出口
│   ├── app.ts                    # Express 应用与请求边界
│   ├── config.ts                 # 服务端环境配置
│   └── index.ts                  # Node.js 服务入口
├── shared/
│   ├── generation.ts            # 共享类型与 JSON Schema
│   ├── 新闻方法论.ts             # 主题分析与六维新闻价值评分
│   ├── 新闻工作流.ts             # 方法论与 Provider 草案合并
│   ├── 本地检索.ts               # 浏览器本地知识库上下文
│   ├── mockAgents.ts            # 同构确定性三 Agent
│   └── mockGeneration.ts        # 共享 Mock 内容生成
├── src/
│   ├── components/               # React 界面组件
│   ├── services/                 # 客户端生成模式与 API 适配器
│   ├── utils/                    # Markdown、复制等工具
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── .editorconfig                 # 编辑器基础格式约定
├── .env.example
├── CONTRIBUTING.md
├── CHANGELOG.md
├── SECURITY.md
├── package.json
└── README.md
~~~

## 部署边界

### Vercel / GitHub Pages：静态 Demo

- 使用 <code>VITE_GENERATION_MODE=mock</code> 构建，将 <code>dist/</code> 部署到静态托管平台。
- 生产 Mock 构建不会请求 <code>/api/health</code>，静态托管控制台不会产生该接口的预期 404。
- Vercel 或 GitHub Pages 只能托管当前前端静态产物，不能直接运行仓库中的常驻 Node.js HTTP 服务。
- Vite 已使用相对资源基路径 <code>./</code>，可部署到 GitHub Pages 仓库子路径；自定义域名也可直接使用同一静态产物。
- 静态 Demo 展示完整 V1.0 方法论、知识库和三 Agent 界面，但不会执行实时 Search 或真实 LLM 调用；输入不上传，适合作品集演示。

### API 模式：独立 Node.js 服务

- 单独部署 <code>dist-server/server/index.js</code>，并让前端的同源 <code>/api</code> 通过反向代理或网关转发到该服务。
- 当前服务默认监听 <code>127.0.0.1</code>，内置基础的单进程请求窗口和并发上限，但没有账号、鉴权、分布式配额或生产监控。
- 公网部署仍必须在网关层增加 TLS、访问控制、按身份分布式限流、成本保护、日志脱敏和健康检查访问策略。
- 真实密钥只放在服务端 Secret；不得进入前端环境变量、静态构建、日志或仓库。

## 内容与隐私边界

- 生成结果不是已完成的采访、调查或事实结论。
- 本地 Demo 不发送用户输入；Qwen/Ollama 会把输入发送到项目后端和 <code>OLLAMA_BASE_URL</code> 指向的服务（默认均在本机）；OpenAI 模式会发送给 OpenAI API。
- 启用 <code>SEARCH_MODE=brave</code> 后，自动生成的检索词会发送给 Brave Search API；不要在主题中填写无关个人信息或未公开材料。
- 应用不持久化输入，OpenAI 请求设置 <code>store=false</code>；仍不要填写无关的电话、身份证号、学号或其他敏感个人信息。
- 项目目前不提供账号、权限、数据库、多租户隔离或正式发布流程。

## Roadmap

### 已完成

- [x] MVP 界面
- [x] Mock 生成
- [x] AI Provider 架构
- [x] Markdown Export
- [x] OpenAI Structured Outputs、Ajv 校验与双层降级
- [x] Ollama / Qwen 本地推理、严格 JSON 与自动降级
- [x] 服务端、客户端与导出安全测试
- [x] GitHub Actions 测试与构建工作流
- [x] V0.2 主题分析与六维新闻价值评分
- [x] V0.2 Prompt Engine 与 Rules Engine
- [x] V0.2 方法论驱动的新闻策划报告
- [x] V0.3 新闻策略 Knowledge Base
- [x] V0.3 Search + RAG 与 BraveSearchProvider
- [x] V0.4 新闻策划、事实核查/风险审核、新闻编辑三 Agent
- [x] V1.0 完整新闻 AI Agent、证据面板和审核报告

### 未来

- [ ] 账号、项目历史与多人协作
- [ ] 生产级鉴权、分布式限流、成本预算和监控
- [ ] 可插拔向量数据库与更大规模的授权案例库
- [ ] 记者人工确认、证据归档和发布审批工作流

## 参与贡献与安全

- 贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 安全问题报告方式见 [SECURITY.md](SECURITY.md)。
- 版本记录见 [CHANGELOG.md](CHANGELOG.md)。
- GitHub 已提供结构化 Issue 表单、Pull Request 检查清单和每周 Dependabot 小版本/补丁更新；主版本升级需单独评估。

## 官方参考

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Models](https://developers.openai.com/api/docs/models)
- [OpenAI API Key 安全最佳实践](https://help.openai.com/en/articles/5112595-best-practices-for-api-key)
- [Brave Search API Authentication](https://api-dashboard.search.brave.com/documentation/guides/authentication)

## License

本项目采用 [MIT License](LICENSE)。
