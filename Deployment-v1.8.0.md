# Deployment Guide - v1.8.0

> **Version:** 1.8.0 | **Date:** 2026-09-28 | **Applies to:** One-Click Upgrade (Velopack) Release

---

## Overview

**v1.8.0** is the first one-click upgrade release with program/user data separation. This guide covers:
- **Windows**: Setup.exe installation with full one-click upgrade support
- **Linux**: AppImage deployment with background systemd setup
- **macOS**: Deferred to future release (requires Apple Developer ID)
- **Upgrade Path**: Migrating from v1.6.x / v1.7.x → v1.8.0

---

## Table of Contents

1. [Windows Deployment](#windows-deployment)
2. [Linux Deployment](#linux-deployment)
3. [Upgrading from v1.6.x / v1.7.x](#upgrading-from-v16x--v17x)
4. [User Data Directories](#user-data-directories)
5. [Configuration Files](#configuration-files)
6. [Troubleshooting](#troubleshooting)

---

## Windows Deployment

### Step 1: Download

1. Go to [GitHub Releases](https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases)
2. Find v1.8.0, download **`Setup.exe`** (106 MB)
3. Or download **`Portable.zip`** (99 MB) if you prefer manual folder management

### Step 2: Install

**Option A: Using Setup.exe (Recommended)**

```bash
# Run as regular user (no admin needed)
.\Setup.exe
```

This installs to `%LocalAppData%\QuantInfraNetPro.Web\` with automatic Start Menu shortcut.

**Option B: Using Portable.zip**

```bash
# Extract anywhere, then run directly
Expand-Archive Portable.zip -DestinationPath C:\myapps\Quant
cd C:\myapps\Quant
.\Quant.Infra.Net.Pro.Web.exe
```

### Step 3: Initial Launch

1. Open browser → **https://127.0.0.1:8443**
   - ⚠️ Browser shows "not secure" (self-signed cert, normal for local apps)
   - Click **Advanced** → **Proceed to 127.0.0.1**

2. You'll be redirected to `/start`:
   - **New Users**: Enter email → "Send Verification Link" → verify in inbox → activate trial or enter license
   - **Existing Users**: Skip to [Configuration](#configuration)

### Step 4: Configuration

After license activation, go to **Settings** (`/settings`):

| Field | Required | Example |
|-------|----------|---------|
| License Key | ✓ | `QIF-xxxxxxxx` |
| Email | ✓ | `user@example.com` |
| Schwab App Key | ✓ | Your Client ID |
| Schwab App Secret | ✓ | Your Client Secret |
| Schwab Account Number | ✓ | `123456789` |
| Redirect URI | ✗ | `https://127.0.0.1:8443/signin-oidc` (default) |

Click **Save** → app auto-restarts

### Step 5: Verify Connection

- Dashboard (`/dashboard`) shows:
  - Account total value
  - Positions, real-time quotes
  - Token status (should show "OK")
  - Last refresh timestamp

---

## Linux Deployment

### Step 1: Download

```bash
cd ~/Downloads
wget https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases/download/v1.8.0/Quant.Infra.Net.Pro-1.8.0-x64.AppImage
chmod +x Quant.Infra.Net.Pro-1.8.0-x64.AppImage
```

### Step 2: Run

```bash
./Quant.Infra.Net.Pro-1.8.0-x64.AppImage
```

Then open browser → **https://127.0.0.1:8443**

### Step 3: Optional — Custom Data Directory

By default, user data goes to `~/.config/Quant.Infra.Net.Pro/`. To customize:

```bash
export QUANT_INFRA_DATA_DIR=~/mydata/quant-infra
mkdir -p $QUANT_INFRA_DATA_DIR
./Quant.Infra.Net.Pro-1.8.0-x64.AppImage
```

### Step 4: Optional — Background Service (systemd)

For 24/7 unattended operation, create `/etc/systemd/user/quant-infra.service`:

```ini
[Unit]
Description=Quant.Infra.Net.Pro - Schwab Trading Gateway
After=network.target

[Service]
Type=simple
ExecStart=%h/Downloads/Quant.Infra.Net.Pro-1.8.0-x64.AppImage
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

Environment="QUANT_INFRA_DATA_DIR=%h/.config/Quant.Infra.Net.Pro"

[Install]
WantedBy=default.target
```

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable quant-infra.service
systemctl --user start quant-infra.service

# Check status
systemctl --user status quant-infra.service
journalctl --user -u quant-infra.service -f
```

### Step 5: Configuration

Same as Windows [Step 4](#step-4-configuration).

---

## Upgrading from v1.6.x / v1.7.x

### What Gets Migrated Automatically

When you first run v1.8.0, the **LegacySettingsMigrator** automatically copies these from your old installation:

| Item | From | To |
|------|------|-----|
| License Key | `appsettings.json` | `~/.config/Quant.Infra.Net.Pro/config/appsettings.user.json` |
| License Email | `appsettings.json` | `config/appsettings.user.json` |
| Urls | `appsettings.json` | `config/appsettings.user.json` |
| RedirectUri | `appsettings.json` | `config/appsettings.user.json` |
| Schwab Credentials | (User Secrets) | `~/.microsoft/usersecrets/schwab-web-app-secrets/` |
| Target Portfolio | `Data/rebalance-settings.json` | `~/.config/Quant.Infra.Net.Pro/Data/` |
| Rebalance Trigger | `Data/rebalance-trigger.json` | `~/.config/Quant.Infra.Net.Pro/Data/` |
| EULA Acceptance | `%LOCALAPPDATA%\QuantInfraNetPro\` | `~/.config/Quant.Infra.Net.Pro/` |
| Tokens (OAuth) | `%APPDATA%\Quant.Infra.Net.Pro\` | `~/.config/Quant.Infra.Net.Pro/` |

### Windows: v1.6.3 or v1.7.0 → v1.8.0

1. **Uninstall old version** (optional, not required):
   ```
   Control Panel → Programs → Uninstall a program → Quant.Infra.Net.Pro (1.6.3 or 1.7.0)
   ```

2. **Download and run v1.8.0 Setup.exe** (see [Windows Deployment](#windows-deployment))

3. **First launch** → migration runs automatically
   - Old `appsettings.json` is renamed to `appsettings.json.migrated`
   - Settings appear in Dashboard immediately

4. **Verify** on `/dashboard`:
   - License shows correct email and key
   - Account data loads
   - Token status OK

### Linux: v1.6.3 or v1.7.0 → v1.8.0

If you're upgrading an existing AppImage-based v1.7.0 installation:

```bash
# Stop old instance
killall Quant.Infra.Net.Pro.Web

# Backup old data (optional)
cp -r ~/.config/Quant.Infra.Net.Pro ~/.config/Quant.Infra.Net.Pro.backup-1.7.0

# Download v1.8.0
cd ~/Downloads
wget https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases/download/v1.8.0/Quant.Infra.Net.Pro-1.8.0-x64.AppImage
chmod +x Quant.Infra.Net.Pro-1.8.0-x64.AppImage

# Run new version
./Quant.Infra.Net.Pro-1.8.0-x64.AppImage

# Migration happens automatically on first launch
```

### Fallback: Manual Import

If automatic migration doesn't pick up your old settings:

1. Go to **Settings** (`/settings`)
2. Scroll down to **"Import from Old Version"**
3. Browse to your old installation directory (e.g., `C:\Program Files\Quant.Infra.Net.Pro\`)
4. Check **"Include Schwab credentials"** if needed (off by default for safety)
5. Click **Import**
6. Refresh the page

---

## User Data Directories

### Windows

| Item | Path |
|------|------|
| Config | `%APPDATA%\Quant.Infra.Net.Pro\config\appsettings.user.json` |
| Data | `%APPDATA%\Quant.Infra.Net.Pro\Data\` |
| Certs | `%APPDATA%\Quant.Infra.Net.Pro\certs\` |
| Logs | `%APPDATA%\Quant.Infra.Net.Pro\logs\` |
| Backups | `%APPDATA%\Quant.Infra.Net.Pro\backups\` |
| Tokens | `%APPDATA%\Quant.Infra.Net.Pro\` |
| Credentials | `%APPDATA%\Microsoft\UserSecrets\schwab-web-app-secrets\` |

**Tip:** `%APPDATA%` = `C:\Users\<YourUsername>\AppData\Roaming`

### Linux / macOS

| Item | Path |
|------|------|
| Config | `~/.config/Quant.Infra.Net.Pro/config/appsettings.user.json` |
| Data | `~/.config/Quant.Infra.Net.Pro/Data/` |
| Certs | `~/.config/Quant.Infra.Net.Pro/certs/` |
| Logs | `~/.config/Quant.Infra.Net.Pro/logs/` |
| Backups | `~/.config/Quant.Infra.Net.Pro/backups/` |
| Tokens | `~/.config/Quant.Infra.Net.Pro/` |
| Credentials | `~/.microsoft/usersecrets/schwab-web-app-secrets/` |

### Custom Directory (Linux/macOS)

```bash
export QUANT_INFRA_DATA_DIR=/custom/path
./Quant.Infra.Net.Pro-1.8.0-x64.AppImage
```

Then all user data goes to `/custom/path/` instead of `~/.config/`.

---

## Configuration Files

### appsettings.user.json

User-owned settings override factory defaults. Example:

```json
{
  "License": {
    "Key": "QIF-xxxxxxxx",
    "Email": "user@example.com"
  },
  "Urls": "https://app.alpha-wealth-lab.com",
  "RedirectUri": "https://127.0.0.1:8443/signin-oidc",
  "Update": {
    "CheckEnabled": true,
    "DismissedVersion": "1.8.0"
  }
}
```

**Path:** `~/.config/Quant.Infra.Net.Pro/config/appsettings.user.json` (or custom `$QUANT_INFRA_DATA_DIR`)

### Schwab Credentials (User Secrets)

For security, Schwab credentials are stored separately in User Secrets, not in appsettings.json:

**Windows:**
```
%APPDATA%\Microsoft\UserSecrets\schwab-web-app-secrets\secrets.json
```

**Linux/macOS:**
```
~/.microsoft/usersecrets/schwab-web-app-secrets/secrets.json
```

Example:
```json
{
  "Schwab:AppKey": "your-client-id",
  "Schwab:AppSecret": "your-client-secret",
  "Schwab:AccountNumber": "123456789",
  "Schwab:LoginId": "your-login-id",
  "Schwab:Password": "your-password"
}
```

---

## One-Click Upgrade (Windows Only)

### How It Works

After installing v1.8.0:

1. App checks GitHub Releases every 24 hours
2. When v1.8.1+ is available, `/update` page shows notification
3. Click **Check Now** → download starts
4. Click **Upgrade & Restart** → auto-restart into new version
5. Dashboard shows **Updated to vX.Y.Z**

### Safety Checks

Upgrade is **blocked** if:
- ❌ Rebalance is running
- ❌ Orders are in-flight (working/pending)
- ❌ Automatic mode enabled + US market hours (09:30–16:00 ET)

If blocked, `/update` page explains why. You can:
- Wait for market close, then click **Upgrade after market close**
- Or click **Upgrade anyway (I have no open orders)** if Schwab connection is down (single checkbox bypass)

### Pre-Upgrade Backup

Before every upgrade:
- Snapshots of `config/` and `Data/` copied to `backups/{UTC}-{old-version}/`
- Last 5 snapshots kept
- If upgrade fails, auto-restore from latest snapshot

---

## Troubleshooting

### Port 8443 Already in Use

**Windows:**
```powershell
# Find process using port 8443
netstat -ano | findstr :8443

# Kill by PID (e.g., PID 1234)
taskkill /PID 1234 /F
```

**Linux/macOS:**
```bash
# Find process
lsof -i :8443

# Kill
kill -9 <PID>
```

### Browser Shows "Not Secure" Warning

✓ **This is normal.** Self-signed certificates on localhost trigger this.
- Click **Advanced** → **Proceed to 127.0.0.1**
- Browser will remember and stop warning after first trust

### License Verification Fails

1. Ensure stable internet connection
2. Check Settings for correct License Key and Email
3. Restart the app
4. If offline >30 days, license validation uses cached copy

### Schwab Connection Fails

1. Verify App Key, App Secret, Account Number in Settings are correct
2. Check Schwab Developer Portal — ensure credentials are active
3. Try `/settings` → **Test Connection** (if available)
4. Check `/dashboard` → **Token Status** section

### Data Migration Failed (Upgrade)

If upgrading from v1.6.x/v1.7.x and migration fails:

1. Check logs: `~/.config/Quant.Infra.Net.Pro/logs/`
2. Go to **Settings** → **Import from Old Version** for manual import
3. Latest backup snapshot in `backups/` available for restore

### AppImage Won't Run (Linux)

**FUSE library missing:**
```bash
# Ubuntu/Debian
sudo apt-get install libfuse2

# CentOS/RHEL
sudo yum install fuse-libs
```

**Permission denied:**
```bash
chmod +x Quant.Infra.Net.Pro-1.8.0-x64.AppImage
```

---

## FAQ

| Q | A |
|---|---|
| **Can I run on multiple machines?** | One license = 1 device. Contact support for multi-device. |
| **Does data stay local?** | Yes. All trading data, tokens, credentials stay on your machine. Only license validation sends data to cloud. |
| **Can I move to a new machine?** | Export settings from old machine (Settings → Export), import on new machine. |
| **What happens if internet goes down?** | Token refresh queues, retries on reconnect. MFA detection pauses. License uses cached validation (30-day offline tolerance). |
| **How to enable debug logging?** | Set environment variable before launch: `SERILOG_LOGLEVEL=Debug` |
| **Can I run as a service on Linux?** | Yes, use systemd service (see [Step 4](#step-4-optional--background-service-systemd)) |
| **How to uninstall?** | **Windows**: Control Panel → Programs → Uninstall. **Linux**: Delete AppImage and `~/.config/Quant.Infra.Net.Pro/` |

---

## Support

- **Website**: https://www.alpha-wealth-lab.com
- **Email**: alphawealthlab@outlook.com
- **Telegram**: https://t.me/+VPy-VLis8gVmYWM1

---

**Document Version**: 1.0 | **Updated**: 2026-09-28
