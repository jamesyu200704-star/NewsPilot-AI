$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$examplePath = Join-Path $repositoryRoot 'searxng\settings.yml.example'
$settingsPath = Join-Path $repositoryRoot 'searxng\settings.yml'
$placeholder = 'REPLACE_WITH_GENERATED_SECRET'

if (-not (Test-Path -LiteralPath $examplePath -PathType Leaf)) {
  throw "SearXNG example settings not found: $examplePath"
}

if (Test-Path -LiteralPath $settingsPath) {
  throw 'Local searxng/settings.yml already exists; refusing to overwrite its secret.'
}

$template = Get-Content -LiteralPath $examplePath -Raw -Encoding UTF8
if (-not $template.Contains($placeholder)) {
  throw 'Expected placeholder is missing from the example; no settings file was created.'
}

$bytes = New-Object byte[] 32
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($bytes)
$random.Dispose()
$secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })
$content = $template.Replace($placeholder, $secret)
[System.IO.File]::WriteAllText($settingsPath, $content, [System.Text.UTF8Encoding]::new($false))
$secret = $null
$bytes = $null

Write-Output 'Created local searxng/settings.yml. The secret was not printed and the file is Git-ignored.'
