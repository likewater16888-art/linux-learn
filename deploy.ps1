<#
  deploy.ps1 - publish this folder to GitHub Pages, driven by publish.config.json
  ---------------------------------------------------------------------------
  Examples:
    .\deploy.ps1                                  # use gh (logged in) or $env:GH_TOKEN
    .\deploy.ps1 -Owner yourname                  # state the account explicitly
    .\deploy.ps1 -Repo my-site -Message "feat: x"
    .\deploy.ps1 -Mode new                        # one project = one new repository (default)
    .\deploy.ps1 -Mode existing -Subdir demos/foo # put this folder INTO an existing repo subdir
    .\deploy.ps1 -Mode existing -Repo my-hub -Subdir sites/foo
    .\deploy.ps1 -DryRun                          # everything except push / pages
    .\deploy.ps1 -Force                           # overwrite remote history
    .\deploy.ps1 -Private                         # private repo (needs Pro for Pages)

  Modes:
    new        create/ensure repo <owner>/<repo>, push this folder as the repo root
    existing   reuse an existing repo; with -Subdir the folder is copied to that
               subdirectory (other files in the repo are left untouched)

  Notes:
    * repo name: -Repo  >  publish.config.json repo.name  >  folder name (slugified)
    * The token is never written to disk or to the git remote URL.
    * Requires: git.  Optional but recommended: gh (GitHub CLI, `gh auth login`).
