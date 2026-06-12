# Quant.Infra.Net.Pro Quick Start Guide / Quant.Infra.Net.Pro 快速使用指南

> **Applies to / 适用于:** Quant.Infra.Net.Pro v1.4.2+ | **Last updated / 最后更新:** 2026-06-12

---

## Overview / 概述

This guide walks you through getting Quant.Infra.Net.Pro up and running — from installing .NET to launching the application for the first time.

本指南将指导您从安装 .NET 到首次运行 Quant.Infra.Net.Pro 的完整流程。

---

# English

## Step 1: Install .NET Runtime

Quant.Infra.Net.Pro requires **.NET 8.0 or later** and is fully cross-platform (Windows, macOS, Linux).

### Download and Install

1. Go to the official .NET download page: **https://dotnet.microsoft.com/download/dotnet/8.0**
2. Select the installer for your operating system:

| OS | Download | Installation |
|----|----------|-------------|
| **Windows** | Download the **.NET 8.0 SDK** (or **Runtime** if you prefer) installer (.exe) | Run the installer — it will guide you through the setup |
| **macOS** | Download the **.NET 8.0 SDK** (.pkg) for Intel or Apple Silicon | Open the .pkg file and follow the installer prompts |
| **Linux** | Follow the package manager instructions for your distro (Ubuntu, Debian, Fedora, etc.) | Use apt, dnf, or the install script provided on the .NET website |

### Verify Installation

Open a terminal (Command Prompt, PowerShell, or bash) and run:

`
dotnet --version
`

You should see output like 8.0.xxx or higher. If the command is not found, ensure .NET was added to your PATH (the installer typically does this automatically).

> **Note:** Both the .NET Runtime and .NET SDK work. The SDK includes the runtime plus additional tools. If you plan to develop .NET applications, install the SDK. For running Quant.Infra.Net.Pro only, the Runtime is sufficient.

---

## Step 2: Obtain Charles Schwab API Credentials

Before you can connect to Schwab, you need API credentials:

1. Follow the **[Charles Schwab Developer Registration Guide](Charles%20Schwab%20Developer%20Registration%20Guide.md)** to:
   - Register as a Schwab Developer
   - Create an application
   - Get your **App Key (Client ID)** and **App Secret (Client Secret)**

2. Save these credentials securely:
   - **App Key (Client ID):** YOUR_APP_KEY
   - **App Secret (Client Secret):** YOUR_APP_SECRET
   - **Account Number:** Your Schwab account number

3. Ensure your application's **Redirect URI** is set to:
   https://127.0.0.1:8443/signin-oidc

> **Important:** These credentials are required during the configuration step after first launch. Keep them in a safe place.

---

## Step 3: Download Quant.Infra.Net.Pro

1. Go to the **[Releases page](https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases/tag/Quant.Infra.Net.Pro)** on GitHub.
2. Download the ZIP package for your operating system:

| OS | Package |
|----|---------|
| **Windows** | Quant.Infra.Net.Pro-{version}-win-x64.zip |
| **macOS** | Quant.Infra.Net.Pro-{version}-osx-x64.zip |
| **Linux** | Quant.Infra.Net.Pro-{version}-linux-x64.zip |

3. Extract the ZIP archive to any folder on your machine.

---

## Step 4: Launch the Application

### Windows

1. Navigate to the folder where you extracted the files.
2. **Double-click** Quant.Infra.Net.Pro.Web.exe.
3. A console window will open, and your default browser should automatically launch to **https://127.0.0.1:8443**.

### macOS / Linux

1. Open Terminal and navigate to the extracted folder:
   `ash
   cd /path/to/extracted/folder
   `
2. Make the executable runnable (first time only):
   `ash
   chmod +x Quant.Infra.Net.Pro.Web
   `
3. Run the application:
   `ash
   ./Quant.Infra.Net.Pro.Web
   `
4. Open your browser and navigate to **https://127.0.0.1:8443**.

> **First-time browser warning:** Your browser will show a security warning ("Your connection is not private") — this is **expected** for a local self-signed certificate. Click **Advanced** and then **Proceed to 127.0.0.1 (unsafe)** to continue.

---

