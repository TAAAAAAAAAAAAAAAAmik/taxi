# Точка входа для Планировщика задач Windows.
# Пример: powershell -File run.ps1 plan code   |   ... implement design
param([Parameter(ValueFromRemainingArguments = $true)] $rest)
$ErrorActionPreference = "Continue"

$repo = "C:\Users\TamikFutboler\Desktop\Такси\taxi-partner-app"
$logDir = Join-Path $repo "project-brain\ai-council\_runlogs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$tag = ($rest -join "-")
if (-not $tag) { $tag = "run" }
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$runLog = Join-Path $logDir "$stamp`_$tag.log"

Set-Location $repo
"=== AI council start $stamp ($tag) ===" | Tee-Object -FilePath $runLog
& node "scripts\ai-council\council.mjs" @rest 2>&1 | Tee-Object -FilePath $runLog -Append
"=== AI council end (exit $LASTEXITCODE) ===" | Tee-Object -FilePath $runLog -Append
