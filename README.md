<div align="center">
  <h1>Quant.Infra.Net.Pro</h1>
  <p><strong>Charles Schwab Unattended Trading Gateway — 100% Local, Self-Hosted, Credentials Never Uploaded</strong></p>
  <p><a href="https://www.alpha-wealth-lab.com">www.alpha-wealth-lab.com</a></p>
  <p>
    <img src="https://img.shields.io/badge/.NET-8.0-blueviolet" alt=".NET 8.0" />
    <img src="https://img.shields.io/badge/License-Commercial-blue" alt="Commercial License" />
  </p>
</div>

---

## 📌 What Is This? 这是什么？

**Quant.Infra.Net.Pro** is a .NET 8 local web application that connects to your Charles Schwab brokerage account. It runs entirely on your own machine — your API keys, tokens, and trading data never leave your computer. No cloud intermediaries, no third-party servers, no data sharing.

The application solves the core problem of **Schwab API unattended operation**: Schwab access tokens expire every 30 minutes, refresh tokens expire every 7 days, and OAuth re-authorization requires a browser — all of which break headless / 24/7 trading setups. This project automates the entire lifecycle so you can run trading strategies without daily manual intervention.

**Quant.Infra.Net.Pro** 是一个 .NET 8 本地 Web 应用，用于连接您的 Charles Schwab（嘉信理财）交易账户。它完全运行在您自己的电脑上——API Key、Token、交易数据永远不会离开您的计算机。无云中间商，无数据共享。

该应用解决了 **Schwab API 无人值守运行**的核心难题：Schwab Access Token 每 30 分钟过期，Refresh Token 每 7 天过期，OAuth 重授权需要浏览器操作——这些都破坏了无头 / 7×24 交易场景。本项目自动化了整个生命周期，让您无需每日手动干预即可持续运行交易策略。

---

## 🎯 Who Is This For? 谁需要它？

| English | 中文 |
|---------|------|
| Quantitative traders who trade through Charles Schwab | 通过 Charles Schwab 交易的量化交易者 |
| Developers building automated trading strategies on the .NET / C# stack | 在 .NET / C# 技术栈上构建自动化交易策略的开发者 |
| Anyone who needs Schwab API access to run 24/7 without babysitting token refresh | 需要 7×24 无人值守运行 Schwab API 且不希望每日手动刷 Token 的任何人 |

---

## 🔥 What Problems Does It Solve? 解决了什么问题？

| Pain Point / 痛点 | Solution / 本产品的方案 |
|-------------------|------------------------|
| Schwab access token expires every 30 min / Access Token 每 30 分钟过期 | Background service refreshes automatically every 15 minutes using the refresh token. No user action needed. / 后台服务每 15 分钟自动使用 Refresh Token 刷新，无需用户操作 |
| Schwab refresh token expires every 7 days / Refresh Token 每 7 天过期 | Headless Playwright browser re-authorizes before expiry (Day 6.5 trigger, 30-hour retry buffer). Fully automatic. / Playwright 无头浏览器在第 6.5 天自动触发重授权，30 小时重试缓冲窗口，全自动 |
| MFA / 2FA blocks automated login / MFA 阻断自动化登录 | Dashboard shows a red MFA banner with two recovery paths: one-click manual re-authorize or paste an authorization code. / 仪表盘显示红色 MFA 横幅，提供两条恢复路径：一键手动重授权或粘贴授权码 |
| Schwab OAuth page layout changes / OAuth 页面布局变更 | Multi-selector fallback in Playwright automation (3-4 CSS selectors). If all fail, the MFA recovery mechanism handles it. / Playwright 自动化使用多层 CSS 选择器（3-4 个）回退策略，全部失效时走 MFA 恢复机制 |
| Configuration is complex and error-prone / 配置繁琐且易错 | /Settings page lets you enter License Key, API credentials, and RedirectUri through the browser UI. No manual JSON editing. / /Settings 页面通过浏览器 UI 配置所有信息，无需手动编辑 JSON |
| SSL certificate expires / SSL 证书到期 | Auto-generated self-signed certificate with 5-year validity. If expiring within 30 days, the app regenerates it at startup automatically. / 自动生成 5 年有效自签名证书，到期前 30 天自动重新生成 |
| No monitoring for unattended operation / 无人值守无监控 | Dashboard auto-refreshes every 60 seconds with token status, re-auth heartbeat, cookie status, and MFA alerts. / 仪表盘每 60 秒自动刷新，显示 Token 状态、重授权心跳、Cookie 状态、MFA 告警 |

