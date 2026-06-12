# Charles Schwab Developer Registration Guide / Charles Schwab Developer 注册指南

> **Applies to / 适用于:** Quant.Infra.Net.Pro | **Last updated / 最后更新:** 2026-06-12

---

## Overview / 概述

To use Quant.Infra.Net.Pro, you need a set of Charles Schwab API credentials (App Key / Client ID and App Secret / Client Secret). This guide walks you through registering as a Charles Schwab Developer, creating an application, and obtaining your credentials.

要使用 Quant.Infra.Net.Pro，您需要申请 Charles Schwab API 凭据（App Key / Client ID 和 App Secret / Client Secret）。本指南将引导您完成 Charles Schwab Developer 注册、创建应用和获取凭据的全过程。

---

# English

## Prerequisites

| Requirement | Description |
|-------------|-------------|
| Charles Schwab Brokerage Account | You must have an active Schwab brokerage account. If you don't have one, open an account at [schwab.com](https://www.schwab.com). |
| Email Address | A valid email address for receiving approval notifications from Schwab. |
| Time | The application review typically takes **2–5 business days**. |

## Step-by-Step Guide

### Step 1: Access the Schwab Developer Portal

1. Open your browser and navigate to the **Schwab Developer Portal**:
   **https://developer.schwab.com**

2. Click the **"Register"** or **"Get Started"** button on the homepage.

### Step 2: Create Your Developer Account

Fill in the registration form with the following information:

| Field | Description |
|-------|-------------|
| Organization Name | Your company name, or your personal name if you're an individual trader |
| First Name | Your first name |
| Last Name | Your last name |
| Email | Your email address (this will be used for all communications) |
| Phone | Your phone number |
| Password | Create a strong password |
| Confirm Password | Re-enter your password |

> ![Charles Developer Registry](images/Charles%20Schwab/Charles%20Developer%20Registry.jpg)
>
> *Figure 1: Schwab Developer Registration form*

After submitting the form, you will receive a confirmation email. Click the verification link in the email to activate your account.

### Step 3: Log In and Create an Application

1. Log in to the Schwab Developer Portal with your new credentials.
2. Navigate to **"My Applications"** or **"Apps"** section.
3. Click **"Create Application"** or **"Add New App"**.

### Step 4: Configure Your Application

Fill in the application details:

| Field | Value |
|-------|-------|
| Application Name | Any name you like, e.g., "My Trading Bot" |
| Description | Brief description of your application |
| OAuth Redirect URI | **https://127.0.0.1:8443/signin-oidc** (this is the default Redirect URI used by Quant.Infra.Net.Pro) |

> **Important:** The Redirect URI must match exactly what you enter in Quant.Infra.Net.Pro settings. The default is https://127.0.0.1:8443/signin-oidc.

> ![Charles Developer Registry Ready](images/Charles%20Schwab/Charles%20Developer%20Registry%20Ready.jpg)
>
> *Figure 2: Developer registration confirmation / ready screen*

### Step 5: Review and Submit

Review your application details and submit for review.

Schwab will review your application. The review process typically takes **2–5 business days**. You will receive an email notification once your application is approved.

### Step 6: Retrieve Your Credentials

Once approved:

1. Log in to the Schwab Developer Portal.
2. Go to **"My Applications"**.
3. Click on your approved application.
4. You will see your **App Key (Client ID)** and **App Secret (Client Secret)**.
5. Copy both values — you will need them for Quant.Infra.Net.Pro configuration.

### Step 7: Find Your Account Number

Your Schwab account number can be found:

- In your Schwab brokerage account dashboard after logging in at **schwab.com**
- On your account statements
- In the Schwab mobile app under Account Information

### Step 8: Test the API (Optional)

Schwab provides a Swagger-based API documentation where you can test endpoints directly:

> ![WebApi Swagger](images/Charles%20Schwab/WebApi%20Swagger.jpg)
>
> *Figure 3: Schwab Web API Swagger interface*

The API includes endpoints for:

| Endpoint Category | Description |
|-------------------|-------------|
| Accounts | List accounts, get account details |
| Quotes | Real-time stock quotes |
| Options Chain | Options data (strike, expiration, type, bid/ask) |
| Orders | Place orders, view order history |
| Positions | View current holdings |
| Transactions | View account transactions |

> ![Account](images/Charles%20Schwab/Account.jpg)
> *Figure 4: Account API example*

> ![Quote](images/Charles%20Schwab/Quote.jpg)
> *Figure 5: Quote API example*

> ![Positions](images/Charles%20Schwab/Positions.jpg)
> *Figure 6: Positions API example*

> ![Order History](images/Charles%20Schwab/Order%20History.jpg)
> *Figure 7: Order History API example*

> ![Option Chain](images/Charles%20Schwab/Option%20Chain.jpg)
> *Figure 8: Options Chain API example*

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Registration email not received | Check spam folder. Add developer.schwab.com to your safe senders list. |
| Application rejected | Ensure your Redirect URI is correctly configured. Contact Schwab Developer support for details. |
| App Key / Secret not working | Verify you've copied the values correctly. Note: App Secret is only shown once — regenerate if lost. |
| OAuth error during authentication | Ensure the Redirect URI in your Schwab app matches exactly with what's configured in Quant.Infra.Net.Pro settings. |

