# Quant.Infra.Net.Pro 使用说明 / User Manual

> **Document Version:** 1.4.2 | **Applies to:** Quant.Infra.Net.Pro v1.4.2+

---

# English

## 1. Introduction

**Quant.Infra.Net.Pro** is a local web application that provides an unattended trading gateway for Charles Schwab brokerage accounts. It runs entirely on your own machine, with no cloud intermediaries and no data leaving your computer.

The core problem it solves: Schwab API tokens expire frequently (access token: 30 min, refresh token: 7 days), making 24/7 automated trading impossible without constant manual intervention. This application automates the entire token lifecycle, handles OAuth re-authorization, MFA detection notification, and SSL certificate management — all without user interaction.

## 2. Quick Start

| Step | Action | Details |
|------|--------|---------|
| 1 | Download | Get the ZIP for your OS from [GitHub Releases](https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases) |
| 2 | Extract | Unzip to any folder |
| 3 | Run | Windows: `Quant.Infra.Net.Pro.Web.exe`. macOS/Linux: `./Quant.Infra.Net.Pro.Web` |
| 4 | Open browser | Navigate to **https://127.0.0.1:8443** |
| 5 | Activate | Follow the on-screen /start flow — verify email, activate trial or enter license |
| 6 | Configure | Go to /settings, enter Schwab App Key, App Secret, Account Number |
| 7 | Trade | Dashboard shows your account, positions, quotes, and order history |

> First launch shows a browser security warning — expected for a local self-signed certificate. Click Advanced > Proceed to 127.0.0.1.

## 3. License Activation

**New Users:**
1. Open /start, enter your email
2. Click "Send Verification Link". Check your inbox (and spam folder). Click the verification link, return to /start and click "Verify Email"
3. Choose either **7-Day Free Trial** (immediate activation) or **I Have a License** (enter your key manually)
4. On success, the app saves License:Key and License:Email to local config
5. Go to /settings to enter Schwab API credentials

**Important:** The app never reveals a license key by email lookup. Verification links are single-use.

**Existing Users:** Go directly to /settings and enter your License Key and Email manually.

**Free Trial:** 7 days, full functionality, 1 device. One trial per email per product (even after expiry, no new trial). Email verification required before activation.

**Renewal:** After successful payment via purchase link, license auto-extends. If expired: +30 days from payment time. If active: +30 days from current expiry.

## 4. Initial Configuration

After activation, go to **/settings**:

| Field | Required | Description |
|-------|----------|-------------|
| License Key | Yes | Your license key (QIF-xxxx format) |
| Email | Yes | The email associated with your license |
| Schwab App Key | Yes | Your Schwab API Client ID |
| Schwab App Secret | Yes | Your Schwab API Client Secret |
| Schwab Account Number | Yes | Your Schwab account number |
| Redirect URI | No | Default: https://127.0.0.1:8443/signin-oidc |

Click Save. The app will automatically restart.

## 5. Dashboard

The Dashboard at /dashboard auto-refreshes every 60 seconds.

| Section | Displays |
|---------|----------|
| Account Summary | Total value, cash balance, buying power, unrealized/realized P&L |
| Positions | Current holdings with cost basis and unrealized P&L |
| Real-Time Quotes | Stock quotes with bid/ask, last price, volume, change |
| Options Chain | Options data (strike, expiration, type, bid/ask, last, volume, OI) |
| Order History | Last 60 days of orders with execution details |
| Token Status | Access token expiry, refresh token status, next re-auth due |
| MFA Status | Detected during re-auth: auto-reauth suspended, manual intervention needed |
| Cookie Status | Schwab login session cookie health |
| Connection Status | Last successful license validation timestamp |

## 6. API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/v1/accounts | GET | List all linked accounts |
| /api/v1/accounts/{accountNumber}/positions | GET | Current positions with P&L |
| /api/v1/marketdata/quotes | GET | Real-time quotes |
| /api/v1/marketdata/chains | GET | Options chain (strike, expiration, type, bid/ask, last, volume, OI) |
| /api/v1/accounts/{accountNumber}/orders | GET/POST | Order history / Place order |
| /api/v1/marketdata/pricehistory | GET | OHLCV candlestick data |

