# Quant.Infra.Net.Pro

[![.NET](https://img.shields.io/badge/.NET-8.0-blueviolet)](https://dotnet.microsoft.com/download/dotnet/8.0)

> **Quant.Infra.Net.Pro** — Charles Schwab unattended trading gateway. Free to download, free to try, and runs on your machine so trading data never leaves your computer.

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| **1.5.1** *(current)* | 2026-07-02 | **Financial compliance logging hardening**: Added centralized sensitive-data redaction for logs and user-facing error surfaces. OAuth codes, token fragments, token refresh response bodies, order identifiers, account value amounts, cookie storage paths, and raw exception messages are no longer emitted through normal logs, API errors, query-string redirects, or Blazor error banners. |
| 1.4.2 | 2026-06-10 | LemonSqueezy webhook integration: subscription renewal with ACA cold-start retry. License expiry logic: expired → 30 days from payment, not expired → 30 days from current expiry. Bilingual README and usage guide. |
| 1.4.1 | 2026-06-09 | Secure onboarding: email verification before trial, manual license entry only, auto-saves to local config. Dashboard redirects to /settings if config is incomplete. |
| 1.4.0 | 2026-06-08 | Initial commercial release: new users can activate a 3-month free trial via email verification; existing users can directly enter their license key and email. Connects to Charles Schwab brokerage via Web API. With sufficient configuration, enables long-term unattended connection. |
| 1.3.2 | 2026-06-07 | Code standards enforcement + Code obfuscation for release builds. |
| 1.3.0 | 2026-06-06 | Unattended breakthrough: Automated browser login, MFA detection notification, SSL auto-renew, 30-hour retry buffer. 5 limiting factors solved. |
| 1.2.5 | 2026-06-06 | Settings page — browser UI for License Key, Schwab credentials, RedirectUri. |
| 1.2.3 | 2026-06-06 | Unattended architecture: Token encryption, 15-min background refresh, exponential backoff retry. |
| 1.0.0 | 2025-05-29 | Initial release: Schwab OAuth, account management, quotes, orders, LicenseForge validation, EULA, HTTPS, single-file deploy. |

---

# English

## Quant.Infra.Net.Pro — Unattended Charles Schwab Trading Gateway

> Website: **[https://www.alpha-wealth-lab.com/](https://www.alpha-wealth-lab.com/)**

| Challenge | How Pro Edition Solves It |
|-----------|--------------------------|
| Schwab access token expires every 30 minutes, refresh token expires every 7 days | Fully automatic token lifecycle: background refresh every 15 min + automated browser login on day 6.5 |
| OAuth re-authorization requires a browser (breaks headless trading) | Automated browser re-login with 30-hour retry window |
| MFA / 2FA blocks automated login after credentials are submitted | App detects MFA and suspends auto-reauth for manual intervention. MFA cannot be automated - user must authorize via browser when prompted. |
| API credentials are complex and error-prone to configure | Browser-based Settings UI: configure all credentials through web interface |
| No visibility into whether unattended trading is working | Auto-refreshing Dashboard: token status, re-auth heartbeat, cookie status every 60 seconds |
| SSL certificate management is a hassle for local apps | Auto-generated 5-year cert, auto-renewed if less than 30 days remaining |

## What You Get

| Feature | What It Does |
|---------|-------------|
| Account Dashboard | Real-time summary: total value, cash balance, buying power, unrealized/realized P&L |
| Positions View | Current holdings with cost basis and unrealized P&L |
| Real-Time Quotes | Stock quotes (AAPL, MSFT, etc.) with auto-refresh |
| Options Chain | Current options chain data (strike, expiration, type, bid/ask, last price, volume, open interest); not historical option chains |
| Order History | Last 60 days of orders with execution details |
| Price History API | OHLCV candlestick data for US equities and ETFs only, intraday to monthly. Schwab does not provide price history for options or futures. |
| License Validation | LicenseForge-backed periodic verification with offline-tolerant cache |
| Web API | Full RESTful API for programmatic access |

## Financial Compliance & Privacy Update

Version **1.5.1** adds financial compliance logging hardening. The application now applies centralized redaction before writing normal logs or showing user-facing errors, so OAuth authorization codes, token fragments, token refresh response bodies, order identifiers, account value amounts, cookie storage paths, and raw exception details are not exposed through logs, API errors, redirects, or Blazor error banners.

Trading data, Schwab credentials, OAuth tokens, and application logs remain local to your machine. License validation still sends only the limited licensing fields described in [Data Privacy Statement](DATA_PRIVACY.md).

## Who Is This For

- Quantitative traders who trade through Charles Schwab
- Developers building automated trading strategies on the .NET / C# stack
- Anyone who needs Schwab API access to run 24/7 without babysitting token refresh

## Prerequisites

| Requirement | Why |
|-------------|-----|
| Charles Schwab brokerage account | Required to trade. Open at schwab.com |
| Schwab API credentials (Client ID & Secret) | Apply via Schwab Developer Portal (2-5 business days) |
| .NET 8 Runtime | Download from dotnet.microsoft.com |
| License activation | Activate a 3-month free trial in-app, or enter an existing license for continued use |

## Quick Start

1. **Download for free** the ZIP package for your OS from [GitHub Releases](https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases)
2. **Extract** to any folder
3. **Run** the executable (Windows: `Quant.Infra.Net.Pro.Web.exe`, macOS/Linux: `./Quant.Infra.Net.Pro.Web`)
4. **Open** your browser at **https://127.0.0.1:8443**
5. **Activate a free trial**: Follow the on-screen /start flow — verify your email, activate a 3-month trial, or enter an existing license
6. **Configure**: Go to /settings and enter your Schwab App Key, App Secret, and Account Number
7. **Start trading**: The Dashboard shows your account, positions, quotes, and order history

> First launch shows a browser security warning — expected for a local self-signed cert. Follow console instructions to trust it once.

## License Activation Flow

| Step | New Users | Existing Users |
|------|-----------|----------------|
| 1 | Open /start, enter your email | Go directly to /settings |
| 2 | Verify email via inbox link | Enter License Key and Email manually |
| 3 | Activate 3-month free trial or enter existing license | Click Save |
| 4 | App saves License:Key and License:Email to config | Dashboard is ready |
| 5 | Go to /settings to enter Schwab API credentials | |

## Free Trial & Renewal

| Feature | Details |
|---------|---------|
| Free Trial | 3 months, full functionality, 1 device. One trial per email per product. Email verification required. |
| Renewal | After successful payment via purchase link, license auto-extends. Expired: +30 days from payment. Active: +30 days from current expiry. |

## Community & Support

- **Telegram Group**: https://t.me/+VPy-VLis8gVmYWM1
- **Business licensing & custom development**: alphawealthlab@outlook.com
- **Product website**: www.alpha-wealth-lab.com
- **Risk disclaimer**: [Charles Schwab Risk Disclaimer](CHARLES_SCHWAB_DISCLAIMER.md)

## License

**Quant.Infra.Net.Pro** is free to download and free to try. A valid license key is required only for continued use beyond the 3-month free trial period.

---

# 中文版

## Quant.Infra.Net.Pro — Charles Schwab 无人值守交易网关

> 官网：**[https://www.alpha-wealth-lab.com/](https://www.alpha-wealth-lab.com/)**

如果你正通过 Charles Schwab 交易，可能面临这些痛点：

| 痛点 | Pro Edition 如何解决 |
|------|---------------------|
| Schwab Access Token 每 30 分钟过期，Refresh Token 每 7 天过期 | 全自动 Token 生命周期管理：每 15 分钟后台刷新 + 第 6.5 天代码操控浏览器重新登录 |
| OAuth 重授权需要浏览器操作（破坏无人值守） | 代码操控浏览器重新登录，内置 30 小时重试窗口 |
| MFA / 二步验证阻断自动化登录 | 应用可检测到 MFA 并暂停自动重授权，等待用户手动处理。MFA 无法自动化绕过，需用户在浏览器中完成授权。 |
| API 凭据配置繁琐易错 | 浏览器 UI 配置页面：所有凭据通过网页设置 |
| 无人值守运行状态不可见 | 每 60 秒自动刷新仪表盘：Token 状态、重授权心跳、Cookie 状态一目了然 |
| 本地 SSL 证书管理麻烦 | 自动生成 5 年有效证书，到期前 30 天自动续期 |

## 功能总览

| 功能 | 说明 |
|------|------|
| 账户仪表盘 | 实时总览：账户总值、现金余额、购买力、未实现/已实现盈亏 |
| 持仓视图 | 当前持仓及成本价、未实现盈亏 |
| 实时行情 | 股票实时报价（AAPL、MSFT 等），自动刷新 |
| 期权链 | 当前期权链数据（行权价、到期日、类型、买卖价、最新价、成交量、持仓量），不是历史期权链 |
| 订单历史 | 最近 60 天订单记录 |
| 历史行情 API | 仅支持美股和 ETF 的 OHLCV 蜡烛图，支持分钟级到月级。Schwab 不提供期权或期货的 price history。 |
| License 验证 | LicenseForge 驱动的定期验证，离线缓存容错 |

## 金融合规与隐私更新

**1.5.1** 版本已完成金融合规日志加固。应用现在会在普通日志写入和用户可见错误展示前统一执行敏感信息脱敏，OAuth 授权码、Token 片段、Token 刷新响应体、订单标识、账户金额、Cookie 存储路径和原始异常详情不会再通过日志、API 错误、重定向参数或 Blazor 错误提示暴露。

交易数据、Schwab 凭据、OAuth Token 和应用日志仍保留在用户本机。License 验证仅发送 [数据隐私声明](DATA_PRIVACY.md) 中列出的有限授权字段。

## 适用人群

- 通过 Charles Schwab 交易的量化交易者
- 在 .NET / C# 技术栈上构建自动化策略的开发者
- 需要 7x24 无人值守运行 Schwab API 而不想每日手动刷 Token 的任何人

## 前置条件

| 条件 | 说明 |
|------|------|
| Charles Schwab 交易账户 | 前往 schwab.com 开户 |
| Schwab API 凭据（Client ID & Secret） | 通过 Schwab Developer Portal 申请，审核需 2-5 个工作日 |
| .NET 8 Runtime | 从 dotnet.microsoft.com 下载 |
| License 激活 | 应用内可激活 3 个月免费试用；继续使用时输入已有 License |

## 快速开始

1. 从 [GitHub Releases](https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases) 免费下载对应操作系统的 ZIP 包
2. 解压到任意文件夹
3. 运行可执行文件（Windows：`Quant.Infra.Net.Pro.Web.exe`，macOS/Linux：`./Quant.Infra.Net.Pro.Web`）
4. 在浏览器中访问 **https://127.0.0.1:8443**
5. 按照 /start 页面指引：验证邮箱 → 激活 3 个月免费试用或输入已有 License
6. 前往 /settings 输入 Schwab API 凭据

> 首次启动浏览器会显示安全警告——本地自签名证书的正常现象，按控制台提示信任一次即可。

## 授权激活流程

| 步骤 | 新用户 | 已有用户 |
|------|--------|---------|
| 1 | 打开 /start 输入邮箱 | 直接前往 /settings |
| 2 | 点击邮箱中的验证链接，返回验证 | 手动输入 License Key 和 Email |
| 3 | 激活 3 个月免费试用或输入已有 License | 点击保存 |
| 4 | 应用自动保存 License 信息到本地配置 | 仪表盘就绪 |
| 5 | 前往 /settings 配置 Schwab API 凭据 | |

## 免费试用与续费

| 功能 | 说明 |
|------|------|
| 免费试用 | 3 个月，全部功能，1 台设备。同一产品同一邮箱仅可领取一次。试用前需验证邮箱。 |
| 续费 | 通过购买链接付款后 License 自动延长。已过期：+30 天从付款时间。未过期：+30 天从当前过期时间。 |

## 社区与支持

- **Telegram 群组**: https://t.me/+VPy-VLis8gVmYWM1
- **商业授权与定制开发**: alphawealthlab@outlook.com
- **产品官网**: www.alpha-wealth-lab.com
- **风险免责声明**: [Charles Schwab 风险免责声明](CHARLES_SCHWAB_DISCLAIMER.md)

## License

Quant.Infra.Net.Pro 可免费下载并免费试用。3 个月免费试用期后，继续使用才需要有效授权码。

---