## Step 5: Activate Your License

1. On the welcome page, follow the **/start** flow:
   - New users: Enter your email → verify via email link → activate a **7-day free trial** or enter a purchased license key
   - Existing users: Go directly to **/settings** and enter your **License Key** and **Email**

2. On successful activation, the app saves your license to the local configuration.

---

## Step 6: Configure Schwab API Credentials

1. Go to **/settings** in the web UI.
2. Enter the following information:

| Field | Value |
|-------|-------|
| License Key | Your license key (e.g., QIF-XXXXXXXX) |
| Email | The email associated with your license |
| Schwab App Key | Your Schwab **Client ID** (from Step 2) |
| Schwab App Secret | Your Schwab **Client Secret** (from Step 2) |
| Schwab Account Number | Your Schwab account number |
| Redirect URI | https://127.0.0.1:8443/signin-oidc (default) |

3. Click **Save**. The application will automatically restart.

---

## Step 7: Start Trading

Once the application restarts, your **Dashboard** at **/dashboard** will display:

| Section | Displays |
|---------|----------|
| Account Summary | Total value, cash balance, buying power, P&L |
| Positions | Current holdings with cost basis |
| Real-Time Quotes | Stock quotes with auto-refresh |
| Options Chain | Options data |
| Order History | Last 60 days of orders |
| Token Status | Token health and next re-auth due |

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| dotnet command not found | .NET Runtime not installed or not in PATH. Reinstall and restart your terminal. |
| Browser shows security warning | Expected for local self-signed certificate. Click Advanced > Proceed. |
| App doesn't start | Check the console output for errors. Ensure port 8443 is not in use. |
| Schwab connection fails | Verify your App Key, App Secret, and Account Number in /settings. Ensure the Redirect URI in your Schwab Developer app matches exactly. |
| MFA challenge during re-auth | Auto-reauth is suspended. Complete Schwab OAuth in a browser manually, then restart the app. |

---

# 中文版

## 第一步：安装 .NET Runtime

Quant.Infra.Net.Pro 需要 **.NET 8.0 或更高版本**，完全跨平台支持（Windows、macOS、Linux）。

### 下载并安装

1. 访问 .NET 官方下载页面：**https://dotnet.microsoft.com/download/dotnet/8.0**
2. 选择对应操作系统的安装程序：

| 操作系统 | 下载 | 安装方式 |
|----------|------|----------|
| **Windows** | 下载 **.NET 8.0 SDK**（或 **Runtime**）安装程序（.exe） | 运行安装程序，按提示完成安装 |
| **macOS** | 下载 **.NET 8.0 SDK**（.pkg），Intel 或 Apple Silicon 版本 | 打开 .pkg 文件，按提示完成安装 |
| **Linux** | 根据发行版选择包管理器安装方式（Ubuntu、Debian、Fedora 等） | 使用 apt、dnf 或 .NET 官网提供的安装脚本 |

### 验证安装

打开终端（命令提示符、PowerShell 或 bash），运行：

`
dotnet --version
`

应显示类似 8.0.xxx 或更高的版本号。如果命令未找到，请确保 .NET 已添加到 PATH 环境变量（安装程序通常会自劢完成）。

> **提示：** .NET Runtime 和 .NET SDK 均可使用。SDK 包含 Runtime 和额外开发工具。如需开发 .NET 应用，请安装 SDK；仅运行 Quant.Infra.Net.Pro，安装 Runtime 即可。

---

## 第二步：获取 Charles Schwab API 凭据

在连接 Schwab 之前，需要获取 API 凭据：

1. 按照 **[Charles Schwab Developer 注册指南](Charles%20Schwab%20Developer%20Registration%20Guide.md)** 完成以下操作：
   - 注册 Schwab Developer
   - 创建应用
   - 获取 **App Key（Client ID）** 和 **App Secret（Client Secret）**

2. 妥善保存以下凭据：
   - **App Key（Client ID）：** YOUR_APP_KEY
   - **App Secret（Client Secret）：** YOUR_APP_SECRET
   - **Account Number：** 您的 Schwab 账户号

3. 确保应用的 **Redirect URI** 设置为：
   https://127.0.0.1:8443/signin-oidc

