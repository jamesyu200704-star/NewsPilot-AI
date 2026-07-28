# 参与贡献

感谢你参与 NewsPilot AI。项目面向新闻学生、校园媒体和初级记者，贡献应保持功能真实、边界清晰，并避免引入不必要的复杂度。

## 开始之前

环境要求：

- Node.js 20.19+ 或 22.12+
- npm
- 支持现代 Web API 的浏览器

安装依赖：

~~~bash
npm install
~~~

准备本地环境文件。任选一种方式：

macOS、Linux 或 Git Bash：

~~~bash
cp .env.example .env.local
~~~

Windows PowerShell：

~~~powershell
Copy-Item .env.example .env.local
~~~

默认 Mock 模式不需要 API Key：

~~~bash
npm run dev
~~~

<code>npm run dev</code> 会同时启动 Express Generator Service 与 Vite 前端。仅调试其中一侧时，可分别使用 <code>npm run dev:server</code> 或 <code>npm run dev:web</code>。

使用本地 AI 模式前，先安装并启动 Ollama，再按 README 设置 <code>GENERATION_MODE=ollama</code>、<code>OLLAMA_BASE_URL</code> 与 <code>OLLAMA_MODEL</code>。不要提交本机模型、Ollama 数据目录或环境文件。

## 提交 Issue

提交前请先搜索现有 Issue，避免重复。

普通问题应包含：

- 清晰的问题描述和预期行为
- 最小复现步骤
- Node.js、浏览器和操作系统版本
- 使用的运行模式：Demo、服务端 Mock、Ollama 或 OpenAI
- 已脱敏的日志、截图或请求示例
- 你愿意提出的解决方向

不要在公开 Issue 中粘贴真实 API Key、令牌、电话、邮箱、身份证号、学号或未授权的采访材料。安全漏洞请按 [SECURITY.md](SECURITY.md) 使用私有报告渠道。

## 提交 Pull Request

1. 从最新代码创建独立分支，不直接向 <code>main</code> 推送。
2. 保持改动单一、范围明确，先修复现有问题再扩展功能。
3. 说明问题、方案、影响范围和验证结果。
4. 逻辑改动应在可行时补充或更新测试。
5. UI 改动应检查桌面端、窄屏布局、键盘焦点和减少动态效果。
6. 配置或文档改动应同步更新 README、示例和安全边界说明。
7. 提交前运行相关测试与构建。

PR 描述建议包含：

- **What**：改了什么
- **Why**：为什么需要
- **How verified**：执行了哪些测试
- **Not verified**：哪些环境或路径尚未验证
- **Screenshots**：仅在 UI 改动时提供，并先移除敏感信息

## 代码规范

- 保持 TypeScript 严格模式，不使用无理由的 <code>any</code>。
- 复用 <code>shared/</code> 中的类型、Schema 和运行时校验，避免前后端规则漂移。
- Provider 输出必须继续满足统一的 <code>GenerationResult</code> 结构。
- 浏览器渲染保持 React 默认转义；引入富文本、外链或 HTML sink 前必须重新评估 XSS。
- 服务端错误响应保持通用，不向客户端返回堆栈、密钥、完整用户输入或上游错误正文。
- 不在前端代码或 <code>VITE_</code> 环境变量中放置秘密。
- 无明确必要不增加大型依赖；新增依赖需说明用途、许可证和运行时影响。
- 保持现有命名、格式、间距、响应式与可访问性风格。
- 不声称项目具备尚未实现的账号、权限、数据库、事实核验或生产部署能力。

## 安全与敏感信息

- 只提交 <code>.env.example</code> 中的空值或明确占位符。
- 不提交 <code>.env</code>、<code>.env.local</code>、真实密钥、令牌或生产配置。
- 测试凭据必须是不可用的合成值，并明确标注为测试数据。
- 测试输入、截图和日志不得包含真实姓名、电话、邮箱、身份证号、学号或未授权素材。
- 如果秘密曾进入提交、日志或构建产物，应立即撤销并轮换；仅从当前文件删除不等于完成处置。
- 公网部署相关改动必须说明鉴权、限流、成本保护、日志脱敏和密钥边界。

## 测试命令

~~~bash
# Schema、Provider、降级、客户端适配器和 HTTP API 测试
npm test

# 前端与服务端生产构建
npm run build

# 仅构建服务端
npm run build:server

# 预览前端生产构建
npm run preview
~~~

至少运行与改动直接相关的命令。提交 PR 时明确写出实际执行结果，不要把未运行的检查标记为通过。

## 文档贡献

- 中文为主，命令和标准技术名词可保留英文。
- 示例必须可以复制执行，并使用占位符代替秘密。
- 截图更新遵循 [docs/SCREENSHOT_GUIDE.md](docs/SCREENSHOT_GUIDE.md)。
- 变更用户可见行为时，在 [CHANGELOG.md](CHANGELOG.md) 的 Unreleased 部分记录。
