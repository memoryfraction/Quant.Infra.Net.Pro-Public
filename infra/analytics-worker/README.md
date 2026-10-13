# awl-analytics — Cloudflare Worker + D1（Alpha Wealth Lab 统计与互动接口）

同域 `/api/*` 的后端，服务 https://www.alpha-wealth-lab.com 的统计、计算记录、画像、反馈与邮件订阅。
纯原生 `fetch`，**无任何第三方依赖**；表结构只用 `migrations/*.sql` 增量修改。

- 运行时：Cloudflare Workers（`compatibility_date = 2026-09-01`）
- 数据库：D1 `awl_analytics`（binding `DB`）
- 邮件：Brevo Transactional REST API（`https://api.brevo.com/v3/smtp/email`）
- 隐私底线：**绝不存原始 IP、绝不存原始 User-Agent、不使用 cookie**。
  去重用 `ip_hash = HMAC-SHA256(IP_SALT, CF-Connecting-IP)` 的前 16 位十六进制。

> 早期版本只记「国家/省/城市/邮编/经纬度/时区/路径/事件/来源域」；
> 阶段一在此基础上**只增字段、只增可接受取值**，`/api/hit`、`/api/stats`、`/api/health`
> 的既有行为和响应格式保持不变。

---

## 1. 迁移

`migrations/0002_phase1.sql` 是幂等的（`CREATE TABLE IF NOT EXISTS`），可直接执行：

```bash
# 本地
npx wrangler d1 execute awl_analytics --local  --file=migrations/0002_phase1.sql
# 线上
npx wrangler d1 execute awl_analytics --remote --file=migrations/0002_phase1.sql
```

`migrations/0003_hits_extend.sql` 给 `hits` 增加 15 列。**SQLite 不支持 `ADD COLUMN IF NOT EXISTS`**，
所以该文件只是「列清单 / 事实来源」，实际请用幂等脚本执行（它会读 `PRAGMA table_info(hits)`，
只补缺失的列，可反复运行）：

```bash
# 本地
node scripts/apply-0003.mjs --local
# 线上
node scripts/apply-0003.mjs --remote
```

验证：

```bash
npx wrangler d1 execute awl_analytics --remote --command "PRAGMA table_info(hits);"
```

---

## 2. Secrets 与变量

| 名称 | 类型 | 说明 |
|---|---|---|
| `STATS_TOKEN` | secret | 保护 `/api/stats` 与 `/api/admin/*`；常量时间比较 |
| `BREVO_API_KEY` | secret | Brevo **v3** API key。未设置时 `/api/subscribe` 返回 503，其余功能不受影响 |
| `IP_SALT` | secret | 32 字节十六进制的 HMAC 盐。未设置时 `ip_hash` 存空串（两种情况下都不会存原始 IP） |
| `MAIL_FROM` | `[vars]` | 发件地址，**必须是 Brevo 里已验证的 sender**。默认 `alphawealthlab@outlook.com` |

```bash
# 写 secret（从标准输入；不要把值写进任何文件、不要留在 shell 历史里）
printf '%s' "$YOUR_TOKEN" | npx wrangler secret put STATS_TOKEN
printf '%s' "$YOUR_KEY"   | npx wrangler secret put BREVO_API_KEY

# 生成 IP_SALT（32 字节 = 64 个十六进制字符），直接管道写入，不落盘、不打印
openssl rand -hex 32 | npx wrangler secret put IP_SALT
```

> `MAIL_FROM` 在 `wrangler.toml` 的 `[vars]` 里，改完要重新 `wrangler deploy`。
> 在 Brevo → **Senders & IP → Senders** 先把该地址加上并完成邮箱验证，否则 Brevo 会拒发。

部署与定时任务（`crons = ["0 14 1-5 12 *"]`，每年 12 月 1–5 日 14:00 UTC 尝试发送年度提醒）：

```bash
npx wrangler deploy
npx wrangler deployments list
```

---

## 3. 接口速查（curl）

把 `$T` 设为 `STATS_TOKEN`，`$B` 设为站点地址（如 `https://www.alpha-wealth-lab.com`）。
下列命令都**不要**在终端里回显 token 值。

