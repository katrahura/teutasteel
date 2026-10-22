<#
.SYNOPSIS
  Pulls a whole DeepSeek Harness workspace (project files + chat history) from another
  PC on the same network onto this PC.

.DESCRIPTION
  A DSH "workspace" is two things that must arrive together:
    1. the project folder itself
    2. this PC's .dsh state that makes DSH show it and remember the conversations:
         .dsh\storages\workspace.json                       (the workspace registry)
         .dsh\sessions\<folder>\<session-id>\session.v4.jsonl.zstd   (the transcripts)
         .dsh\storages\session_projcache\sessions\<id>.json (per-chat metadata, holds cwd)
         .dsh\attachments\v1\objects\*                      (files/images pasted into chats)

  Copying the transcripts without the registry entry leaves them invisible in the GUI -
  the script therefore also merges the source workspace entry into your local registry
  (with a timestamped backup) instead of overwriting it.

  Close DeepSeek Harness on BOTH PCs before running the history part. DSH appends to
  session files while running, so copying live files can capture a torn transcript.

.PARAMETER SourceHost
  Name or IP of the other PC, e.g. OTHERPC or 192.168.1.50

.PARAMETER SourceWorkspacePath
  The workspace folder's full path on the other PC, e.g. C:\Projects\mysite
  Read it off that PC: open DSH there, or read %USERPROFILE%\.dsh\storages\workspace.json

.PARAMETER SourceUser
  The Windows user folder name on the other PC, e.g. anna  (for C:\Users\anna\.dsh)

.PARAMETER DestWorkspacePath
  Where to put the project here. Defaults to the SAME absolute path as the source,
  which is what you want: sessions record their cwd, so an identical path means the
  history reattaches with no further fixing.

.PARAMETER DryRun
  Report what would be copied / merged, change nothing.

.EXAMPLE
  # See what would happen first
  .\import-workspace-from-pc.ps1 -SourceHost OTHERPC -SourceWorkspacePath 'C:\Projects\mysite' -SourceUser anna -DryRun

.EXAMPLE
  # Real run, keeping the same folder path
  .\import-workspace-from-pc.ps1 -SourceHost 192.168.1.50 -SourceWorkspacePath 'C:\Projects\mysite' -SourceUser anna
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SourceHost,
    [Parameter(Mandatory)][string]$SourceWorkspacePath,
    [Parameter(Mandatory)][string]$SourceUser,
    [string]$DestWorkspacePath,
    [string]$SourceAdminShare = 'C$',
    [switch]$SkipProjectFiles,
    [switch]$SkipHistory,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Say  { param([string]$m, [string]$c = 'Gray') Write-Host $m -ForegroundColor $c }
