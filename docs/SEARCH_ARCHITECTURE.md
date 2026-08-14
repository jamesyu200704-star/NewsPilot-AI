# 搜索架构

NewsPilot P1 将搜索和核实拆成独立、可测试的证据流水线：

```text
ReportingBrief → Claim Extractor → Search Query Planner
→ Manual / Mock / SearXNG Provider → Source Fetcher
→ Content Extractor → Source Classifier → Canonicalizer / Deduplicator
→ Evidence Ledger → Claim–Evidence Linker
→ Verification Rules → Conflict Detector → 带状态的策划案
```

## 信任边界

- 浏览器只向 `/api/evidence/search` 发送用户主动执行的单条 `SearchQuery`。
- SearXNG 地址、超时和搜索配置只存在于服务端。
- Search Provider 返回的是候选线索，不是证据。
- “采纳为证据”会再请求受控的服务端 Fetcher，取得原始页面正文和段落定位。
- 模拟卡没有 URL，不能采纳为证据；搜索摘要只可“保存为线索”。
- 用户粘贴或上传材料在浏览器本地解析，默认不发送给后端或模型。

## Provider

| Provider | 联网 | 用途 | 失败行为 |
| --- | --- | --- | --- |
| Manual | 否 | 手动 URL、文本和本地文件 | 保持手动模式 |
| Mock | 否 | 测试、Vercel 演示 | 明确标记模拟，不能当证据 |
| SearXNG | 是 | 自托管真实搜索 | 回退 Manual，不生成假结果 |

同一规范化搜索词短期缓存 60 秒；结果带获取时间。SearXNG 超时默认 10 秒并重试一次。结果数量上限、频率限制由服务端配置。

## 部署模式

- 纯前端 Demo：Mock + 手动来源 + 本地材料。
- 本地完整模式：React + Express + SearXNG，可选 Ollama/Qwen。
- 线上受控模式：静态前端连接有鉴权、分布式限流和成本保护的独立后端。当前仓库的单进程限流不是公共生产网关。
