# sync-pages.ps1 — 一键同步 main/pages → gh-pages 并部署
# 用法: .\sync-pages.ps1 [-CommitMessage "your message"]
#
# 功能:
#   1. 从 main 分支拉取最新代码（git fetch）
#   2. 用 git archive 提取 main:pages/* 到临时目录
#   3. 复制到 gh-pages 根目录
#   4. 保留 gh-pages 特有的 CNAME（www.alpha-wealth-lab.com）
#   5. 重新生成 i18n-data.js（确保语言键同步）
#   6. 只 commit 指定的文件（不污染 untracked 临时文件）
#   7. push 到 gh-pages
#   8. 提示你去 GitHub 合并 PR

param(
  [string]$CommitMessage = "chore: sync main/pages to gh-pages (auto)"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  sync-pages: main/pages → gh-pages" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 拉取最新 main
Write-Info "Step 1/7: Fetching latest main..."
git fetch origin main

# 2. 确保在 gh-pages 分支
Write-Info "Step 2/7: Checking out gh-pages..."
$CurrentBranch = git branch --show-current
if ($CurrentBranch -ne "gh-pages") {
  git checkout gh-pages
}

# 3. 用 git archive 提取 main:pages/ 到临时目录
Write-Info "Step 3/7: Extracting main:pages/* to temp dir..."
$TempDir = Join-Path $env:TEMP "sync-pages-$(Get-Random)"
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
git archive origin/main pages/ | tar -x -C $TempDir
Write-Info "  ✓ Extracted to $TempDir"

# 4. 清理旧的 pages 目录（如果存在于工作树）
if (Test-Path "pages") {
  Write-Warn "Removing old 'pages/' working tree directory..."
  Remove-Item -Recurse -Force pages
}

# 5. 从临时目录复制到 gh-pages 根目录
Write-Info "Step 4/7: Copying files to gh-pages root..."
New-Item -ItemType Directory -Force -Path "css","js","i18n","assets" | Out-Null

$SourceDir = Join-Path $TempDir "pages"

function Copy-If-Exists($src, $dst) {
  if (Test-Path $src) {
    Copy-Item -Force $src $dst
    Write-Info "  ✓ $dst"
  } else {
    Write-Warn "  ! $src not found (skipping)"
  }
}

Copy-If-Exists (Join-Path $SourceDir "index.html") "index.html"
Copy-If-Exists (Join-Path $SourceDir "404.html") "404.html"
Copy-If-Exists (Join-Path $SourceDir "robots.txt") "robots.txt"
Copy-If-Exists (Join-Path $SourceDir "sitemap.xml") "sitemap.xml"
Copy-If-Exists (Join-Path $SourceDir "llms.txt") "llms.txt"
Copy-If-Exists (Join-Path $SourceDir "ebook.html") "ebook.html"
Copy-If-Exists (Join-Path $SourceDir "css/styles.css") "css/styles.css"
Copy-If-Exists (Join-Path $SourceDir "js/app.js") "js/app.js"
Copy-If-Exists (Join-Path $SourceDir "js/i18n-data.js") "js/i18n-data.js"
Copy-If-Exists (Join-Path $SourceDir "i18n/en.json") "i18n/en.json"
Copy-If-Exists (Join-Path $SourceDir "i18n/zh.json") "i18n/zh.json"

# Assets
if (Test-Path (Join-Path $SourceDir "assets")) {
  $AssetCount = (Get-ChildItem (Join-Path $SourceDir "assets/*")).Count
  Get-ChildItem (Join-Path $SourceDir "assets/*") | ForEach-Object {
    Copy-Item -Force $_.FullName (Join-Path "assets" $_.Name)
  }
  Write-Info "  ✓ assets/* (copied $AssetCount files)"
}

# 清理临时目录
Remove-Item -Recurse -Force $TempDir
Write-Info "  ✓ Temp dir cleaned"

# 6. 重新生成 i18n-data.js
Write-Info "Step 5/7: Regenerating i18n-data.js..."
if (Test-Path "build-i18n.js") {
  node build-i18n.js
}

# 7. 检查是否有变更
Write-Info "Step 6/7: Checking for changes..."
$TrackedChanges = git status --porcelain | Where-Object { $_ -notmatch "^\?\?" }
if ($TrackedChanges -eq $null -or $TrackedChanges.Count -eq 0) {
  Write-Info "No changes detected. gh-pages is already in sync."
  exit 0
}

Write-Host ""
Write-Host "Modified files:" -ForegroundColor Cyan
$TrackedChanges | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# 8. 提交并推送（只 add 指定的文件）
Write-Info "Step 7/7: Committing and pushing..."
$filesToCommit = @("index.html", "404.html", "robots.txt", "sitemap.xml", "llms.txt", "ebook.html", "css/styles.css", "js/app.js", "js/i18n-data.js", "i18n/en.json", "i18n/zh.json")
$existingFiles = $filesToCommit | Where-Object { Test-Path $_ }
if ($existingFiles.Count -gt 0) {
  git add @existingFiles
}
# 如果 assets 有变更，也加入
$assetChanges = git status --porcelain assets/ 2>$null
if ($assetChanges) {
  git add assets/
}

git commit -m $CommitMessage
git push origin gh-pages

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ Done! Changes pushed to gh-pages." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. GitHub Pages will auto-rebuild (~1-2 min)"
Write-Host "  2. Visit https://www.alpha-wealth-lab.com/ to verify"
Write-Host "  3. If you want a PR record:"
Write-Host "     gh pr create --head gh-pages --base main --title `"$CommitMessage`""
Write-Host ""
