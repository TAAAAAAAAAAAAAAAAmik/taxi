$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectPath = Split-Path -Parent $ScriptDir
$DesignPath = Join-Path $ProjectPath "project-brain\design-learning"
$PromptPath = Join-Path $DesignPath "24_daily_codex_design_prompt.md"
$LogPath = Join-Path $DesignPath "codex_learning_log.txt"

New-Item -ItemType Directory -Force -Path $DesignPath | Out-Null

if (!(Test-Path $PromptPath)) {
    "ERROR: Prompt file not found: $PromptPath" | Out-File -FilePath $LogPath -Append -Encoding UTF8
    exit 1
}

Set-Location $ProjectPath

$Prompt = Get-Content $PromptPath -Raw -Encoding UTF8

"===== START $(Get-Date) =====" | Out-File -FilePath $LogPath -Append -Encoding UTF8

codex.cmd exec -s workspace-write $Prompt 2>&1 | Out-File -FilePath $LogPath -Append -Encoding UTF8

"===== END $(Get-Date) =====" | Out-File -FilePath $LogPath -Append -Encoding UTF8