### 3.1 健康与统计

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$B/api/health"                     # 200 "ok"
curl -s -o /dev/null -w '%{http_code}\n' "$B/api/stats"                      # 401（无 token）
curl -s -H "Authorization: Bearer $T" "$B/api/stats?days=30" | head -c 400    # 200
```

`/api/stats` 返回：`summary/totals/daily/referrers/geo/recent`（原有）+
`uniques`（独立 vid、独立 ip_hash）、`sessions`、`newVsReturning`、`cohorts`（D1/D7/D30）、
`engagement`（分页面平均停留/滚动）、`devices/os/browsers/wechat`、`utm`、`campaigns`、
`calcs`（分工具次数 + 数值输入 P25/中位数/P75 + 选择型分布）、
`profiles`（各画像字段分布，多选按选项计数）、`wtp`、`subscribers`、`feedback`（最近 50 条）、
`events`/`eventsByTool`、`retention`（含分工具）。

### 3.2 `POST /api/hit`（埋点，向后兼容扩展）

```bash
# 基础 204
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/hit" -H 'content-type: text/plain' \
  -d '{"e":"view","p":"/planner/fi/index.html","vid":"abcdef1234567890","sid":"0987654321fedcba","vw":390,"bl":"zh-CN","us":"wechat","c":"share"}'

# leave 事件带停留时长与滚动深度 -> 204
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/hit" -H 'content-type: text/plain' \
  -d '{"e":"leave","p":"/planner/fi/","vid":"abcdef1234567890","sid":"0987654321fedcba","d":45000,"sc":80}'

# 反例：未知事件 -> 400
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/hit" -H 'content-type: text/plain' -d '{"e":"nope"}'

# 反例：非法 vid -> 204，但该字段被丢弃（不报错）
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/hit" -H 'content-type: text/plain' -d '{"e":"view","p":"/","vid":"SHORT"}'
```

事件白名单：`view | calc | share | save | load | join | leave`。
`v` 只接受 `new|d0|d1_7|d8_30|d30p`；`c` 只接受 `card|share|wechat|email|join`。
`d`/`sc` 仅在 `leave` 事件下记录。服务端由 UA 解析 `device/os/browser`（含微信内置浏览器）。

### 3.3 `POST /api/calc`（完整记录输入与结果）

```bash
# 204
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/calc" -H 'content-type: application/json' \
  -d '{"tool":"fi","lang":"zh","vid":"abcdef1234567890","sid":"0987654321fedcba","inputs":{"age":40,"spend":50000},"result":[["目标资产","1,000,000"]]}'

# 反例：tool 不在白名单 -> 204 但不入库
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/calc" -H 'content-type: application/json' \
  -d '{"tool":"hack","lang":"zh","vid":"abcdef1234567890","sid":"0987654321fedcba","inputs":{},"result":[]}'
```

`inputs` 最多 40 个键，键须匹配 `^[A-Za-z0-9_]{1,32}$`，值只能是有限 number / boolean / ≤60 字符字符串；
`result` 最多 8 项，每项 `[≤40 字符标签, ≤80 字符值]`；两者序列化后各 ≤3000 字符。**超限部分被丢弃。**
请求体超过 8192 字节 → 413。

### 3.4 `POST /api/profile`（可选 3 秒画像，按 vid upsert）

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/profile" -H 'content-type: application/json' \
  -d '{"vid":"abcdef1234567890","lang":"zh","age_band":"40-49","asset_band":"300k-1m","goal":"fi","markets":["us","cn"],"follows":["clec","satoshi"],"leverage_exp":"options"}'
```

白名单：
`age_band` ∈ `<30|30-39|40-49|50-59|60+`；
`asset_band` ∈ `<100k|100k-300k|300k-1m|1m-3m|3m+`；
`goal` ∈ `fi|retire|growth|preserve|learn`；
`markets` ⊂ `us|cn|hk|tw|other`；
`follows` ⊂ `value|beiban|adam_khoo|clec|silicon_valley|satoshi|other|none`；
`leverage_exp` ∈ `none|etf|margin|options`。**非法值静默丢弃；只更新本次提供了的字段。**

### 3.5 `POST /api/feedback`

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/feedback" -H 'content-type: application/json' \
  -d '{"tool":"fi","lang":"zh","vid":"abcdef1234567890","rating":5,"message":"很有用","contact":"wx: abc","wtp":["pdf_report"],"t":3000}'

# 反例：蜜罐被填 -> 静默 204 且不入库（对攻击者不泄露任何信息）
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/feedback" -H 'content-type: application/json' \
  -d '{"tool":"fi","lang":"zh","message":"spam here","website":"http://x","t":5000}'
```

`wtp` 只接受 `multi_plans|pdf_report|yoy_compare|more_authors|none`（逗号分隔，非法丢弃）。

### 3.6 `POST /api/subscribe` / `confirm` / `unsubscribe`

```bash
# 未设置 BREVO_API_KEY 时 -> 503 {"error":"mail_not_configured"}（预期行为）
curl -s -w '\n%{http_code}\n' -X POST "$B/api/subscribe" -H 'content-type: application/json' \
  -d '{"email":"someone@example.com","lang":"zh","source":"fi","t":3000}'

