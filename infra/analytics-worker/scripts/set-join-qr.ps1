<#
 Upload a new WeChat group QR to the live site (no deploy, no git).
 Usage:
   pwsh set-join-qr.ps1 -Image C:\path\qr.jpg -Expires 2026-10-20
   pwsh set-join-qr.ps1 -Clear            # hide the QR (page falls back to the email prompt)
 The Bearer token is read from a file outside the repo (default: %USERPROFILE%\secrets\stats-token.txt).
#>
param(
  [string]$Image,
  [string]$Expires,
  [string]$Name = '',
  [switch]$Clear,
  [string]$TokenFile = "$env:USERPROFILE\secrets\stats-token.txt",
  [string]$Base = 'https://www.alpha-wealth-lab.com'
)
$ErrorActionPreference = 'Stop'
$token = (Get-Content $TokenFile -Raw).Trim()
$headers = @{ Authorization = "Bearer $token" }
if ($Clear) {
  $body = '{"clear":true}'
} else {
  if (-not $Image -or -not $Expires) { throw 'Need -Image and -Expires (YYYY-MM-DD), or -Clear.' }
  $bytes = [IO.File]::ReadAllBytes($Image)
  if ($bytes.Length -gt 400KB) { throw "Image is $([int]($bytes.Length/1KB)) KB; max is 400 KB. Re-save it smaller." }
  $b64 = [Convert]::ToBase64String($bytes)
  $body = @{ img = $b64; expires = $Expires; name = $Name } | ConvertTo-Json -Compress
}
$r = Invoke-RestMethod -Method Post -Uri "$Base/api/admin/join" -Headers $headers -ContentType 'text/plain' -Body $body
$r | ConvertTo-Json
if (-not $Clear) { "Check: $Base/join/ (may take up to 60 s to refresh)" }