function Step { param([string]$m) Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Warn { param([string]$m) Write-Host "  ! $m" -ForegroundColor Yellow }
function Ok   { param([string]$m) Write-Host "  + $m" -ForegroundColor Green }

function Invoke-Robocopy {
    param([string]$From, [string]$To, [string[]]$ExtraArgs = @(), [string]$What)
    $args = @($From, $To, '/E', '/Z', '/R:2', '/W:2', '/NFL', '/NDL', '/NP') + $ExtraArgs
    if ($DryRun) { Say ("  would copy: {0}  ->  {1}" -f $From, $To) -c DarkGray; return }
    & robocopy @args | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $What (exit $LASTEXITCODE)" }
    Ok "$What (robocopy exit $LASTEXITCODE)"
}

function Normalize-Path { param([string]$p) ($p -replace '/', '\').TrimEnd('\').ToLowerInvariant() }

# ---------------------------------------------------------------- paths
$localDsh = Join-Path $HOME '.dsh'
$destPath = if ($DestWorkspacePath) { $DestWorkspacePath } else { $SourceWorkspacePath }
if ($DestWorkspacePath -and ((Normalize-Path $DestWorkspacePath) -ne (Normalize-Path $SourceWorkspacePath))) {
    Warn "destination path differs from the source path."
    Warn "The transcripts still say '$SourceWorkspacePath'. DSH will very likely list them"
    Warn "under the old location, so prefer an identical path, or fix the cwd values later."
}

$srcDsh     = "\\$SourceHost\$SourceAdminShare\Users\$SourceUser\.dsh"
$srcRegPath = Join-Path $srcDsh 'storages\workspace.json'
$dstRegPath = Join-Path $localDsh 'storages\workspace.json'

Step "Checking what is reachable"
Say "  source .dsh : $srcDsh"
Say "  destination : $destPath"
Say "  local .dsh  : $localDsh"

if (-not (Test-Path $srcDsh))                    { throw "Cannot reach $srcDsh. Is the other PC on, the share enabled, and the user name right?" }
if (-not (Test-Path $srcRegPath))                { throw "Found $srcDsh but no storages\workspace.json inside it." }
if (-not (Test-Path $localDsh))                  { throw "No local DSH state at $localDsh - run DSH once on this PC first." }
if (-not (Test-Path $srcDsh\sessions))           { Warn "No sessions folder on the source - there may be no chat history to bring over." }

# ---------------------------------------------------------------- read source registry
Step "Locating the workspace in the source registry"
$srcReg = Get-Content $srcRegPath -Raw | ConvertFrom-Json
$srcWsProp = $srcReg.tables.workspaces.PSObject.Properties |
    Where-Object { (Normalize-Path $_.Value.path) -eq (Normalize-Path $SourceWorkspacePath) } |
    Select-Object -First 1

if (-not $srcWsProp) {
    Say "  Workspaces recorded on the source PC:" -c Yellow
    $srcReg.tables.workspaces.PSObject.Properties | ForEach-Object { Say ("    {0}   {1}" -f $_.Value.path, $_.Name) }
    throw "None of them is '$SourceWorkspacePath'. Re-run with the exact path from the list above."
}

$wsId       = $srcWsProp.Name
$wsRecord   = $srcWsProp.Value
$sessionIds = @($wsRecord.sessionIds)
Ok "workspace id  : $wsId"
Ok "title         : $($wsRecord.title)"
Ok "session count : $($sessionIds.Count)"
if ($sessionIds.Count -eq 0) { Warn "The source workspace has no sessions recorded, so there is no chat history to move." }

# ---------------------------------------------------------------- find session folders
# The sessions folder name is derived from the workspace path, so do not guess it:
# locate the folders that actually contain the session ids we are after.
$sessionFolders = @{}
if (-not $SkipHistory -and $sessionIds.Count -gt 0) {
    Step "Finding the transcript folders"
    foreach ($dir in Get-ChildItem (Join-Path $srcDsh 'sessions') -Directory -ErrorAction SilentlyContinue) {
        foreach ($id in $sessionIds) {
            if (Test-Path (Join-Path $dir.FullName $id)) {
                if (-not $sessionFolders.ContainsKey($dir.Name)) { $sessionFolders[$dir.Name] = @() }
                $sessionFolders[$dir.Name] += $id
            }
        }
    }
    if ($sessionFolders.Count -eq 0) { Warn "No transcript folder on the source holds these session ids." }
    foreach ($k in $sessionFolders.Keys) { Ok "$k  ->  $($sessionFolders[$k].Count) session(s)" }
}

# ---------------------------------------------------------------- check DSH is closed
if (-not $SkipHistory -and -not $DryRun) {
    Step "Checking DeepSeek Harness is closed"
    $running = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
    if ($running) {
        throw "DeepSeek Harness is running on this PC ($($running.Count) process(es)). Close it completely, then run this script again. Copying live session files can corrupt them."
    }
    Ok "not running"
}

# ---------------------------------------------------------------- copy project files
if (-not $SkipProjectFiles) {
    Step "Copying the project files"
    $srcProj = "\\$SourceHost\$SourceAdminShare\$($SourceWorkspacePath -replace '^([A-Za-z]):', '$1$')"
    if (-not (Test-Path $srcProj)) { throw "Cannot read the source folder: $srcProj" }
    if (-not $DryRun) { New-Item -ItemType Directory -Force -Path $destPath | Out-Null }
    Warn "skipping node_modules, .angular, dist (regenerable; run npm ci here instead)"
    Invoke-Robocopy -From $srcProj -To $destPath -What 'project files' `
        -ExtraArgs @('/MT:16', '/XD', 'node_modules', '.angular', 'dist', '/XF', '*.tmp', '*.part')
}

# ---------------------------------------------------------------- copy history
if (-not $SkipHistory) {
    Step "Copying the chat history"
    foreach ($folder in $sessionFolders.Keys) {
        Invoke-Robocopy -From (Join-Path $srcDsh "sessions\$folder") -To (Join-Path $localDsh "sessions\$folder") `
            -What "transcripts: $folder"
    }
    if (Test-Path (Join-Path $srcDsh 'storages\session_projcache\sessions')) {
        Invoke-Robocopy -From (Join-Path $srcDsh 'storages\session_projcache\sessions') `
            -To (Join-Path $localDsh 'storages\session_projcache\sessions') `
            -What 'per-chat metadata' -ExtraArgs @('*.json')
    }
    if (Test-Path (Join-Path $srcDsh 'attachments')) {
        Invoke-Robocopy -From (Join-Path $srcDsh 'attachments') -To (Join-Path $localDsh 'attachments') `
            -What 'pasted attachments'
    }
}

# ---------------------------------------------------------------- merge the registry
Step "Merging the workspace into the local registry"
if ($DryRun) {
    Say "  would add workspace '$($wsRecord.title)' ($wsId) -> $destPath" -c DarkGray
    Say "  would add $($sessionIds.Count) session id(s) to that workspace" -c DarkGray
    Say "  would back up the current registry first" -c DarkGray
    Say "`nDry run only. Nothing was changed." -c Yellow
    return
}

$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$dstRegPath.bak-$stamp"
Copy-Item $dstRegPath $backup -Force
Ok "backup written: $backup"

$dstReg = Get-Content $dstRegPath -Raw | ConvertFrom-Json
$existingIds = @($dstReg.global.workspaceIds)

$targetId = $wsId
if ($dstReg.tables.workspaces.PSObject.Properties.Name -contains $targetId) {
    Warn "workspace id $targetId already exists locally - merging sessions into it"
    $merged = @($dstReg.tables.workspaces.$targetId.sessionIds) + $sessionIds | Select-Object -Unique
    $dstReg.tables.workspaces.$targetId.sessionIds = $merged
    $dstReg.tables.workspaces.$targetId.path = $destPath
} else {
    $entry = [pscustomobject]@{
        path       = $destPath
        title      = $wsRecord.title
        sessionIds = @($sessionIds)
        createdAt  = if ($wsRecord.createdAt) { $wsRecord.createdAt } else { (Get-Date).ToUniversalTime().ToString('o') }
        updatedAt  = (Get-Date).ToUniversalTime().ToString('o')
    }
    $dstReg.tables.workspaces | Add-Member -NotePropertyName $targetId -NotePropertyValue $entry -Force
    Ok "added workspace entry: $targetId"
}

if ($existingIds -notcontains $targetId) {
    $dstReg.global.workspaceIds = @($existingIds + $targetId)
    Ok "added to global.workspaceIds"
}

$utf8 = try { [System.Text.UTF8Encoding]::new($false) } catch { 'utf8' }
$json = $dstReg | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($dstRegPath, $json, $utf8)
Ok "registry written: $dstRegPath"

# ---------------------------------------------------------------- verify
Step "Verifying"
$check = Get-Content $dstRegPath -Raw | ConvertFrom-Json
$have  = @($check.tables.workspaces.PSObject.Properties.Name)
if ($have -contains $targetId) { Ok "registry parses, workspace present" } else { Warn "workspace missing after write - restore $backup" }

$found = 0
foreach ($id in $sessionIds) {
    if (Get-ChildItem (Join-Path $localDsh 'sessions') -Recurse -Directory -Filter $id -ErrorAction SilentlyContinue) { $found++ }
}
Ok "$found of $($sessionIds.Count) session folders present locally"

Say "`nDone." -c Green
Say "Next:"
Say "  1. Start DeepSeek Harness and open the workspace '$($wsRecord.title)'."
Say "  2. The past conversations should be listed. Open one and confirm it resumes."
Say "  3. In the project folder run:  npm ci   (node_modules was not copied on purpose)"
Say "  4. If a chat shows the wrong folder, the path changed - restore $backup and re-run with DestWorkspacePath equal to SourceWorkspacePath."
