# Data Privacy Statement / 数据隐私声明

> **Document Version:** 1.0.0 | **Last Updated:** 2026-06-10
>
> **Applies to:** Quant.Infra.Net.Pro (all versions)
>
> **适用于：** Quant.Infra.Net.Pro（全部版本）

---

# English

Quant.Infra.Net.Pro runs entirely on your machine. Our design principle is **your data stays yours**. This document transparently states what data leaves your computer for license authorization and product quality improvement, and what data remains local and is never uploaded.

## 1. Data Uploaded to Our Server

The following data is sent over HTTPS to our license validation server, LicenseForge at `https://api.quant.infra.net`, solely for license authorization and product quality improvement. We do not use this data for any other purpose.

### Fields Transmitted

| Field | Type | Purpose | Necessity |
|-------|------|---------|-----------|
| `license_key` | String | License validation: checks validity and expiry | Required |
| `product_code` | String | Product identification | Required |
| `email` | String | License-user binding verification | Required |
| `device_id` | String | Device binding using `Environment.MachineName`, for concurrent-device control | Required |
| `action` | String | Action label, such as `validate`, `activate`, or `telemetry` | Product quality |
| `timestamp` | UTC time | Records when the validation request occurred | Required |
| `client_ip` | String | Public IP fetched by the client from `https://api.ipify.org`, sent for server-side country-level geolocation, cached for 30 minutes | Product quality |

### Transmission Policy

| Behavior | Details |
|----------|---------|
| Trigger | On app startup and on each business operation, subject to cache |
| Cache | Validation results are cached locally. No network request is sent while cache is valid |
| Network resilience | Network errors do not block app usage. If cache expires and the network is unreachable, the app continues working and retries on the next request |
| Encryption | All data is transmitted over HTTPS TLS 1.2+ |
| Server-side processing | Geolocation is server-side. The client sends only IP, no city or region data |

### Data We Do Not Upload

| Category | Items | Notes |
|----------|-------|-------|
| All trading data | Account balances, positions, orders, executions, P&L data, market data, option chains | Never leaves your machine |
| Schwab API credentials | App Key (Client ID), App Secret (Client Secret), Account Number, Schwab Login ID, Schwab Password | Stored only in local `appsettings.json` |
| OAuth tokens | Access Token, Refresh Token | Encrypted with Windows DPAPI and stored locally at `%APPDATA%/Quant.Infra.Net.Pro/tokens.dat` |
| App configuration | All contents of `appsettings.json` | Stored only locally |
| Log files | All application logs | Written only to local disk |

## 2. How Data Is Stored

### Local Storage

| Data Type | Location | Encryption |
|-----------|----------|------------|
| Schwab API credentials | `<app_root>/appsettings.json` | Plain text, protected by filesystem permissions |
| OAuth tokens | `%APPDATA%/Quant.Infra.Net.Pro/tokens.dat` | Windows DPAPI encryption via `ProtectedData.Protect`, bound to the current Windows user. No DPAPI protection on macOS/Linux |
| App configuration, including License Key | `<app_root>/appsettings.json` | Plain text, protected by filesystem permissions |

### Server-Side Storage

| Data Type | Retention | Purpose |
|-----------|-----------|---------|
| License validation records | Active subscription period + 90 days | License management, renewal validation, abuse prevention |
| Anonymized operation logs | 180 days | Product quality improvement through aggregate analysis, not tied to personal identity |

> We do not sell, rent, or share your data with any third party. We do not disclose your data to any organization unless legally compelled.

## 3. What This Means For You

### Your Data Is Safe

| Commitment | Details |
|------------|---------|
| Zero upload of trading data | Balances, positions, orders, P&L, and all other trading data never leave your machine |
| Zero upload of API credentials | Schwab App Key, App Secret, username, and password stay on your machine only |
| Token encryption | OAuth tokens are persisted using OS-level encryption on Windows DPAPI, unreadable by other users or programs |
| Local deployment | No cloud intermediary. All trading requests go directly from your machine to Schwab API |

### Your Responsibilities

| Note | Details |
|------|---------|
| Public exposure | Never expose the app port to the public internet. Local, intranet, or private VPS only |
| Configuration protection | `appsettings.json` contains sensitive data. Ensure proper filesystem permissions |
| License Key security | The License Key is your sole authorization credential. Do not share it |

## 4. Technical Architecture Overview

```text
Your Machine
├─ appsettings.json
│  ├─ Schwab App Key / Secret
│  ├─ Account Number
│  ├─ License Key / Email
│  └─ Urls / RedirectUri
├─ tokens.dat (DPAPI on Windows)
│  ├─ Access Token
│  └─ Refresh Token
└─ Quant.Infra.Net.Pro.Web
   ├─ LicenseTelemetryService
   │  └─ HTTPS -> LicenseForge Server
   │     uploads only license_key, product_code, device_id, action, timestamp, client_ip, email
   └─ Trading requests
      └─ HTTPS -> Schwab API
         account, positions, orders, quotes, option chains
```

## 5. Change History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-10 | Initial release: comprehensive data privacy statement |

## Contact

For any data privacy questions, please contact:

- **Email:** alphawealthlab@outlook.com
- **Telegram:** https://t.me/+VPy-VLis8gVmYWM1

---

# 中文版

Quant.Infra.Net.Pro 是一款本地运行的应用，设计原则是**你的数据归你所有**。本文档明确说明：哪些数据会离开你的计算机，用于授权管理和产品质量改进；哪些数据永久保存在本地，永远不会被上传。

## 1. 会上传至技术服务商服务器的数据

