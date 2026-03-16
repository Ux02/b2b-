# 个人工作驾驶舱（MVP）

## 启动

```bash
cd projects/workbench
npm install
npm run dev
```

打开：`http://localhost:3090`

## 当前功能

- 读取 `memory/project-state-runtime.md` 的关键状态
- 解析 Codex 使用摘要（5h/周）
- 实时显示 workspace git 变更数与前 30 条变更
- 显示 `logs/*.log` 最近尾部内容
- 告警面板（额度过低 / 异常日志关键词 / 改动过多）
- 告警阈值配置（`config/alerts.json`）
- 今日摘要自动生成
- 一键触发 `scripts/runtime-refresh-batch.sh`
- 一键把日报快照写入 `memory/YYYY-MM-DD.md`
- 支持 Feishu Webhook 告警推送（含去重）
- 60 秒自动刷新 + 手动刷新

## API

- `GET /api/overview`：看板聚合数据
- `POST /api/trigger`：触发允许脚本（当前支持 `runtime-refresh-batch.sh` / `project-state-refresh.sh`）
- `POST /api/summary/save`：保存当日摘要到 memory

## 脚本

- `scripts/save-summary.sh`：调用摘要保存接口
- `scripts/push-alerts.sh`：推送告警到 Feishu Webhook（重复内容会自动跳过）

## 配置告警推送

1. 复制配置文件：
```bash
cp config/notify.example.json config/notify.json
```
2. 填写 webhook，并启用：
```json
{
  "enabled": true,
  "provider": "feishu_webhook",
  "webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/xxxx",
  "onlyHigh": false
}
```
3. 触发推送（需本地服务已启动）：
```bash
npm run push:alerts
```

## 建议 cron（每 10 分钟）

```bash
*/10 * * * * cd /root/.openclaw/workspace/projects/workbench && /usr/bin/npm run -s push:alerts >> /root/.openclaw/workspace/logs/workbench-alerts.log 2>&1
```

## 下一步

- 对接 Telegram 告警
- 做趋势图（额度变化 / 失败次数）
