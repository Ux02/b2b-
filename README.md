# B2B 邮件自动化 MVP

可运行成品（最小可交付版）：
- 线索接入 API
- 自动邮件序列（3 步）
- 退订链接
- 周报统计 API + CSV 导出
- 网页后台（线索录入 / 调度发送 / 数据查看）

## 1. 安装

```bash
cd projects/b2b-mail-mvp
npm install
cp .env.example .env
```

填写 `.env` 里的 SMTP 参数。

## 2. 启动

```bash
npm run dev
```

打开：`http://localhost:3030`

## 3. 自动调度（可选）

在 `.env` 配：

```env
TICK_INTERVAL_SECONDS=300
```

表示每 300 秒自动执行一次 `/api/tick`。

## 4. 命令行演示（可选）

```bash
npm run demo
```

会自动：健康检查 -> 添加线索 -> 执行一次发送 -> 查询周报。

## 5. 常用接口

- `GET /health`
- `POST /api/leads`
- `GET /api/leads`
- `POST /api/tick`
- `GET /api/report/weekly`
- `GET /api/report/weekly.csv`
- `GET /unsubscribe?token=...`

## 生产建议（下一步）

- 把 JSON 存储换成 PostgreSQL
- 加 webhook 验签（线索来源）
- 加 opens/click/reply 跟踪
- 增加模板后台和 A/B 测试
- 增加权限与审计日志