#>
[CmdletBinding()]
param(
  [string]$Owner,
  [string]$Repo,
  [string]$Branch,
  [string]$Message,
  [ValidateSet('', 'new', 'existing')][string]$Mode,
  [string]$Subdir,
  [string]$RemoteBase = 'https://github.com',
  [string]$Token = $env:GH_TOKEN,
  [string]$Email,
  [switch]$Private,
  [switch]$Force,
  [switch]$DryRun,
  [switch]$SkipPages,
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

# turn any folder name into a legal GitHub repo name
function ConvertTo-Slug {
  param([string]$Text)
  $t = ('' + $Text).ToLowerInvariant()
  $t = $t -replace '[^a-z0-9._-]+', '-'
  $t = $t -replace '-{2,}', '-'
  $t = $t.Trim('-', '.', '_')
  if ($t.Length -gt 64) { $t = $t.Substring(0, 64).Trim('-', '.', '_') }
  if (-not $t) { $t = 'site-' + (Get-Date -Format 'yyyyMMdd') }
  return $t
}

# extra args that authenticate https git calls when only a token is available
function Get-AuthGitArgs {
  if ($Token -and -not $ghOk) {
    $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$Token"))
    return @('-c', ("http.https://github.com/.extraheader=AUTHORIZATION: basic " + $basic))
  }
  return @()
}

# copy this folder into <SubDir> of an existing repo and push (history is kept)
function Push-Subdir {
  param([string]$RemoteUrl, [string]$Branch, [string]$SubDir, [string]$CommitMsg, [string]$WorkDir)

  $tmp = Join-Path $env:TEMP ('publish-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
  $auth = Get-AuthGitArgs
  $cl = Invoke-Exe 'git' ($auth + @('clone', '-q', $RemoteUrl, $tmp))
  if ($cl.code -ne 0) {
    # brand-new (empty) repository: start a fresh work tree and attach the remote
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    $null = Invoke-Exe 'git' @('-C', $tmp, 'init', '-q', '-b', $Branch)
    $null = Invoke-Exe 'git' @('-C', $tmp, 'remote', 'add', 'origin', $RemoteUrl)
  } else {
    # work on the target branch itself, whatever the remote default branch is
    $rb = Invoke-Exe 'git' @('-C', $tmp, 'rev-parse', '--verify', '-q', ('origin/' + $Branch))
    $hd = Invoke-Exe 'git' @('-C', $tmp, 'rev-parse', '--verify', '-q', 'HEAD')
    if ($rb.code -eq 0) {
      $null = Invoke-Exe 'git' @('-C', $tmp, 'checkout', '-q', '-B', $Branch, ('origin/' + $Branch))
    } elseif ($hd.code -eq 0) {
      $null = Invoke-Exe 'git' @('-C', $tmp, 'checkout', '-q', '-B', $Branch, 'HEAD')
    } else {
      $null = Invoke-Exe 'git' @('-C', $tmp, 'checkout', '-q', '--orphan', $Branch)
    }
  }

  $dest = Join-Path $tmp $SubDir
  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
  New-Item -ItemType Directory -Path $dest -Force | Out-Null

  # exactly the files git would publish here (.gitignore respected)
  $files = & git -C $WorkDir ls-files -co --exclude-standard
  $n = 0
  foreach ($f in $files) {
    if (-not $f) { continue }
    $src = Join-Path $WorkDir $f
    if (-not (Test-Path -LiteralPath $src)) { continue }
    $dst = Join-Path $dest $f
    $dir = Split-Path -Parent $dst
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dst -Force
    $n++
  }

  $null = Invoke-Exe 'git' @('-C', $tmp, 'add', '-A')
  $pending = (Invoke-Exe 'git' @('-C', $tmp, 'diff', '--cached', '--name-only')).text
  if ($pending.Trim()) {
    $null = Invoke-Exe 'git' @('-C', $tmp, '-c', ('user.name=' + $Owner), '-c', ('user.email=' + $Email), 'commit', '-q', '-m', $CommitMsg)
  } else {
    Write-Host '    [warn] nothing changed inside ' -NoNewline
    Write-Host $SubDir -NoNewline
    Write-Host ' - skipping commit'
  }

  $res = Invoke-Exe 'git' ($auth + @('-C', $tmp, 'push', 'origin', ('HEAD:' + $Branch)))
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  return @{ code = $res.code; text = $res.text; files = $n }
}


# ---------------------------------------------------------------- 1. read config
Step 'Reading publish.config.json'
$cfgPath = Join-Path $PSScriptRoot 'publish.config.json'
if (-not (Test-Path -LiteralPath $cfgPath)) { Die 'publish.config.json not found in this folder.' }
$cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json

# --- target: a new repository (default) or an existing one (+ optional subdir) ---
if (-not $Mode) { $Mode = $cfg.repo.mode }
if (-not $Mode) { $Mode = 'new' }
if (-not $Subdir) { $Subdir = $cfg.repo.subdir }
if ($Subdir) { $Subdir = (($Subdir -replace '\\', '/').Trim('/')) }
if ($Subdir) { $Mode = 'existing' }

# --- repo name: -Repo  >  publish.config.json repo.name  >  this folder name ---
$nameSrc = 'flag -Repo'
if (-not $Repo) { $Repo = $cfg.repo.name; $nameSrc = 'publish.config.json' }
if (-not $Repo -or $Repo -eq 'auto') { $Repo = (Split-Path -Leaf $PSScriptRoot); $nameSrc = 'folder name' }
$slug = ConvertTo-Slug $Repo
if ($slug -ne $Repo) { Warn ("repo name '{0}' normalised to '{1}' (from {2})" -f $Repo, $slug, $nameSrc) }
$Repo = $slug
if (-not $Branch) { $Branch = $cfg.repo.branch }
if (-not $Branch) { $Branch = 'main' }
if (-not $Message) { $Message = ('{0} publish {1}' -f $cfg.repo.commitPrefix, (Get-Date -Format 'yyyy-MM-dd HH:mm')) }
$entry = $cfg.site.entry
if (-not $entry) { $entry = 'index.html' }
Good ("repo={0}  mode={1}  branch={2}  entry={3}" -f $Repo, $Mode, $Branch, $entry)
if ($Subdir) { Good ('subdir=' + $Subdir + '  (other files in the repo stay untouched)') }

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

$remoteUrl = ('{0}/{1}/{2}.git' -f $RemoteBase.TrimEnd('/'), $Owner, $Repo)
$hasRemote = ((& git remote) -contains 'origin')
if ($hasRemote) { & git remote set-url origin $remoteUrl } else { & git remote add origin $remoteUrl }
Good ('remote origin -> ' + $remoteUrl)

if ($DryRun) { Warn 'DryRun: stop here, nothing was pushed.'; exit 0 }
if (-not ($ghOk -or $Token)) { Warn 'stopped: no credentials. Run `gh auth login` then re-run.'; exit 2 }

# ------------------------------------------------------------ 5. create repo
Step ('Ensuring repository ' + $Owner + '/' + $Repo)
$onGitHub = ($RemoteBase.TrimEnd('/') -eq 'https://github.com')
$hdr = @{
  Authorization          = "Bearer $Token"
  Accept                 = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent'           = 'deploy.ps1'
}
$repoExists = $false

if ($onGitHub) {
  if ($ghOk) {
    $view = Invoke-Exe $gh @('repo', 'view', ("{0}/{1}" -f $Owner, $Repo))
    if ($view.code -eq 0) { $repoExists = $true }
  } elseif ($Token) {
    try {
      $null = Invoke-RestMethod -Uri ("https://api.github.com/repos/{0}/{1}" -f $Owner, $Repo) -Headers $hdr
      $repoExists = $true
    } catch { $repoExists = $false }
  }

  if (-not $repoExists) {
    if ($Mode -eq 'existing') {
      Die ("{0}/{1} does not exist. Create it first, or publish with -Mode new." -f $Owner, $Repo)
    }
    if ($Token -and -not $ghOk) {
      $body = @{
        name        = $Repo
        description = $cfg.repo.description
        private     = [bool]$Private
        auto_init   = $false
      } | ConvertTo-Json
      $null = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Headers $hdr -Method Post -Body $body -ContentType 'application/json'
      Good 'repository created (REST)'
    } else {
      $vis = '--public'
      if ($Private) { $vis = '--private' }
      $created = Invoke-Exe $gh @('repo', 'create', ("{0}/{1}" -f $Owner, $Repo), $vis, ('--description=' + $cfg.repo.description))
      if ($created.code -ne 0) { Write-Host $created.text; Die 'gh repo create failed.' }
      Good 'repository created (gh)'
    }
    $repoExists = $true
  } else {
    Good 'repository already exists - reusing it'
  }
} else {
  Warn ('non-GitHub remote (' + $RemoteBase + '): repository creation skipped')
}

# ---------------------------------------------------------------- 6. push
if ($Subdir) {
  Step ('Publishing folder into ' + $Owner + '/' + $Repo + ':' + $Subdir)
  $res = Push-Subdir -RemoteUrl $remoteUrl -Branch $Branch -SubDir $Subdir -CommitMsg $Message -WorkDir $PSScriptRoot
  if ($res.code -ne 0) { Write-Host $res.text; Die ('push into ' + $Subdir + ' failed.') }
  Good ('pushed {0} file(s) to {1} (other files untouched)' -f $res.files, $Subdir)
  Warn 'local .git still points at the hub repo - always publish through this script'
} else {
  Step ('Pushing to ' + $Branch)
  $pushArgs = @('push', '-u', 'origin', $Branch)
  if ($Force) { $pushArgs += '--force' }
  $pushed = Invoke-Exe 'git' ((Get-AuthGitArgs) + $pushArgs)
  if ($pushed.code -ne 0) {
    Write-Host $pushed.text
    Die 'git push failed. If the remote already has commits, re-run with -Force.'
  }
  Good 'pushed'
}

# --------------------------------------------------------------- 7. pages
if ($onGitHub) {
  $shareUrl = ('https://{0}.github.io/{1}/' -f $Owner.ToLower(), $Repo)
  if ($Subdir) { $shareUrl = ('https://{0}.github.io/{1}/{2}/' -f $Owner.ToLower(), $Repo, $Subdir) }
} else {
  $shareUrl = ('{0}/{1}/{2}/' -f $RemoteBase.TrimEnd('/'), $Owner, $Repo)
}

if ($SkipPages -or -not $onGitHub) {
  Warn 'Pages step skipped (not needed for this target)'
} else {
  Step 'Enabling GitHub Pages'
  $apiPages = ("https://api.github.com/repos/{0}/{1}/pages" -f $Owner, $Repo)
  if ($Token -and -not $ghOk) {
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
    $p = Invoke-Exe $gh @('api', '-X', 'POST', ("repos/{0}/{1}/pages" -f $Owner, $Repo), '-f', ('source[branch]=' + $Branch), '-f', 'source[path]=/')
    if ($p.code -ne 0) {
      $p = Invoke-Exe $gh @('api', '-X', 'PUT', ("repos/{0}/{1}/pages" -f $Owner, $Repo), '-f', ('source[branch]=' + $Branch), '-f', 'source[path]=/')
    }
    if ($p.code -ne 0) { Warn ('Pages setup returned an error: ' + $p.text) } else { Good 'Pages configured (gh)' }
  }
}

# --------------------------------------------------------------- 8. verify
if ($onGitHub) {
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

  if ($cfg.verify) {
    foreach ($u in $cfg.verify) {
      $target = ($u -replace '\{url\}', $shareUrl)
      try {
        $r = Invoke-WebRequest -Uri $target -Method Head -UseBasicParsing -TimeoutSec 20
        Write-Host ('    {0} {1}' -f $r.StatusCode, $target)
      } catch { Write-Host ('    ERR {0}' -f $target) }
    }
  }
}

# ------------------------------------------------------------ 9. write back
if ($cfg.report.writeBackToReadme -and $onGitHub) {
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
    $pubStale = ($pub -notmatch [regex]::Escape($shareUrl))
    if ($pubStale) { $pub = $pub -replace '\| 🌐 公开访问 \|[^\r\n]*', ('| 🌐 公开访问 | ' + $shareUrl + ' |') }
    if ($pubStale) { $pub = $pub -replace '\| 📦 源码仓库 \|[^\r\n]*', ('| 📦 源码仓库 | ' + ($remoteUrl -replace '\.git$', '') + ' |') }
    if ($pubStale) { Set-Content -LiteralPath $pubPath -Value $pub -Encoding UTF8 -NoNewline }
    if ($pubStale) { Write-Host '    PUBLISH.md updated' }
  }
}

Step 'Done'
Write-Host ''
Write-Host ('  MODE      : ' + $Mode + $(if ($Subdir) { ' -> ' + $Subdir } else { '' }))
Write-Host ('  SHARE URL : ' + $shareUrl) -ForegroundColor Green
Write-Host ('  REPO      : ' + ($remoteUrl -replace '\.git$',''))
Write-Host ''
Write-Host '  Re-run this script after every change - the URL never changes.'
