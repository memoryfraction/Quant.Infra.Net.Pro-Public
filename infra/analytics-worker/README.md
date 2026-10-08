# analytics-worker

给 www.alpha-wealth-lab.com 记录访问：每次访问一行，含公网 IP、国家/地区/城市（来自 Cloudflare）、路径、事件（view / calc / share）、来源域。
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
预期：204；JSON（含 IP/地区的 recent 列表）；401。

## 数据保留与合规
D1 里存的是原始 IP，建议定期清理，例如每季度：
```bash
wrangler d1 execute awl_analytics --remote --command "DELETE FROM hits WHERE day < date('now','-180 day')"
```
存 IP 属于处理个人信息，欧盟/英国访客适用 GDPR；如需合规，可改为只存 IP 前三段，或在隐私页说明。

## 看板
站点部署后打开 https://www.alpha-wealth-lab.com/stats/ ，输入 STATS_TOKEN。