Full API documentation available in-app when the application is running.

## 7. Unattended Operation

| Challenge | Solution | Duration |
|-----------|----------|----------|
| Access token 30 min expiry | Background refresh every 15 min | Unlimited |
| Refresh token 7 day expiry | Automated browser re-login on day 6.5 with 30-hour retry window | Unlimited |
| MFA challenge after login | App detects MFA and suspends auto-reauth. User must complete authorization in a browser manually. | Manual intervention required |
| SSL certificate expiry | Auto-renewed when less than 30 days remaining | 5 years |
| Network disruption | Exponential backoff retry for automatic recovery | Auto-recovery |

**Recommendations for 24/7 operation:** Ensure stable internet connection. Note: MFA challenges cannot be automated — monitor the application status and handle manually when notified.

## 8. FAQ

| Question | Answer |
|----------|--------|
| Can I run on multiple machines? | One license binds to 1 device. Contact us for multi-device plans. |
| Lost license key? | Contact support with purchase email. |
| Run on a VPS? | Intranet-only deployment. No public internet exposure allowed. |
| Does it need internet? | Yes, for Schwab API and LicenseForge validation. Trading data stays local. |
| Trial expired? | Purchase a license and enter in /settings. |
| How to renew? | Use the purchase link. License auto-extends after successful payment. |
| Browser says "not private"? | Expected for local self-signed certificate. Proceed anyway. |
| MFA challenge appears? | Auto-reauth is suspended. Re-authorize via Schwab OAuth in a browser manually, then restart the app. |

---

# 中文版

## 1. 简介

**Quant.Infra.Net.Pro** 是一款本地运行的 Web 应用，为 Charles Schwab（嘉信理财）交易账户提供无人值守的交易网关。它完全运行在您自己的电脑上，没有云中间商，数据不离开您的计算机。

它解决的核心问题：Schwab API Token 过期频繁（Access Token 30 分钟，Refresh Token 7 天），如果没有持续的手动干预，7x24 自动化交易几乎不可能。该应用自动化了整个 Token 生命周期，自动处理 OAuth 重授权、MFA 检测通知和 SSL 证书管理——全程无需用户操作。