> **重要：** 首次启动后的配置步骤中需要用到这些凭据，请妥善保管。

---

## 第三步：下载 Quant.Infra.Net.Pro

1. 访问 GitHub 上的 **[Releases 页面](https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases/tag/Quant.Infra.Net.Pro)**。
2. 下载对应操作系统的 ZIP 包：

| 操作系统 | 包名 |
|----------|------|
| **Windows** | Quant.Infra.Net.Pro-{version}-win-x64.zip |
| **macOS** | Quant.Infra.Net.Pro-{version}-osx-x64.zip |
| **Linux** | Quant.Infra.Net.Pro-{version}-linux-x64.zip |

3. 将 ZIP 包解压到任意文件夹。

---

## 第四步：启动应用

### Windows

1. 进入解压后的文件夹。
2. **双击** Quant.Infra.Net.Pro.Web.exe。
3. 控制台窗口打开，默认浏览器应自动跳转到 **https://127.0.0.1:8443**。

### macOS / Linux

1. 打开终端，进入解压后的文件夹：
   `ash
   cd /path/to/extracted/folder
   `
2. 首次执行需赋予可执行权限：
   `ash
   chmod +x Quant.Infra.Net.Pro.Web
   `
3. 运行应用：
   `ash
   ./Quant.Infra.Net.Pro.Web
   `
4. 打开浏览器，访问 **https://127.0.0.1:8443**。

> **浏览器安全警告：** 首次访问时浏览器会显示"您的连接不是私密连接"的警告——这是本地自签名证书的正常现象。点击 **高级** 然后选择 **继续前往 127.0.0.1（不安全）** 即可。

---

## 第五步：激活 License

1. 在欢迎页面中按 **/start** 流程操作：
   - 新用户：输入邮箱 → 通过邮箱链接验证 → 激活 **7 天免费试用** 或输入已购 License Key
   - 已有用户：直接前往 **/settings** 输入 **License Key** 和 **Email**

2. 激活成功后，应用自动将 License 保存到本地配置。

---

## 第六步：配置 Schwab API 凭据

1. 在 Web UI 中访问 **/settings**。
2. 输入以下信息：

| 字段 | 值 |
|------|-----|
| License Key | 您的授权码（例如 QIF-XXXXXXXX） |
| Email | 购买授权时使用的邮箱 |
| Schwab App Key | 您的 Schwab **Client ID**（第二步获取） |
| Schwab App Secret | 您的 Schwab **Client Secret**（第二步获取） |
| Schwab Account Number | 您的 Schwab 账户号 |
| Redirect URI | https://127.0.0.1:8443/signin-oidc（默认值） |

3. 点击 **Save**。应用将自动重启。

---

## 第七步：开始交易

应用重启后，**/dashboard** 仪表盘将显示：

| 区域 | 内容 |
|------|------|
| 账户摘要 | 账户总值、现金余额、购买力、盈亏 |
| 持仓 | 当前持仓及成本价 |
| 实时行情 | 股票实时报价，自动刷新 |
| 期权链 | 期权数据 |
| 订单历史 | 最近 60 天订单记录 |
| Token 状态 | Token 健康状况和下次重授权时间 |

---

## 快速排错

| 问题 | 解决方案 |
|------|----------|
| dotnet 命令未找到 | .NET Runtime 未安装或未添加到 PATH。重新安装后重启终端。 |
| 浏览器显示安全警告 | 本地自签名证书的正常现象。点击高级 > 继续前往。 |
| 应用无法启动 | 检查控制台输出中的错误信息。确保 8443 端口未被占用。 |
| Schwab 连接失败 | 检查 /settings 中的 App Key、App Secret 和 Account Number 是否正确。确保 Schwab Developer 应用中的 Redirect URI 完全匹配。 |
| 遇到 MFA 二次验证 | 自动重授权已暂停。请在浏览器中手动完成 Schwab OAuth 授权后重启应用。 |

---

> **Support / 支持**
> Telegram: https://t.me/+VPy-VLis8gVmYWM1
> Email: alphawealthlab@outlook.com
> Website: www.alpha-wealth-lab.com
