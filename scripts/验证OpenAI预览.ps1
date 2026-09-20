param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://[A-Za-z0-9.-]+\.vercel\.app/?$')]
  [string]$DeploymentUrl
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command vercel.cmd -ErrorAction SilentlyContinue)) {
  throw '未找到 Vercel CLI。请先运行 npm install -g vercel 并登录。'
}

$healthRaw = & vercel.cmd curl '/api/health' --deployment $DeploymentUrl -- --silent --show-error 2>$null
if ($LASTEXITCODE -ne 0) {
  throw '无法读取受保护 Preview 的健康检查。'
}

$health = ($healthRaw -join "`n") | ConvertFrom-Json
if (-not $health.ok -or $health.provider -ne 'openai') {
  throw "健康检查未启用 OpenAI Provider：$($healthRaw -join ' ')"
}

$payload = @{
  topic = '校园媒体如何规范使用生成式 AI'
  reportType = '深度报道'
  audience = '高校学生与教师'
  scope = '本校校园'
  background = '受保护 Preview 自动验收；所有事件性事实与数据均保持待采访、待核验。'
} | ConvertTo-Json -Compress

$generationRaw = $payload | & vercel.cmd curl '/api/generate' --deployment $DeploymentUrl -- --silent --show-error --request POST --header 'Content-Type: application/json; charset=utf-8' --data-binary '@-' 2>$null
if ($LASTEXITCODE -ne 0) {
  throw '受保护 Preview 的真实生成请求失败。'
}

$generation = ($generationRaw -join "`n") | ConvertFrom-Json
if ($generation.mode -ne 'openai' -or $generation.fallbackNotice) {
  $notice = if ($generation.fallbackNotice) { $generation.fallbackNotice } else { '无说明' }
  throw "真实生成未通过：mode=$($generation.mode)，fallback=$notice"
}

$trace = @($generation.agentReview.trace)
$invalidTrace = @(
  $trace | Where-Object {
    $_.mode -ne 'openai' -or $_.status -ne 'completed'
  }
)

if ($trace.Count -ne 3 -or $invalidTrace.Count -gt 0) {
  throw '三 Agent 执行轨迹未全部以 OpenAI completed 状态完成。'
}

[pscustomobject]@{
  ok = $true
  provider = $health.provider
  mode = $generation.mode
  fallback = $false
  trace = ($trace | ForEach-Object { "$($_.agent):$($_.mode):$($_.status)" }) -join ','
} | ConvertTo-Json -Compress
