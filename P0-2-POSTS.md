# P0-2 发布帖草稿（发不发、什么时间发，由 Rex 决定）

> 原则：发布帖的目的是吃「新发布」搜索红利 + 把下载导向订阅/审计对话。
> 建议发布窗口（供参考，最终由你定）：美东 8:00-10:00（.NET 开发者高峰），避开周五下午。
> 两篇帖建议间隔 2-3 天，不要同天发（吃两次搜索红利）。

---

## 帖 1 - HealthData.Interop.Fhir 1.3.4 发布（Medium / LinkedIn）

### 标题（Medium）
**HealthData.Interop.Fhir 1.3.4：FHIR R4/R5 合规又往前了一步（附 12 个坑 Checklist）**

### 正文（Medium，约 600 词，可直接贴）

FHIR 互操作性的真正难点从来不是「能不能发 Bundle」，而是「能不能在 21st Century Cures Act / HIPAA 审计里站得住」。

**1.3.4 新增 / 修复：**
- （在这里填 1.3.4 的 3-5 个核心变更，从 CHANGELOG 摘）
- 语义校验覆盖 R4 + R5 双 Profile
- 审计事件（AuditEvent）生成对齐 US Core

**为什么 1.3.4 值得升级：**
1. 旧版本在 Companion Guide 校验上会漏 2 类错误（举 1 个真实例子）
2. 1.3.4 的 AuditEvent 模板可直接被 ONC 审计脚本读取
3. 零 breaking change，1 行 `dotnet add package` 即可

**Quick Start（3 行代码）：**
```csharp
var fhir = new HealthData.Interop.Fhir.Client();
var bundle = await fhir.ValidateAsync(resource, profile: "us-core-patient");
await fhir.EmitAuditEvent(bundle);
```

**免费领取：《FHIR R4/R5 合规实施 Checklist》**
通往 21st Century Cures Act 认证路上最常见的 12 个坑 —— 整理成一份可打印的 PDF。
-> https://mailchi.mp/83cafe450eef/rex-landing-page

如果你正在做 FHIR 互操作，且对审计结果不放心，可以约 30 分钟聊聊：https://calendly.com/rex-fan18/30min

#FHIR #HealthIT #21stCenturyCuresAct #dotnet #Interoperability

---

## 帖 2 - Quant.Infra.Net 1.5.3 发布（Medium / LinkedIn）

### 标题
**Quant.Infra.Net 1.5.3：Schwab / IB / Binance 统一 API，token 生命周期自动化**

### 正文（约 400 词）

做量化最烦的不是策略，是「每家券商 API 都不一样 + token 过期要手动刷」。

**1.5.3 核心能力：**
- Schwab / IB / Binance 三家统一 `IOrderRouter` 接口，一处切换
- token 生命周期自动管理（刷新 / 持久化 / 并发安全）
- 本地部署，策略代码不出你的机器

**Quick Start：**
```csharp
var q = new Quant.Infra.Net.Client(new SchwabCredential(...));
var orders = await q.GetOpenOrdersAsync();
await q.PlaceAsync(new Order { Symbol = "SPY", Qty = 1, Side = Buy });
```

**本地部署、any-language 调用** —— 完整文档 + 示例：https://www.alpha-wealth-lab.com/

#QuantTrading #Schwab #dotnet #API #FinTech

---

## LinkedIn 短版（两帖各一条，可直接贴）

**HealthData 1.3.4：**
FHIR R4/R5 合规又往前了一步 -> HealthData.Interop.Fhir 1.3.4 发布。
零 breaking change，AuditEvent 对齐 US Core，Companion Guide 校验覆盖更全。
附赠：12 个合规坑 Checklist（PDF 免费）-> [链接]
约 30 分钟聊审计 -> [Calendly]

**Quant 1.5.3：**
Schwab / IB / Binance 统一 API + token 生命周期自动化 -> Quant.Infra.Net 1.5.3 发布。
本地部署、any-language 调用 -> [网站]

---

## 发布清单（你决定时间后按此执行）
| 步骤 | 渠道 | 内容 | 耗时 |
|---|---|---|---|
| 1 | Medium | 帖 1 全文 | 20 min 排版 |
| 2 | LinkedIn | 帖 1 短版 + 评论贴 Medium 链接 | 5 min |
| 3 | GitHub | HealthData 1.3.4 Release（CHANGELOG 自动生成） | 15 min |
| 4 | Medium | 帖 2 全文 | 15 min |
| 5 | LinkedIn | 帖 2 短版 | 5 min |
| 6 | GitHub | Quant 1.5.3 Release | 10 min |
| 7 | 邮件 | Mailchimp 列表推 1 条（1.3.4 + Checklist CTA） | 10 min |

> 总耗时约 1.5 小时，全部在你选定的发布日当天完成。