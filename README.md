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
- 读取 Codex 使用摘要（从 runtime 面板解析）
- 实时显示 workspace git 变更数与前 30 条变更
- 显示 `logs/*.log` 最近尾部内容
- 60 秒自动刷新 + 手动刷新

## 下一步

- 增加告警规则（额度低 / 任务失败）
- 增加每日摘要生成
- 增加一键触发脚本按钮