---

## ✨ What You Get 你能得到什么？

| Feature / 功能 | What It Does / 说明 |
|----------------|---------------------|
| **Account Dashboard / 账户仪表盘** | Real-time account summary: total value, cash balance, buying power, unrealized/realized P&L / 实时账户总览：账户总值、现金余额、购买力、未实现/已实现盈亏 |
| **Positions View / 持仓视图** | Current holdings with cost basis and unrealized P&L / 当前持仓及成本价、未实现盈亏 |
| **Real-Time Quotes / 实时行情** | Stock quotes (AAPL, MSFT, etc.) with auto-refresh / 股票实时报价（AAPL、MSFT 等），自动刷新 |
| **Options Chain / 期权链** | Options data with Greeks (Delta, IV) / 期权数据及希腊字母（Delta、IV） |
| **Order History / 订单历史** | Last 60 days of orders / 最近 60 天订单记录 |
| **Price History API / 历史行情 API** | OHLCV candlestick data for US equities and options, intraday minute-level resolution / 美股/期权 OHLCV 蜡烛图查询，支持分钟级日内分辨率 |
| **License Validation / License 验证** | LicenseForge-backed license status with periodic telemetry verification / LicenseForge 驱动的 License 状态验证及定期遥测 |
| **Automatic Token Refresh / 自动 Token 刷新** | 3-layer architecture: 15-min access token refresh, 7-day OAuth re-auth, DPAPI-encrypted persistent token store / 三层架构：15 分钟 Access Token 刷新，7 天 OAuth 重授权，DPAPI 加密持久化 Token 存储 |
| **MFA Recovery / MFA 恢复** | Dashboard banner with manual re-authorize or paste-code recovery / 仪表盘横幅支持手动重授权或粘贴授权码两种恢复方式 |
| **Self-Signed HTTPS / 自签名 HTTPS** | Auto-generated 5-year cert, auto-renewed if expiring within 30 days / 自动生成 5 年有效证书，到期前自动续期 |
| **Settings UI / 设置页面** | Browser-based configuration for License Key, Schwab API credentials, and RedirectUri / 浏览器界面配置所有必填字段 |
| **Secure Onboarding / 安全启动** | Email verification before trial; manual license entry only (no email lookup); auto-saves config to local appsettings.json / 邮箱验证后试用；仅支持手动输入 License；自动保存到本地配置 |

---

## 🚀 Prerequisites 前置条件