# 反例：非法邮箱 -> 400
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/api/subscribe" -H 'content-type: application/json' \
  -d '{"email":"not-an-email","lang":"zh","source":"fi","t":3000}'

# 确认 / 退订：把 <token> 换成邮件里的值（浏览器点链接即可）
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' "$B/api/confirm?t=<token>"
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' "$B/api/unsubscribe?t=<token>"
```

成功时分别 302 到 `/planner/subscribed/?ok=1`、`?ok=0`、`?unsub=1`。
已是 `confirmed` 再订阅 → 204（不泄露是否已订阅）；`pending` 且 10 分钟内已发过确认 → 204 不重发。
邮件带 RFC 8058 一键退订头：`List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`。

### 3.7 管理接口（都需要 `Authorization: Bearer $T`）

```bash
# 订阅统计 + 最近 50 条（邮箱打码成 a***@x.com）
curl -s -H "Authorization: Bearer $T" "$B/api/admin/subscribers?status=confirmed"

# 年度提醒：dry=1 只返回将发送的人数；不带 dry 才真发（每次最多 250 封，按年幂等）
curl -s -X POST -H "Authorization: Bearer $T" "$B/api/admin/send-reminder?dry=1"

# 导出 CSV（table=calcs|profiles|feedback|subscribers|hits；days 默认 90、最大 730；单次最多 50000 行）
curl -s -H "Authorization: Bearer $T" "$B/api/admin/export?table=calcs&days=90" -o calcs.csv

# 响应用户的删除请求：删除该 vid 在各表的全部记录，返回各表删除行数
curl -s -X POST -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"vid":"abcdef1234567890"}' "$B/api/admin/delete"
```

---

## 4. 防滥用（不使用验证码）

对 `/api/subscribe` 与 `/api/feedback` 都生效，命中任一条即**对攻击者静默**（一律 204、不写库、不发信）：

1. 蜜罐字段 `website` 非空；
2. 填表时长 `t` 缺失或小于 1500ms；
3. 机器人 User-Agent（`lib.js` 的 `isBot`）；
4. **速率限制**：每客户端每分钟 ≤5 次 → 超限返回 `429`。
   优先使用 Workers Rate Limiting 绑定（`wrangler.toml` 的 `[[unsafe.bindings]] type = "ratelimit"`，
   **不向数据库写入任何来源信息**）；
   该绑定不可用时（例如 `wrangler dev --local`）退化为「isolate 内的计数器」，
   键为盐化后的 `ip_hash`（仍不落库、不用原始 IP）。
   ⚠️ 退化实现是**每 isolate 独立**的，多 isolate 下阈值会被放大——生产环境请确保绑定生效；
5. 当天（UTC）确认邮件超过 150 封后不再发送，仍返回 204；
6. 双重确认：未确认的 `pending` 邮箱不会收到年度提醒。

---

## 5. 数据保留

统计与计算记录保留 **24 个月**；退订者邮箱在退订 **30 天** 后删除。建议按需手动执行：

```bash
npx wrangler d1 execute awl_analytics --remote --command \
  "DELETE FROM hits  WHERE day < date('now','-24 months');"
npx wrangler d1 execute awl_analytics --remote --command \
  "DELETE FROM calcs WHERE day < date('now','-24 months');"
npx wrangler d1 execute awl_analytics --remote --command \
  "DELETE FROM subscribers WHERE status='unsubscribed' AND (confirmed_ts IS NULL OR confirmed_ts < strftime('%s','now','-30 days'));"
```

> 也可以做成 D1 定时任务 / 手动 CI；本项目不引入额外组件。

---

## 6. 测试

```bash
cd infra/analytics-worker
node --test            # 62 个用例：lib 纯函数 + 全部接口（含反例）
```

测试用**内存版 D1 桩** + **mock 掉的 Brevo `fetch`**：不需要网络、不会真的发邮件。

---

## 7. 已知限制

- 未使用验证码：极端情况下仍可能被脚本批量提交（已用蜜罐 + 时长 + 限流 + 日上限削弱）。
- `/api/hit` 的写入是 `waitUntil` 后置的，极端冷启动下可能偶发丢点（可接受）。
- 速率限制的退化实现为 per-isolate，见 §4.4。
- 条款 / 隐私页为 AI 起草，**上线前请律师审阅**，并确认适用法律与管辖地。
