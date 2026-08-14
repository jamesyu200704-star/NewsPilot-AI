# SearXNG 搜索配置

## 本地启动

准备 `.env.local`：

```dotenv
VITE_EVIDENCE_MODE=live
SEARCH_PROVIDER=searxng
SEARXNG_BASE_URL=http://localhost:8080
SEARCH_RESULT_LIMIT=10
SEARCH_TIMEOUT_MS=10000
SEARCH_RATE_LIMIT_PER_MINUTE=10
SEARCH_MAX_CONCURRENT_FETCHES=3
```

启动自托管搜索与 NewsPilot：

```powershell
pwsh -File scripts/初始化SearXNG配置.ps1
docker compose -f docker-compose.search.yml up -d
npm run dev
```

健康检查：

```bash
curl "http://127.0.0.1:8080/search?q=campus&format=json"
```

仓库只提交 `searxng/settings.yml.example`。初始化脚本使用系统安全随机数生成本机 `secret_key`，写入被 `.gitignore` 排除的 `searxng/settings.yml`，且不会把值输出到终端。若实际文件已经存在，脚本会停止而不是覆盖。Docker Compose 只将容器端口发布到宿主机 `127.0.0.1:8080`。

`REPLACE_WITH_GENERATED_SECRET` 仅是示例占位符，禁止用于实际实例或公共部署。对外提供服务时必须单独生成 secret，并配置 TLS、身份验证、可信反向代理、分布式限流和日志脱敏；不要直接修改示例文件后提交。

停止服务：

```bash
docker compose -f docker-compose.search.yml down
```

## 公共部署

Vercel 静态演示使用：

```dotenv
VITE_EVIDENCE_MODE=mock
```

Vercel 不运行此 Compose 文件，也不包含 SearXNG。若需要线上搜索，应独立部署 SearXNG 和 Express 后端，并在网关增加身份验证、分布式限流、日志脱敏、TLS 与总成本限制。搜索不可用时 NewsPilot 会回到 Manual，不会生成替代“实时结果”。

配置依据为 [SearXNG 容器安装文档](https://docs.searxng.org/admin/installation-docker) 与 [settings.yml 文档](https://docs.searxng.org/admin/settings/settings.html)。
