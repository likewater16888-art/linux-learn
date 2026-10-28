<#
  deploy.ps1 - publish this folder to GitHub Pages, driven by publish.config.json
  ---------------------------------------------------------------------------
  Examples:
    .\deploy.ps1                                  # use gh (logged in) or $env:GH_TOKEN
    .\deploy.ps1 -Owner yourname                  # state the account explicitly
    .\deploy.ps1 -Repo my-site -Message "feat: x"
    .\deploy.ps1 -DryRun                          # everything except push / pages
    .\deploy.ps1 -Force                           # overwrite remote history
    .\deploy.ps1 -Private                         # private repo (needs Pro for Pages)

  Notes:
    * The token is never written to disk or to the git remote URL.
    * Requires: git.  Optional but recommended: gh (GitHub CLI, `gh auth login`).
#>
[CmdletBinding()]
param(
  [string]$Owner,
  [string]$Repo,
  [string]$Branch,
  [string]$Message,
  [string]$Token = $env:GH_TOKEN,
  [string]$Email,
  [switch]$Private,
  [switch]$Force,
  [switch]$DryRun,
  [int]$WaitSeconds = 240
)

$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot

function Step([string]$t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Good([string]$t) { Write-Host "    [ok]   $t" -ForegroundColor Green }
function Warn([string]$t) { Write-Host "    [warn] $t" -ForegroundColor Yellow }
function Die([string]$t) { Write-Host "    [fail] $t" -ForegroundColor Red; exit 1 }
function Have([string]$exe) { return [bool](Get-Command $exe -ErrorAction SilentlyContinue) }

# gh may be installed but not on PATH of the current session (fresh install) - probe common spots
function Resolve-Gh {
  $cmd = Get-Command gh -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cands = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\GitHub CLI\bin\gh.exe'),
    (Join-Path $env:ProgramFiles 'GitHub CLI\gh.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'GitHub CLI\gh.exe')
  )
  $winget = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages') -Filter 'gh.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($winget) { $cands += $winget.FullName }
  foreach ($c in $cands) { if ($c -and (Test-Path -LiteralPath $c)) { return $c } }
  return $null
}

# run an external command, capture stdout+stderr, never throw on stderr text
function Invoke-Exe {
  param([string]$Exe, [string[]]$ExeArgs)
  $eap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $lines = & $Exe @ExeArgs 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $eap
  return @{ code = $code; text = (($lines | ForEach-Object { "$_" }) -join "`n") }
}


# ---------------------------------------------------------------- 1. read config
Step 'Reading publish.config.json'
$cfgPath = Join-Path $PSScriptRoot 'publish.config.json'
if (-not (Test-Path -LiteralPath $cfgPath)) { Die 'publish.config.json not found in this folder.' }
$cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not $Repo) { $Repo = $cfg.repo.name }
if (-not $Branch) { $Branch = $cfg.repo.branch }
if (-not $Branch) { $Branch = 'main' }
if (-not $Message) { $Message = ('{0} publish {1}' -f $cfg.repo.commitPrefix, (Get-Date -Format 'yyyy-MM-dd HH:mm')) }
$entry = $cfg.site.entry
if (-not $entry) { $entry = 'index.html' }
Good ("repo={0}  branch={1}  entry={2}" -f $Repo, $Branch, $entry)

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $entry))) {
  Die ("entry file '{0}' not found - the site root must contain it." -f $entry)
}

# --------------------------------------------------------------- 2. preflight
Step 'Preflight checks'
if (-not (Have 'git')) { Die 'git not found. Install Git for Windows first.' }
Good ('git ' + (& git --version))

$ghOk = $false
$gh = Resolve-Gh
if ($gh) {
  & $gh auth status *> $null
  if ($LASTEXITCODE -eq 0) { $ghOk = $true }
}
if ($ghOk) { Good ('gh CLI is logged in (' + $gh + ')') }
elseif ($gh) { Warn ('gh found but not logged in: ' + $gh + ' auth login') }
elseif ($Token) { Good 'using GH_TOKEN from environment' }
else { Warn 'no gh and no GH_TOKEN - only local commit will be possible' }

