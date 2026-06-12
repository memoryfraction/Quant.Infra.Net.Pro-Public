# Charles Schwab Developer Registration Guide / Schwab 开发者注册指南

> **Version:** 1.0.0 | **适用于 / Applies to:** Quant.Infra.Net.Pro v1.0.0+
>
> ⚠️ **必读前提 / Prerequisite:** 请先完成本指南，拿到 **App Key** 与 **App Secret** 后再购买订阅。购买后请参阅部署指南进行部署。
>
> ⚠️ Complete this guide first to obtain your **App Key** and **App Secret** before purchasing a subscription.

---

## 目录 / Table of Contents

1. [前置条件 / Prerequisites](#1-前置条件--prerequisites)
2. [注册 Schwab Developer 账号 / Register Schwab Developer Account](#2-注册-schwab-developer-账号--register-schwab-developer-account)
3. [创建 App 并获取凭据 / Create App & Get Credentials](#3-创建-app-并获取凭据--create-app--get-credentials)
4. [配置 Callback URL / Configure Callback URL](#4-配置-callback-url--configure-callback-url)
5. [等待审批 / Wait for Approval](#5-等待审批--wait-for-approval)
6. [常见问题 / FAQ](#6-常见问题--faq)

---

## 1. 前置条件 / Prerequisites

| 条件 / Requirement | 说明 / Details |
|-------------------|----------------|
| **Charles Schwab 交易账户 / Brokerage Account** | 访问 https://www.schwab.com/ 开户。若已有账户则直接使用。<br>Visit schwab.com to open an account, or use your existing one. |
| **Schwab Developer Portal 账号 / Portal Account** | 需要与你的 Schwab 交易账户关联。使用相同的登录凭据。<br>Linked to your Schwab brokerage credentials. |
| **个人邮箱 / Personal Email** | 用于接收审核通知。<br>For receiving approval notifications. |

---

## 2. 注册 Schwab Developer 账号 / Register Schwab Developer Account

1. 打开浏览器，访问 **Schwab Developer Portal**：<br>**https://developer.schwab.com/**

2. 点击页面右上角的 **Log In** 按钮。使用你的 Schwab 交易账户凭据登录。<br>Click the **Log In** button in the top-right corner and enter your Schwab brokerage credentials.

3. 首次登录时，系统会要求你接受 **Developer Portal Terms of Service**（开发者门户服务条款）。仔细阅读条款后勾选同意并提交。<br>On first login, accept the **Developer Portal Terms of Service**.

4. 登录成功后，你将进入 **Dashboard**（控制台页面）。<br>After successful login, you will see the **Dashboard**.

---

## 3. 创建 App 并获取凭据 / Create App & Get Credentials

### 步骤 / Steps

1. 在 Dashboard 中，点击 **Create App** 按钮。<br>On the Dashboard, click the **Create App** button.

2. 填写 App 信息 / Fill in App Details:

   | 字段 / Field | 填写内容 / Value |
   |-------------|-----------------|
   | **App Name** | 自定义名称，例如 `MyTradingApp`（建议包含标识以便日后管理） |
   | **App Description** | 简要说明用途，例如 `Automated trading integration` |
   | **App Type** | **必须选择 Private App（私有应用）** — 只有你自己的账户可以使用此 App。<br>**Must select Private App.** |

3. 在 **Callback URL(s)** 字段中，填写：<br>In the **Callback URL(s)** field, enter:

   ```
   https://127.0.0.1:8443/
   ```

   > 这是 OAuth 授权回调地址。Quant.Infra.Net.Pro.Web 默认使用 8443 端口监听此回调。<br>This is the OAuth callback URL.

4. 提交 App 申请。<br>Submit the app application.

5. 提交成功后，进入 App 详情页面，你可以看到：<br>After submission, the App details page shows:
   - **App Key**（Client ID）
   - **App Secret**（Client Secret）— 点击 **Show Secret** 查看

6. **立即记录 App Key 和 App Secret，保存到安全位置。**<br>**Immediately record App Key and App Secret in a secure location.**

   > 离开此页面后，App Secret 将不再完整显示。如果遗失，你需要重新生成。<br>After leaving this page, the App Secret will no longer be fully visible.

---

## 4. 配置 Callback URL / Configure Callback URL

Callback URL（也称 Redirect URI）是 OAuth 授权流程中至关重要的配置。**三处必须完全一致**：

| 配置位置 | 值 / Value |
|---------|-----------|
| Schwab Developer Portal Callback URL | `https://127.0.0.1:8443/` |
| Quant.Infra.Net.Pro appsettings.json OAuth:RedirectUri | `https://127.0.0.1:8443/` |
| Kestrel HTTPS 监听地址 (Urls) | `https://127.0.0.1:8443` |

**检查清单 / Checklist:**

| 检查项 | 说明 |
|--------|------|
| ✅ 协议一致 | 必须使用 `https://` |
| ✅ 主机名一致 | 必须使用 `127.0.0.1`，不要用 `localhost` |
| ✅ 端口号一致 | 默认 `8443`，如果修改请保持一致 |
| ✅ 尾部斜杠必须有 | Callback URL 和 RedirectUri 必须以 `/` 结尾 |
| ✅ 保存后等待 | 修改 Schwab 门户配置后，等待 **几分钟** 使配置生效 |

> 如果在部署时修改了端口号，记得同步更新 Developer Portal 中的 Callback URL。

---

## 5. 等待审批 / Wait for Approval

1. 提交 App 后，状态显示为 **Pending Review**（待审核）。<br>After submission, the App status shows as **Pending Review**.

2. Schwab 团队通常在 **2–5 个工作日** 内完成审核。<br>The Schwab team usually completes the review within **2–5 business days**.

3. 审核通过后，App 状态变为 **Approved**（已批准）。<br>Once approved, the App status changes to **Approved**.

4. 此时你的 App Key 和 App Secret 可用于配置 Quant.Infra.Net.Pro。<br>Your credentials are now ready.

> **建议**: 提交 App 后立即购买订阅，两者互不依赖。<br>**Tip**: Submit your App application and purchase the subscription simultaneously.

---

## 6. 常见问题 / FAQ

### 1. 收不到验证邮件？<br>Can't receive the verification email?

- 检查垃圾邮件/广告邮件文件夹。<br>Check your spam or promotions folder.
- 确认使用的是 Schwab 交易账户关联的邮箱。<br>Confirm the email linked to your Schwab account.

### 2. App Key 和 App Secret 有什么区别？<br>Difference between App Key and App Secret?

- **App Key** (Client ID) — 公开标识符，用于识别你的 App。<br>Public identifier for your app.
- **App Secret** (Client Secret) — 机密凭据，用于验证 App 身份。**绝不能分享或公开。**<br>Secret credential. **Never share or expose it.**

### 3. Private App 和 Public App 的区别？<br>Private App vs Public App?

| | Private App | Public App |
|--|------------|-----------|
| 适用范围 | 仅自己的 Schwab 账户 | 任何 Schwab 用户均可使用 |
| 审核周期 | 2–5 个工作日 | 更长，需安全审查 |
| 适用场景 | 个人量化交易 | 分发给第三方使用 |

> 如果你是个人交易者，**务必选择 Private App**。

### 4. 遗忘 App Secret 怎么办？<br>Lost the App Secret?

- 登录 Schwab Developer Portal，进入 App 详情页重新生成（旧 Secret 立即失效）。<br>Log in to the Developer Portal and regenerate it (the old one immediately becomes invalid).

### 5. 审批被拒绝？<br>Application rejected?

- 检查 App Name 和 Description 是否明确说明用途。<br>Check if the App Name and Description are clear.
- 确认 Callback URL 格式正确。<br>Confirm the Callback URL format.
- 联系 Schwab Developer Support: traderapi@schwab.com

---

## 下一步 / Next Steps

完成本指南后，您已拥有：

- ✅ Schwab App Key (Client ID)
- ✅ Schwab App Secret (Client Secret)
- ✅ Callback URL 已配置为 `https://127.0.0.1:8443/`
- ✅ App 状态为 Approved

现在可以前往**[官网购买订阅](https://www.alpha-wealth-lab.com/)**，然后参阅部署指南进行本地部署。

After completing this guide, you now have:

- ✅ Schwab App Key (Client ID)
- ✅ Schwab App Secret (Client Secret)
- ✅ Callback URL set to `https://127.0.0.1:8443/`
- ✅ App status: Approved

Now you can **[purchase a subscription](https://www.alpha-wealth-lab.com/)** and follow the deployment guide.

---

> **Support / 支持**<br>Telegram: https://t.me/+VPy-VLis8gVmYWM1<br>Email: alphawealthlab@outlook.com<br>Website: https://www.alpha-wealth-lab.com/
