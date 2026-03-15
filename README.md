# B2B 邮件自动化 MVP

可运行成品（最小版）：
- 线索接入 API
- 自动邮件序列（3 步）
- 退订链接
- 周报统计 API

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

## 3. 导入线索

```bash
curl -X POST http://localhost:3030/api/leads \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"张三",
    "email":"test@example.com",
    "company":"示例公司",
    "source":"wechat",
    "tags":["B2B","trial"]
  }'
```

## 4. 执行发送调度（可用 cron 每 5-10 分钟调用）

```bash
curl -X POST http://localhost:3030/api/tick
```

## 5. 查看周报

```bash
curl http://localhost:3030/api/report/weekly
```

## API 一览

- `GET /health`
- `POST /api/leads`
- `GET /api/leads`
- `POST /api/tick`
- `GET /api/report/weekly`
- `GET /unsubscribe?token=...`

## 生产建议（下一步）

- 把 JSON 存储换成 PostgreSQL
- 加 webhook 验签（线索来源）
- 加 opens/click/reply 跟踪
- 增加模板后台和 A/B 测试
- 增加权限与审计日志