# secret scan (very small, on purpose)
$patterns = 'sk-[A-Za-z0-9]{16,}', 'ghp_[A-Za-z0-9]{20,}', 'github_pat_[A-Za-z0-9_]{20,}'
$hits = @()
Get-ChildItem -Recurse -File -Include *.js, *.html, *.json, *.md |
  Where-Object { $_.FullName -notmatch '\\\.git\\' } |
  ForEach-Object {
    $f = $_
    foreach ($p in $patterns) {
      if (Select-String -LiteralPath $f.FullName -Pattern $p -Quiet) { $hits += ($f.Name + ' ~ ' + $p) }
    }
  }
if ($hits.Count -gt 0) { Die ("hard-coded secret looking string found: " + ($hits -join '; ')) }
Good 'no hard-coded secrets found'

# ------------------------------------------------------------ 3. repo identity
if (-not $Owner) {
  if ($ghOk) { $Owner = (& $gh api user --jq .login) }

  elseif ($Token) {
    $h = @{ Authorization = "Bearer $Token"; 'User-Agent' = 'deploy.ps1' }
    try { $Owner = (Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $h).login }
    catch { Warn ('cannot resolve account from token: ' + $_.Exception.Message) }
  }
}
if (-not $Owner) { Die 'unknown GitHub account. Run `gh auth login`, or pass -Owner <name>.' }
if (-not $Email) { $Email = ('{0}@users.noreply.github.com' -f $Owner) }
Good ("account={0}  email={1}" -f $Owner, $Email)


# ------------------------------------------------------- 4. git init / commit
Step 'Preparing local repository'
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.git'))) {
  & git init -b $Branch *> $null
  if ($LASTEXITCODE -ne 0) { & git init *> $null; & git checkout -b $Branch *> $null }
  Good 'git init'
} else { Good 'existing .git reused' }

& git config user.name $Owner
& git config user.email $Email
& git symbolic-ref HEAD ('refs/heads/' + $Branch) *> $null

$null = & git add -A
$staged = (& git diff --cached --name-only)
if ($staged) {
  & git commit -q -m $Message
  if ($LASTEXITCODE -ne 0) { Die 'git commit failed (check user.name / user.email).' }
  Good ('committed {0} file(s)' -f @($staged).Count)
} else {
  Warn 'nothing to commit - tree already matches HEAD'
}

$remoteUrl = ('https://github.com/{0}/{1}.git' -f $Owner, $Repo)
$hasRemote = ((& git remote) -contains 'origin')
if ($hasRemote) { & git remote set-url origin $remoteUrl } else { & git remote add origin $remoteUrl }
Good ('remote origin -> ' + $remoteUrl)

if ($DryRun) { Warn 'DryRun: stop here, nothing was pushed.'; exit 0 }
if (-not ($ghOk -or $Token)) { Warn 'stopped: no credentials. Run `gh auth login` then re-run.'; exit 2 }

# ------------------------------------------------------------ 5. create repo
Step ('Ensuring repository ' + $Owner + '/' + $Repo)
$hdr = @{
  Authorization          = "Bearer $Token"
  Accept                 = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent'           = 'deploy.ps1'
}
if ($Token) {
  $repoExists = $false
  try {
    $null = Invoke-RestMethod -Uri ("https://api.github.com/repos/{0}/{1}" -f $Owner, $Repo) -Headers $hdr
    $repoExists = $true
  } catch { $repoExists = $false }
  if (-not $repoExists) {
    $body = @{
      name        = $Repo
      description = $cfg.repo.description
      private     = [bool]$Private
      auto_init   = $false
    } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Headers $hdr -Method Post -Body $body -ContentType 'application/json'
    Good 'repository created (REST)'
  } else { Good 'repository already exists' }
}
if ($ghOk) {
  & $gh repo view ("{0}/{1}" -f $Owner, $Repo) *> $null
  if ($LASTEXITCODE -ne 0) {
    $vis = '--public'
    if ($Private) { $vis = '--private' }
    & $gh repo create ("{0}/{1}" -f $Owner, $Repo) $vis ('--description=' + $cfg.repo.description) *> $null
    if ($LASTEXITCODE -ne 0) { Die 'gh repo create failed.' }
    Good 'repository created (gh)'
  } else { Good 'repository already exists (gh)' }
}

