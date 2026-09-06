# Cloudflare 安全配置（alpha-wealth-lab.com）P0-1 执行记录

> 目的：修复浏览器「不安全」标记 + 让 GitHub Pages 站点拿到完整安全响应头。
> 根因：GitHub Pages 无法设置 HTTP 响应头（HSTS 等只在 Cloudflare 边缘生效）；
> Cloudflare 当前 SSL 模式为 Flexible（边缘 HTTPS、回源 HTTP）且未配置 Transform Rules，
> 导致所有安全头缺失、http:// 可直达。

> 执行日期：2026-09-06 · 执行人：Rex Fan（Cloudflare 控制台，Chrome 已登录）

## 一、Cloudflare 控制台要改的 3 个地方（P0-1）

### 1. SSL/TLS → Edge Certificates
| 设置 | 原值 | 目标值 | 说明 |
|---|---|---|---|
| SSL/TLS Mode | Flexible | **Full (Strict)** | 边缘用 Let's Encrypt 证书（CN=alpha-wealth-lab.com，覆盖 *. 子域，有效期至 2026-10-27）；回源走 HTTPS |
| Minimum TLS Version | 1.0 | **1.2** | 满足 HSTS preload 要求 |

### 2. Rules → Transform Rules → Edit Response Headers（新增 6 条，Hostname 选 www.alpha-wealth-lab.com 和 alpha-wealth-lab.com）
| 动作 | Header Name | Header Value |
|---|---|---|
| Add header | strict-transport-security | max-age=31536000; includeSubDomains; preload |
| Add header | content-security-policy | default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none' |
| Add header | x-frame-options | DENY |
| Add header | x-content-type-options | nosniff |
| Add header | referrer-policy | strict-origin-when-cross-origin |
| Add header | permissions-policy | camera=(), microphone=(), geolocation=(), payment=(), usb=() |

（CSP 值与 index.html 的 meta http-equiv 保持一致。）

### 3. Rules → Transform Rules → Redirect Rules（新增 1 条）
- If: Hostname is alpha-wealth-lab.com and Scheme is http
- Then: Static redirect → https://{hostname}{uri} · Status code 301
- 目的：http:// 入口不再 200 直达，全部 301 到 https。

### 4. Cache（切换后）
- 切 Full (Strict) 后必须 Purge Everything（Caching → Purge Everything），否则旧响应头会继续被边缘缓存。

## 二、GitHub 仓库（本仓库）需要改的（P0-3：把 ~12.7/天下载转订阅）

| 文件 | 改动 | 状态 |
|---|---|---|
| index.html | 修正注释 + 补 X-Content-Type-Options: nosniff meta fallback | 已改 |
| 404.html | 补 X-Content-Type-Options meta fallback | 已改 |
| 其他 | meta 安全头（CSP/HSTS/Referrer/Permissions）已存在，无需改 | — |

> meta 只是 fallback（浏览器认 meta，但搜索/AI 爬虫不认）；真正生效的是 Cloudflare Transform Rules 下发的 HTTP 头。

## 三、验证命令（执行完跑一遍）

`ash
# 1. 安全头必须全部 200 出现
curl -sI https://www.alpha-wealth-lab.com/ | grep -Ei '^(strict-transport|content-security|x-frame|x-content|referrer|permissions)'
# 期望: 6 个 header 全部非 MISSING

# 2. http 必须 301 到 https
curl -sI http://www.alpha-wealth-lab.com/ | head -3
# 期望: HTTP/1.1 301 + location: https://...

# 3. apex http 也 301
curl -sI http://alpha-wealth-lab.com/ | head -3

# 4. TLS 严格验证（默认 CA）
echo | openssl s_client -connect www.alpha-wealth-lab.com:443 -servername www.alpha-wealth-lab.com 2>/dev/null | openssl x509 -noout -subject -issuer

# 5. Mozilla Observatory / securityheaders.com 扫一次，目标 ≥ A（B 可接受，preload 后 A+）
`

## 四、执行顺序（避免 521/503 窗口）

1. Cloudflare → SSL/TLS Mode: Flexible → Full (Strict)
2. Cloudflare → Transform Rules 加 6 条响应头 + 1 条 http→https 重定向
3. Cloudflare → Cache → Purge Everything
4. 跑上面「验证命令」，6 个安全头全绿 + http 301 + TLS 严格验证通过
5. 等 1–3 天 HSTS 生效（preload 需 Chrome 重启浏览器）

## 五、P0-3（下载转订阅）落地清单

> 目标：把 HealthData.Interop.Fhir ~12.7/天 的下载导向「订阅 / 30 分钟审计」对话。

1. index.html 的 CTA 区（免费试用 + 预约会议）已存在，确认 Calendly 链接可达：https://calendly.com/rex-fan18/30min
2. Quick Start 最后一步加一行：「领 FHIR R4/R5 合规 Checklist（12 个坑，PDF，免费）」→ https://mailchi.mp/83cafe450eef/rex-landing-page
3. README.md 顶部加「P0 CTA」块：下载量 + 30 分钟审计入口（让 GitHub 访客也走订阅漏斗）
4. HealthData.Interop.Fhir 1.3.4 发布短文（Medium / LinkedIn）+ 1.3.4 GitHub Release
5. Quant.Infra.Net 1.5.3 Release + 发布帖（半天工作量）

---
*本文档由每周自动化生成 · 原则：变现优先，开源为手段，AI 搜索可见度是核心杠杆*