---

# 中文版

## 前置条件

| 条件 | 说明 |
|------|------|
| Charles Schwab 交易账户 | 您必须拥有一个活跃的 Schwab 交易账户。如尚未开户，请访问 [schwab.com](https://www.schwab.com) 开户。 |
| 邮箱地址 | 用于接收 Schwab 审核通知的有效邮箱。 |
| 时间 | 应用审核通常需要 **2–5 个工作日**。 |

## 详细步骤

### 第一步：访问 Schwab Developer Portal

1. 打开浏览器，访问 **Schwab Developer Portal**：
   **https://developer.schwab.com**

2. 点击首页上的 **"Register"** 或 **"Get Started"** 按钮。

### 第二步：创建 Developer 账号

填写注册表单：

| 字段 | 说明 |
|------|------|
| Organization Name | 公司名称或个人姓名 |
| First Name | 名 |
| Last Name | 姓 |
| Email | 邮箱地址（用于接收所有通知） |
| Phone | 电话号码 |
| Password | 创建强密码 |
| Confirm Password | 确认密码 |

> ![Charles Developer Registry](images/Charles%20Schwab/Charles%20Developer%20Registry.jpg)
>
> *图 1：Schwab Developer 注册表单*

提交后，您将收到确认邮件，点击邮件中的验证链接激活账号。

### 第三步：登录并创建应用

1. 使用新凭据登录 Schwab Developer Portal。
2. 进入 **"My Applications"** 或 **"Apps"** 部分。
3. 点击 **"Create Application"** 或 **"Add New App"**。

### 第四步：配置应用

填写应用详情：

| 字段 | 值 |
|------|-----|
| Application Name | 任意名称，例如 "My Trading Bot" |
| Description | 应用简要描述 |
| OAuth Redirect URI | **https://127.0.0.1:8443/signin-oidc**（Quant.Infra.Net.Pro 默认使用的 Redirect URI） |

> **重要：** Redirect URI 必须与 Quant.Infra.Net.Pro 设置中输入的 URI 完全一致。默认值为 https://127.0.0.1:8443/signin-oidc。

> ![Charles Developer Registry Ready](images/Charles%20Schwab/Charles%20Developer%20Registry%20Ready.jpg)
>
> *图 2：Developer 注册确认/就绪界面*

### 第五步：提交审核

检查应用详情无误后提交审核。

Schwab 将审核您的应用，通常需要 **2–5 个工作日**。审核通过后您将收到邮件通知。

### 第六步：获取凭据

审核通过后：

1. 登录 Schwab Developer Portal。
2. 进入 **"My Applications"**。
3. 点击已通过审核的应用。
4. 查看您的 **App Key（Client ID）** 和 **App Secret（Client Secret）**。
5. 复制这两个值——配置 Quant.Infra.Net.Pro 时需要用到。

### 第七步：查找账户号

您的 Schwab 账户号可通过以下方式查找：

- 在 **schwab.com** 登录后的账户仪表盘中查看
- 在账户对账单上
- 在 Schwab 移动应用的账户信息中

### 第八步：测试 API（可选）

Schwab 提供基于 Swagger 的 API 文档，可直接测试接口：

> ![WebApi Swagger](images/Charles%20Schwab/WebApi%20Swagger.jpg)
>
> *图 3：Schwab Web API Swagger 界面*

API 包含以下端点：

| 端点分类 | 说明 |
|----------|------|
| Accounts | 查询账户列表和详情 |
| Quotes | 实时股票行情 |
| Options Chain | 期权数据（行权价、到期日、类型、买卖价） |
| Orders | 下单和查询订单历史 |
| Positions | 查看当前持仓 |
| Transactions | 查看账户交易记录 |

> ![Account](images/Charles%20Schwab/Account.jpg)
> *图 4：Account API 示例*

> ![Quote](images/Charles%20Schwab/Quote.jpg)
> *图 5：Quote API 示例*

> ![Positions](images/Charles%20Schwab/Positions.jpg)
> *图 6：Positions API 示例*

> ![Order History](images/Charles%20Schwab/Order%20History.jpg)
> *图 7：Order History API 示例*

> ![Option Chain](images/Charles%20Schwab/Option%20Chain.jpg)
> *图 8：Options Chain API 示例*

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 注册邮件未收到 | 检查垃圾邮件文件夹，将 developer.schwab.com 加入白名单。 |
| 应用被拒绝 | 确保 Redirect URI 配置正确。联系 Schwab Developer 支持获取详情。 |
| App Key / Secret 无效 | 确认已正确复制值。注意：App Secret 仅显示一次——丢失需重新生成。 |
| OAuth 验证失败 | 确保 Schwab 应用中的 Redirect URI 与 Quant.Infra.Net.Pro 设置中配置的 URI 完全一致。 |

---

> **Support / 支持**  
> Telegram: https://t.me/+VPy-VLis8gVmYWM1  
> Email: alphawealthlab@outlook.com  
> Website: www.alpha-wealth-lab.com
