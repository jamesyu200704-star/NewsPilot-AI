# 搜索与来源安全

## URL 获取

`SourceFetcher` 只接受 HTTP/HTTPS，拒绝 URL 用户名密码、本机、内网、链路本地、云元数据、CGNAT、多播和内部域名。DNS 解析结果会检查；生产抓取固定连接已验证的 IP，并保留原始 Host/TLS SNI，降低检查后再次解析造成的 DNS rebinding 风险。每次重定向都重新解析并验证目标，最多三次。

响应限制为 HTML/XHTML/纯文本，默认最大 2 MB、10 秒超时。正文提取会去除 script、style、iframe、object、embed、SVG、canvas、导航、表单和隐藏块。系统不会绕过登录、付费墙、验证码或访问控制。

## API 边界

- 证据接口要求固定客户端头、严格字段白名单、每 IP 单进程速率限制与网页抓取并发上限；过期限流记录与搜索、页面、材料解析缓存均有容量上限。
- 浏览器看不到 SearXNG 内部地址。
- 实时搜索失败回退 Manual，不回退 Mock。
- 搜索摘要保存为 `metadata_only / lead_only`，引用完整性校验拒绝其成为证据。
- 外链使用 `noopener noreferrer`。

## Prompt injection

网页和文件均为不可信数据。进入模型前使用 `<UNTRUSTED_SOURCE>` 边界，并声明内容不能改变规则、调用工具、索取配置或决定核实状态。环境变量、密钥和内部提示词不会拼入来源上下文。

当前 API 没有用户账号、强鉴权、分布式限流或 TLS，不能直接作为匿名公共搜索代理。