## 2. 快速入门

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 下载 | 从 [GitHub Releases](https://github.com/memoryfraction/Quant.Infra.Net.Pro-Public/releases) 下载对应操作系统的 ZIP 包 |
| 2 | 解压 | 解压到任意文件夹 |
| 3 | 运行 | Windows：`Quant.Infra.Net.Pro.Web.exe`。macOS/Linux：`./Quant.Infra.Net.Pro.Web` |
| 4 | 打开浏览器 | 访问 **https://127.0.0.1:8443** |
| 5 | 激活 | 按 /start 页面指引验证邮箱，激活试用或输入 License |
| 6 | 配置 | 前往 /settings 输入 Schwab App Key、App Secret、Account Number |
| 7 | 开始交易 | 仪表盘显示账户、持仓、行情、订单历史 |

> 首次启动浏览器会显示安全警告——本地自签名证书的正常现象，按提示信任一次即可。

## 3. 授权激活

**新用户：**
1. 打开 /start 输入邮箱
2. 点击"发送验证链接"，查看收件箱（含垃圾邮件），点击验证链接后返回 /start 再次点击"验证邮箱"
3. 选择 **7 天免费试用**（立即激活）或 **我有 License**（手动输入授权码）
4. 激活成功后应用自动保存 License Key 和 Email 到本地配置
5. 前往 /settings 输入 Schwab API 凭据

**安全说明：** 应用不会通过邮箱查询来显示 License Key。验证链接一次性使用。

**已有用户：** 直接前往 /settings 手动输入 License Key 和 Email。

**免费试用：** 7 天，全部功能，1 台设备。同一邮箱同一产品仅可领取一次（过期后不再签发）。试用前需完成邮箱验证。

**续费：** 通过购买链接付款成功后 License 自动延长。已过期：从付款时间 +30 天。未过期：从当前过期时间 +30 天。

## 4. 初始配置

激活后前往 **/settings**：

| 字段 | 必填 | 说明 |
|------|------|------|
| License Key | 是 | 授权码（QIF-xxxx 格式） |
| Email | 是 | 购买授权时使用的邮箱 |
| Schwab App Key | 是 | Schwab API Client ID |
| Schwab App Secret | 是 | Schwab API Client Secret |
| Schwab Account Number | 是 | Schwab 账户号 |
| Redirect URI | 否 | 默认：https://127.0.0.1:8443/signin-oidc |

点击 Save。应用自动重启。

## 5. 仪表盘

/dashboard 每 60 秒自动刷新。

| 区域 | 内容 |
|------|------|
| 账户摘要 | 账户总值、现金余额、购买力、未实现/已实现盈亏 |
| 持仓 | 当前持仓及成本价、未实现盈亏 |
| 实时行情 | 股票实时报价（买卖价、最新价、成交量、涨跌幅） |
| 期权链 | 期权数据（行权价、到期日、类型、买卖价、最新价、成交量、持仓量） |
| 订单历史 | 最近 60 天订单记录 |
| Token 状态 | Access Token 过期时间、Refresh Token 状态、下次重授权时间 |
| MFA 状态 | 重授权时检测到 MFA：自动重授权已暂停，需手动处理 |
| Cookie 状态 | Schwab 会话 Cookie 健康状况 |
| 连接状态 | 上次成功 License 验证的时间戳 |

## 6. API 参考

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/v1/accounts | GET | 查询所有关联账户 |
| /api/v1/accounts/{accountNumber}/positions | GET | 当前持仓及盈亏 |
| /api/v1/marketdata/quotes | GET | 实时行情报价 |
| /api/v1/marketdata/chains | GET | 期权链（行权价、到期日、类型、买卖价、最新价、成交量、持仓量） |
| /api/v1/accounts/{accountNumber}/orders | GET/POST | 订单历史 / 下单 |
| /api/v1/marketdata/pricehistory | GET | OHLCV 蜡烛图数据 |

应用运行时可通过 **/api** 查看完整 API 文档。

## 7. 无人值守运行

| 挑战 | 方案 | 时长 |
|------|------|------|
| Access Token 30 分钟过期 | 后台每 15 分钟自动刷新 | 无限制 |
| Refresh Token 7 天过期 | 代码操控浏览器自动重新登录，第 6.5 天触发，30 小时重试窗口 | 无限制 |
| MFA 二次验证 | 应用检测到 MFA 后暂停自动重授权，需用户在浏览器中手动完成授权 | 需手动处理 |
| SSL 证书到期 | 到期前 30 天自动续期 | 5 年 |
| 网络中断 | 指数退避重试，自动恢复 | 自动恢复 |

**7x24 运行建议：** 确保稳定的网络连接。注意：MFA 二次验证无法自动化绕过——请关注应用运行状态，在收到通知时及时手动处理。

## 8. 常见问题

| 问题 | 回答 |
|------|------|
| 一个 License 能否在多台机器上运行？ | 每份授权绑定 1 台设备。多设备请联系客服。 |
| 丢失授权码怎么办？ | 携带购买邮箱联系客服。 |
| 可以在 VPS 上运行吗？ | 可以，仅限内网部署，严禁公网暴露。 |
| 需要联网吗？ | 需要连接 Schwab API 和验证 License。交易数据保留在本地。 |
| 试用过期了怎么办？ | 购买 License 后在 /settings 中输入。 |
| 如何续费？ | 使用购买链接，付款后 License 自动延长。 |
| 浏览器显示不安全警告？ | 自签名证书的正常现象，继续前往即可。 |
| 遇到 MFA 二次验证怎么办？ | 自动重授权已暂停。请在浏览器中手动完成 Schwab OAuth 授权后重启应用。 |

---

> **Support / 支持**  
> Telegram: https://t.me/+VPy-VLis8gVmYWM1  
> Email: alphawealthlab@outlook.com  
> Website: www.alpha-wealth-lab.com