# ---------------------------------------------------------------- 6. push
Step ('Pushing to ' + $Branch)
$pushArgs = @('push', '-u', 'origin', $Branch)
if ($Force) { $pushArgs += '--force' }
if ($Token -and -not $ghOk) {
  $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$Token"))
  $pushed = Invoke-Exe 'git' (@('-c', ("http.https://github.com/.extraheader=AUTHORIZATION: basic " + $basic)) + $pushArgs)
} else {
  $pushed = Invoke-Exe 'git' $pushArgs
}
if ($pushed.code -ne 0) {
  Write-Host $pushed.text
  Die 'git push failed. If the remote already has commits, re-run with -Force.'
}
Good 'pushed'

# --------------------------------------------------------------- 7. pages
Step 'Enabling GitHub Pages'
$apiPages = ("https://api.github.com/repos/{0}/{1}/pages" -f $Owner, $Repo)
if ($Token) {
  $pageBody = @{ source = @{ branch = $Branch; path = '/' } } | ConvertTo-Json -Depth 4
  $exists = $false
  try { $null = Invoke-RestMethod -Uri $apiPages -Headers $hdr; $exists = $true } catch { $exists = $false }
  if ($exists) {
    $null = Invoke-RestMethod -Uri $apiPages -Headers $hdr -Method Put -Body $pageBody -ContentType 'application/json'
    Good 'Pages updated (REST)'
  } else {
    $null = Invoke-RestMethod -Uri $apiPages -Headers $hdr -Method Post -Body $pageBody -ContentType 'application/json'
    Good 'Pages created (REST)'
  }
} elseif ($ghOk) {
  & $gh api -X POST ("repos/{0}/{1}/pages" -f $Owner, $Repo) -f "source[branch]=$Branch" -f 'source[path]=/' *> $null
  if ($LASTEXITCODE -ne 0) {
    & $gh api -X PUT ("repos/{0}/{1}/pages" -f $Owner, $Repo) -f "source[branch]=$Branch" -f 'source[path]=/' *> $null
  }
  Good 'Pages configured (gh)'
}

# --------------------------------------------------------------- 8. verify
$shareUrl = ('https://{0}.github.io/{1}/' -f $Owner.ToLower(), $Repo)
Step ('Waiting for ' + $shareUrl)
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$alive = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri $shareUrl -Method Head -UseBasicParsing -TimeoutSec 20
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { $alive = $true; break }
  } catch { }
  Start-Sleep -Seconds 10
}
if ($alive) { Good 'site is live' } else { Warn 'not live yet - Pages may need another minute.' }

foreach ($u in $cfg.verify) {
  $target = $u.Replace('{url}', $shareUrl)
  try {
    $r = Invoke-WebRequest -Uri $target -Method Head -UseBasicParsing -TimeoutSec 20
    Write-Host ('    {0} {1}' -f $r.StatusCode, $target)
  } catch { Write-Host ('    ERR {0}' -f $target) }

# ------------------------------------------------------------ 9. write back
if ($cfg.report.writeBackToReadme) {
  $readmePath = Join-Path $PSScriptRoot 'README.md'
  if (Test-Path -LiteralPath $readmePath) {
    $readme = Get-Content -LiteralPath $readmePath -Raw -Encoding UTF8
    if ($readme -notmatch [regex]::Escape($shareUrl)) {
      $badge = ('> **在线访问：** ' + $shareUrl)
      $readme = $badge + "`r`n`r`n" + $readme
      Set-Content -LiteralPath $readmePath -Value $readme -Encoding UTF8 -NoNewline
      Write-Host '    README link added'
    }
  }
  $pubPath = Join-Path $PSScriptRoot 'PUBLISH.md'
  if (Test-Path -LiteralPath $pubPath) {
    $pub = Get-Content -LiteralPath $pubPath -Raw -Encoding UTF8
    $pub = $pub -replace '\| 🌐 公开访问 \|[^\r\n]*', ('| 🌐 公开访问 | ' + $shareUrl + ' |')
    $pub = $pub -replace '\| 📦 源码仓库 \|[^\r\n]*', ('| 📦 源码仓库 | https://github.com/' + $Owner + '/' + $Repo + ' |')
    Set-Content -LiteralPath $pubPath -Value $pub -Encoding UTF8 -NoNewline
    Write-Host '    PUBLISH.md updated'
  }
}

Step 'Done'
Write-Host ''
Write-Host ('  SHARE URL : ' + $shareUrl) -ForegroundColor Green
Write-Host ('  REPO      : https://github.com/{0}/{1}' -f $Owner, $Repo)
Write-Host ''
Write-Host '  Re-run this script after every change - the URL never changes.'

}


