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
- 60 秒自动刷新 + 手动刷新

## API

- `GET /api/overview`：看板聚合数据
- `POST /api/trigger`：触发允许脚本（当前支持 `runtime-refresh-batch.sh` / `project-state-refresh.sh`）
- `POST /api/summary/save`：保存当日摘要到 memory

## 脚本

- `scripts/save-summary.sh`：调用摘要保存接口

## 下一步

- 对接 Feishu/Telegram 告警推送
- 做趋势图（额度变化 / 失败次数）