以下数据通过 HTTPS 加密连接发送至我们的授权验证服务器 LicenseForge，地址为 `https://api.quant.infra.net`，仅用于授权管理和产品质量改进。我们不会将这些数据用于任何其他目的。

### 发送的数据字段

| 字段 | 类型 | 用途 | 必要性 |
|------|------|------|--------|
| `license_key` | 字符串 | 授权验证：验证 License 是否有效、是否过期 | 必需 |
| `product_code` | 字符串 | 产品标识，区分不同版本和产品线 | 必需 |
| `email` | 字符串 | 授权关联，确认 License 与用户的绑定关系 | 必需 |
| `device_id` | 字符串 | 设备标识，使用 `Environment.MachineName`（计算机名），用于设备绑定与并发控制 | 必需 |
| `action` | 字符串 | 操作标识，例如 `validate`、`activate` 或 `telemetry` | 产品改进 |
| `timestamp` | UTC 时间 | 记录验证请求发生的时间 | 必需 |
| `client_ip` | 字符串 | 公网 IP 地址，由客户端通过 `https://api.ipify.org` 获取后发送，用于服务端国家/地区级别地理定位，缓存 30 分钟 | 产品改进 |

### 发送策略

| 行为 | 说明 |
|------|------|
| 触发时机 | 应用启动时、每次业务操作时，但受缓存限制，并非每次请求都发送 |
| 缓存策略 | 验证结果在本地缓存，缓存有效期内不重复请求网络 |
| 网络容错 | 网络错误不影响应用正常使用。缓存过期但网络不可达时，应用继续工作，下次请求重试 |
| 数据加密 | 所有上传数据通过 HTTPS TLS 1.2+ 加密传输 |
| 服务端处理 | 所有地理定位由服务端完成，客户端仅发送 IP，不发送城市或区域信息 |

### 我们不会上传的数据

| 数据类别 | 数据项 | 说明 |
|----------|--------|------|
| 所有交易数据 | 账户余额、持仓、订单、成交记录、盈亏数据、行情数据、期权链 | 永不离开本地 |
| Schwab API 凭据 | App Key (Client ID)、App Secret (Client Secret)、Account Number、Schwab Login ID、Schwab Password | 仅存储在本地 `appsettings.json` |
| OAuth 令牌 | Access Token、Refresh Token | 使用 Windows DPAPI 加密存储于本地磁盘 `%APPDATA%/Quant.Infra.Net.Pro/tokens.dat` |
| 应用配置文件 | `appsettings.json` 的全部内容 | 仅存储在本地 |
| 日志文件 | 所有应用日志 | 仅写入本地磁盘 |

## 2. 数据存储方式

### 本地存储

| 数据类型 | 存储位置 | 加密方式 |
|----------|----------|----------|
| Schwab API 凭据 | `<app_root>/appsettings.json` | 明文，本地文件系统权限保护 |
| OAuth 令牌 | `%APPDATA%/Quant.Infra.Net.Pro/tokens.dat` | Windows DPAPI 加密（`ProtectedData.Protect`），绑定当前 Windows 用户。macOS/Linux 无 DPAPI 保护 |
| 应用配置（含 License Key） | `<app_root>/appsettings.json` | 明文，本地文件系统权限保护 |

### 服务端存储

| 数据类型 | 保留期限 | 用途 |
|----------|----------|------|
| License 验证记录 | 订阅有效期内 + 90 天 | 授权管理、续费验证、反滥用检测 |
| 操作日志（匿名化） | 180 天 | 产品质量改进，聚合分析，不关联个人身份 |

> 我们不会将你的数据出售、出租或分享给任何第三方。除非法律强制要求，我们不会向任何机构披露你的数据。

## 3. 对你意味着什么

### 你的数据安全

| 承诺 | 说明 |
|------|------|
| 交易数据零上传 | 你的账户余额、持仓、订单、盈亏等所有交易数据从不离开你的计算机 |
| API 凭据零上传 | Schwab App Key、App Secret、用户名和密码仅保存在你自己的机器上 |
| Token 加密存储 | OAuth Token 在 Windows 上使用操作系统级 DPAPI 加密持久化，其他用户或程序无法读取 |
| 本地部署 | 应用不包含云中间件，所有交易请求直接从你的机器发往 Schwab API |

### 你的责任

| 注意事项 | 说明 |
|----------|------|
| 公网暴露 | 严禁将应用端口暴露到公网。仅供本地、内网或私有 VPS 使用 |
| 配置文件保护 | `appsettings.json` 包含敏感信息。请确保文件系统权限正确 |
| License Key 安全 | License Key 是唯一授权凭证。不要分享给他人 |

## 4. 技术架构概览

```text
你的计算机
├─ appsettings.json
│  ├─ Schwab App Key / Secret
│  ├─ Account Number
│  ├─ License Key / Email
│  └─ Urls / RedirectUri
├─ tokens.dat（Windows DPAPI）
│  ├─ Access Token
│  └─ Refresh Token
└─ Quant.Infra.Net.Pro.Web
   ├─ LicenseTelemetryService
   │  └─ HTTPS -> LicenseForge Server
   │     仅上传 license_key、product_code、device_id、action、timestamp、client_ip、email
   └─ 交易请求
      └─ HTTPS -> Schwab API
         账户、持仓、订单、行情、期权链
```

## 5. 变更记录

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0.0 | 2026-06-10 | 初始版本：完整的数据隐私声明 |

## 联系方式

如有任何关于数据隐私的疑问，请联系：

- **Email:** alphawealthlab@outlook.com
- **Telegram:** https://t.me/+VPy-VLis8gVmYWM1
