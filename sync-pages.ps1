# sync-pages.ps1 — 智能同步 main/pages → gh-pages（保留 CSP 安全版）
# 用法: .\sync-pages.ps1 [-CommitMessage "your message"]
#
# 智能策略:
#   - 同步: ebook.html, i18n/*.json, sitemap.xml, 404.html, robots.txt, llms.txt, assets/*
#   - 不同步: index.html, js/app.js（gh-pages 已有 CSP 安全版，保留）
#   - 重新生成: js/i18n-data.js（从 i18n/*.json）
#   - 保留: CNAME（www.alpha-wealth-lab.com）

param(
  [string]$CommitMessage = "chore: sync main/pages to gh-pages (smart)"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Skip($msg) { Write-Host "[SKIP] $msg" -ForegroundColor DarkGray }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  sync-pages: main/pages → gh-pages (smart)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 拉取最新 main
Write-Info "Step 1/6: Fetching latest main..."
git fetch origin main

# 2. 确保在 gh-pages 分支
Write-Info "Step 2/6: Checking out gh-pages..."
$CurrentBranch = git branch --show-current
if ($CurrentBranch -ne "gh-pages") {
  git checkout gh-pages
}

# 3. 用 git archive 提取 main:pages/ 到临时目录
Write-Info "Step 3/6: Extracting main:pages/* to temp dir..."
$TempDir = Join-Path $env:TEMP "sync-pages-$(Get-Random)"
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
git archive origin/main pages/ | tar -x -C $TempDir
$SourceDir = Join-Path $TempDir "pages"

# 4. 清理旧的 pages 目录（如果存在于工作树）
if (Test-Path "pages") {
  Remove-Item -Recurse -Force pages
}

# 5. 智能复制（只同步安全的文件）
Write-Info "Step 4/6: Copying files (smart mode)..."

# 同步: 新页面 + 辅助文件
$FilesToSync = @(
  "ebook.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "i18n/en.json",
  "i18n/zh.json"
)

$CopiedCount = 0
foreach ($file in $FilesToSync) {
  $src = Join-Path $SourceDir $file
  $dst = $file
  if (Test-Path $src) {
    # 确保目标目录存在
    $dstDir = Split-Path -Parent $dst
    if ($dstDir -and -not (Test-Path $dstDir)) {
      New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
    }
    Copy-Item -Force $src $dst
    Write-Info "  ✓ $dst"
    $CopiedCount++
  } else {
    Write-Warn "  ! $file not found in main/pages (skipping)"
  }
}

# 同步: assets/*
if (Test-Path (Join-Path $SourceDir "assets")) {
  $AssetCount = (Get-ChildItem (Join-Path $SourceDir "assets/*")).Count
  if (-not (Test-Path "assets")) {
    New-Item -ItemType Directory -Force -Path "assets" | Out-Null
  }
  Get-ChildItem (Join-Path $SourceDir "assets/*") | ForEach-Object {
    Copy-Item -Force $_.FullName (Join-Path "assets" $_.Name)
  }
  Write-Info "  ✓ assets/* (copied $AssetCount files)"
}

# 明确跳过: index.html + js/app.js（保留 gh-pages 的 CSP 安全版）
Write-Skip "  - index.html (keeping gh-pages CSP-safe version)"
Write-Skip "  - js/app.js (keeping gh-pages CSP-safe version)"
Write-Skip "  - js/i18n-data.js (will regenerate from i18n/*.json)"

# 清理临时目录
Remove-Item -Recurse -Force $TempDir
Write-Info "  ✓ Temp dir cleaned"

# 6. 重新生成 i18n-data.js
Write-Info "Step 5/6: Regenerating i18n-data.js..."
if (Test-Path "build-i18n.js") {
  node build-i18n.js
}

# 7. 检查是否有变更
Write-Info "Step 6/6: Checking for changes..."
$TrackedChanges = git status --porcelain | Where-Object { $_ -notmatch "^\?\?" }
if ($TrackedChanges -eq $null -or $TrackedChanges.Count -eq 0) {
  Write-Info "No changes detected. gh-pages is already in sync."
  exit 0
}

Write-Host ""
Write-Host "Modified files:" -ForegroundColor Cyan
$TrackedChanges | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# 8. 提交并推送
Write-Info "Committing and pushing..."
$filesToCommit = @("ebook.html", "404.html", "robots.txt", "sitemap.xml", "llms.txt", "i18n/en.json", "i18n/zh.json", "js/i18n-data.js")
$existingFiles = $filesToCommit | Where-Object { Test-Path $_ }
if ($existingFiles.Count -gt 0) {
  git add @existingFiles
}
if (Test-Path "assets") {
  git add assets/ 2>$null
}

git commit -m $CommitMessage
git push origin gh-pages

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ Done! Changes pushed to gh-pages." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Note: index.html + app.js were NOT synced (keeping CSP-safe versions)."
Write-Host "If you updated index.html/app.js in main, you must manually merge them"
Write-Host "into gh-pages (see the diff) and re-verify CSP safety."
Write-Host ""
