# B2B 邮件自动化 MVP

可运行成品（最小可交付版）：
- 线索接入 API
- 自动邮件序列（3 步）
- 退订链接
- 周报统计 API + CSV 导出
- 网页后台（线索录入 / 调度发送 / 数据查看）
- 基础后台鉴权（ADMIN_TOKEN）
- 模板后台可编辑（在线改 3 封邮件模板）
- 支持 Vercel 部署（Serverless + Cron）

## 1. 安装

```bash
cd projects/b2b-mail-mvp
npm install
cp .env.example .env
```

填写 `.env`：
- `APP_SECRET`、`ADMIN_TOKEN`
- SMTP 参数
- 本地可不填 `DATABASE_URL`（默认 JSON 文件）
- **Vercel 线上必须填 `DATABASE_URL`（PostgreSQL）**

## 2. 本地启动

```bash
npm run dev
```

打开：`http://localhost:3030`

## 3. 自动调度（本地可选）

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

## 6. 部署到 Vercel

### 6.1 准备
1. 把项目推到 GitHub。
2. 在 Vercel 新建 Project 并导入仓库。
3. Vercel 会识别 `vercel.json`，入口是 `api/index.js`。

### 6.2 配置环境变量（Vercel Project Settings）
必填：
- `BASE_URL=https://你的域名.vercel.app`
- `APP_SECRET=...`
- `ADMIN_TOKEN=...`
- `DATABASE_URL=...`（PostgreSQL）
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE`
- `MAIL_FROM`

### 6.3 部署

```bash
vercel login
vercel
vercel --prod
```

### 6.4 定时发送
已在 `vercel.json` 配置：
- 每 10 分钟触发一次 `/api/tick`

> 说明：Serverless 不支持常驻 `setInterval`，线上请依赖 Vercel Cron。

## 生产建议（下一步）

- 给 `/api/tick` 增加独立 cron secret 鉴权
- 增加 opens/click/reply 跟踪
- 增加模板 A/B 测试
- 增加权限与审计日志