| Requirement / 条件 | Why / 原因 |
|--------------------|------------|
| **Charles Schwab brokerage account / 交易账户** | Required to trade. Open at [schwab.com](https://www.schwab.com/) / 交易的前提。前往 schwab.com 开户 |
| **Schwab API credentials / API 凭据 (Client ID & Secret)** | Required for API access. Apply via [Schwab Developer Portal](https://developer.schwab.com/) (2-5 business days) / API 访问必需，审核需 2-5 个工作日 |
| **.NET 8 Runtime** | Required to run the app. Download from [dotnet.microsoft.com](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) |
| **License key / 授权码** | Purchased separately or 7-day free trial available in-app / 单独购买或在应用内激活 7 天免费试用 |
| **Windows (recommended / 推荐)** | DPAPI token encryption requires Windows. On macOS/Linux tokens are stored without DPAPI protection / DPAPI Token 加密需要 Windows。macOS/Linux 上的 Token 无 DPAPI 保护 |

---

## 📦 Quick Start 快速开始

1. **Download** the ZIP package for your OS from [GitHub Releases](https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases) / 从 GitHub Releases 下载对应操作系统的 ZIP 包
2. **Extract** to any folder / 解压到任意文件夹
3. **Run** the executable / 运行可执行文件：
   - Windows: `Quant.Infra.Net.Pro.Web.exe`
   - macOS/Linux: `./Quant.Infra.Net.Pro.Web`
4. **Open** your browser at **https://127.0.0.1:8443** / 打开浏览器访问
5. **Activate**: Follow the on-screen /start flow — verify your email, activate a trial or enter an existing license / 按 /start 页面指引：验证邮箱，激活试用或输入已有 License
6. **Configure**: Go to /settings and enter your Schwab App Key, App Secret, and Account Number / 前往 /settings 输入您的 Schwab API 凭据
7. **Start trading**: The Dashboard shows your account, positions, quotes, and order history / 仪表盘显示账户、持仓、行情、订单历史

> **Note:** First launch shows a browser security warning — expected for a local self-signed HTTPS certificate. Follow the console instructions to trust it once.
>
> **注意：** 首次启动浏览器会显示安全警告——这是本地自签名 HTTPS 证书的正常现象。按控制台提示一次性信任即可。

---

## 📖 Version History 版本历史

> **Current Version / 当前版本:** 1.4.2 (2026-06-10)

| Version / 版本 | Date / 日期 | What Changed / 变更内容 |
|----------------|-------------|------------------------|
| **1.4.2** | 2026-06-10 | **LemonSqueezy Webhook integration**: subscription renewal webhook forwards to LicenseForge with ACA cold-start retry. License expiry logic: expired → 30 days from payment time, not expired → 30 days from current expiry. Bilingual README and usage guide. / **LemonSqueezy Webhook 集成**：订阅续费 Webhook 转发到 LicenseForge，支持 ACA 冷启动重试。License 过期逻辑：已过期 → 从付款时间延长 30 天，未过期 → 从当前过期时间延长 30 天。双语 README 和使用说明。 |
| **1.4.1** | 2026-06-09 | **Secure onboarding hardening**: /start requires email verification before trial. Existing licenses are manual-entry only. Successful activation writes License config to local appsettings.json. Dashboard redirects to /settings if configuration is incomplete. / **安全启动流程加固**：启动页要求邮箱验证后才能试用。已有 License 仅支持手动输入。激活成功自动写入本地配置。仪表盘在配置完成前自动跳转。 |
| **1.3.2** | 2026-06-07 | **Code standards and obfuscation**: bilingual XML comments, parameter validation, UTC standardization, Obfuscar code obfuscation for Release builds. / **代码规范与混淆**：双语注释、参数验证、UTC 时间标准化、Obfuscar 代码混淆（Release 构建）。 |
| **1.3.0** | 2026-06-06 | **Unattended breakthrough — 5 limiting factors solved**: Playwright auto-re-auth with cookie persistence, multi-selector fallback, 6.5-day pre-trigger, 30 hourly retries. MFA state tracking with disk persistence. Dashboard MFA recovery banner. Cookie status display. SSL auto-renew when less than 30 days. / **5 个无人值守瓶颈全部解决**：Playwright 自动重授权、MFA 持久化、仪表盘 MFA 恢复、Cookie 状态显示、SSL 自动续期。 |
| **1.2.5** | 2026-06-06 | **Settings page** (/Settings): browser UI for License Key, Urls, RedirectUri. Middleware exemption for /settings. / **设置页面**：通过浏览器 UI 配置 License Key、Urls、RedirectUri。 |
| **1.2.3** | 2026-06-06 | **Unattended architecture refactoring**: SchwabTokenStore (DPAPI persistent storage), 15-min background token refresh, Polly HttpClient with ACA cold-start exponential backoff, Dashboard 60s auto-refresh. / **无人值守架构重构**：DPAPI 加密持久化 Token 存储、15 分钟后台 Token 刷新、Polly ACA 冷启动指数退避。 |
| **1.2.1** | 2026-06-01 | Token lifecycle fix: full token response on code exchange, 30-min auto-refresh, persistent token storage (up to 7 days unattended). / Token 生命周期修复：完整 Token 响应、30 分钟自动刷新、持久化存储（最长 7 天无人值守）。 |
| **1.2.0** | 2026-05-30 | **Architecture refactoring**: extracted AccountManager and SchwabAuthManager from controllers, unified API prefix api/v1/. / **架构重构**：从 Controllers 抽取 Manager，统一 API 前缀。 |
| **1.1.2** | 2026-05-29 | **Activation page**: license key input form in browser UI — no manual appsettings.json editing. / **激活页面**：浏览器 UI 输入 License Key，无需手动编辑 JSON。 |
| **1.1.0** | 2025-05-29 | Product name updated to quant.infra.net.pro for LicenseForge registration. / 产品名更新以匹配 LicenseForge 注册。 |
| **1.0.0** | 2025-05-29 | **Initial release**: Schwab OAuth login, account management, quotes, order execution, LicenseForge telemetry-based license validation, EULA, Swagger docs, HTTPS cert, single-file deployment. / **初始发布**：Schwab OAuth、账户管理、行情、订单执行、LicenseForge 验证、EULA、Swagger、HTTPS 证书、单文件部署。 |

---

## 🔄 License Activation Flow 授权激活流程

### New Users / 新用户

1. Open /start and enter your email / 打开 /start 输入邮箱
2. Click **Verify Email** — if already verified, page moves to activation; otherwise a verification email is sent / 点击验证邮箱
3. Open the verification link in your inbox, return to /start, and click Verify Email again / 打开收件箱中的验证链接，返回 /start 再次点击验证
4. Choose: activate a **7-day free trial** or **enter your purchased license** manually / 选择激活 7 天免费试用或输入已有 License
5. On success, the app saves License:Key and License:Email to local config / 激活成功后，应用将配置保存到本地 appsettings.json
6. Go to /settings to enter your Schwab API credentials / 前往 /settings 输入 Schwab API 凭据

### Existing Users / 已有用户

- Go directly to /settings to enter your License Key and Email / 直接前往 /settings 输入 License Key 和 Email
- The app never reveals a license by email lookup — security by design / 应用不会通过邮箱回显 License —— 这是安全设计

### Free Trial / 免费试用

- **7-day free trial** available in-app via /start / 在应用内 /start 页面激活 7 天免费试用
- One trial per email per product (even after expiry) / 同一产品同一邮箱仅可领取一次（过期后不再签发）
- Email verification required before trial activation / 试用前必须先完成邮箱验证

---

## 💰 Pricing and Purchase 定价与购买

| Plan / 计划 | Price / 价格 | Validity / 有效期 | Features / 功能 |
|-------------|--------------|-------------------|-----------------|
| **Personal Pro** | One-time purchase / 一次性购买 | Perpetual / 永久 | All features, 1 device / 全部功能，1 台设备 |
| **Free Trial** | Free / 免费 | 7 days / 7 天 | Full functionality, 1 device / 全部功能，1 台设备 |
| **Consulting** | Custom / 定制 | Custom / 按需定制 | Custom development and support / 定制开发与专属支持 |

> **Purchase link / 购买链接:** https://xyztech.lemonsqueezy.com/checkout/buy/da645967-0e21-4e85-a385-f20bb3e254f7

---

## 🛠️ Tech Stack 技术栈

| Technology / 技术 | Purpose / 用途 |
|-------------------|----------------|
| **.NET 8** | Runtime framework / 运行时框架 |
| **ASP.NET Core** | Web application framework / Web 应用框架 |
| **Schwab API** | Brokerage data source / 券商数据源 |
| **Playwright** | Headless browser automation for OAuth re-authorization / 无头浏览器 OAuth 重授权 |
| **DPAPI (Windows)** | Token encryption at rest / Token 加密存储 |
| **Polly** | HTTP resilience (retry, timeout, exponential backoff for ACA cold start) / HTTP 弹性策略 |
| **Obfuscar** | Code obfuscation (Release builds) / 代码混淆（Release 构建） |
| **LicenseForge** | License validation and management backend / 授权验证与管理后端 |
| **LemonSqueezy** | Payment processing / 支付处理 |

---

## 🌐 Community and Support 社区与支持

| Channel / 渠道 | Contact / 联系方式 |
|-----------------|-------------------|
| **Telegram Group** | https://t.me/+VPy-VLis8gVmYWM1 |
| **Business licensing and custom development / 商业授权与定制开发** | rex.fan18@gmail.com |
| **Product website / 产品官网** | www.alpha-wealth-lab.com |

---

## ⚠️ Compliance 合规声明

This project provides quantitative trading infrastructure tools only and does not constitute investment advice. Users are solely responsible for ensuring compliance with all applicable laws, regulations, and exchange rules in their jurisdiction. The authors assume no liability for any legal or financial consequences arising from the use of this software.

本项目仅提供量化交易基础设施工具，不构成任何投资建议。用户需自行确保使用本软件时符合所在国家/地区的法律法规及交易所合规要求。因使用本软件产生的任何法律或财务后果由用户自行承担。

---

## 📄 License

**Quant.Infra.Net.Pro** is a commercial software product. A valid license key is required for continued use beyond the 7-day free trial period. See LICENSE for details.

**Quant.Infra.Net.Pro** 是一款商业软件产品。7 天免费试用期后需要有效的授权码才能继续使用。

---

<p align="center">
  <strong>2026 AlphaWealthLab. All rights reserved.</strong><br>
  <a href="https://www.alpha-wealth-lab.com">www.alpha-wealth-lab.com</a>
</p>
