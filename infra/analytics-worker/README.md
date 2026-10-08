# analytics-worker

给 www.alpha-wealth-lab.com 记录访问：每次访问一行：国家、省/州、城市、邮编、经纬度（取两位小数，约 1 公里）、时区、路径、事件（view / calc / share）、来源域。**不存 IP**（地区由 Cloudflare 根据 IP 在边缘查出，IP 本身不落库）。
不使用 Cookie；机器人 UA 不记录。前端另有 counter.dev 做公开可视化（见 gh-pages 的 `assets/hit.js`）。

## 部署（你本人执行）
```bash
npm i -g wrangler
wrangler login
wrangler d1 create awl_analytics          # 把输出的 database_id 填进 wrangler.toml
wrangler d1 execute awl_analytics --remote --file=schema.sql
wrangler secret put STATS_TOKEN           # 建议用 openssl rand -hex 24 生成
wrangler deploy
```

## 验证
```bash
curl -i -X POST https://www.alpha-wealth-lab.com/api/hit -H "Content-Type: text/plain" -H "User-Agent: Mozilla/5.0" --data '{"p":"/planner/fi/","e":"view","r":""}'
curl -s "https://www.alpha-wealth-lab.com/api/stats?days=7" -H "Authorization: Bearer $TOKEN"
curl -i https://www.alpha-wealth-lab.com/api/stats
```
预期：204；JSON（含地区的 recent 列表）；401。

## 数据保留与合规
不存 IP，只存地区；邮编加经纬度属于较精细的地理信息，建议定期清理，例如每年：
```bash
wrangler d1 execute awl_analytics --remote --command "DELETE FROM hits WHERE day < date('now','-365 day')"
```
因为没有 IP，也就没有「独立访客数」；看板统计的是浏览次数和计算次数。

## 看板
站点部署后打开 https://www.alpha-wealth-lab.com/stats/ ，输入 STATS_TOKEN。
