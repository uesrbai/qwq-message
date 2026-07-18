# qwq 消息分发 · Notification Hub

一个统一的**通知消息分发平台**：你的各个系统只要调用一个接口、带上密钥，就能通过
短信、邮件、微信公众号、飞书、钉钉、Webhook 等渠道把消息发出去。支持多服务商、
分组轮询/负载均衡、模板化发送、测试/生产密钥、IP 白名单、限速、IAM 子账号，界面中英文双语。

## 技术栈

- **Next.js 16**（App Router）+ React 19 + TypeScript
- **Tailwind CSS v4** + lucide 图标（手写组件，无第三方 UI 库）
- **Prisma 7**（驱动适配器）+ 本地 SQLite / 线上 PostgreSQL
- 自建轻量认证（jose 签名 Cookie）+ qwq-sso 单点登录

## 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 准备环境变量
cp .env.example .env      # 然后按需修改 .env（至少设置 AUTH_SECRET）

# 3. 初始化数据库（生成表结构）
npx prisma db push

# 4. 启动
npm run dev
```

打开 http://localhost:3000 ，首次访问会引导你**创建管理员（Owner）账号**。

## 主要功能

| 页面 | 说明 |
|------|------|
| 首页 | 今日接口调用量、成功/失败、各渠道分布、最近调用 |
| 渠道配置 | 分发方式(大类) → 分组(二级) → 渠道(三级)；同组多服务商，轮询/调用最少 |
| 模板管理 | 带 `{{变量}}` 的消息模板，按模板编号识别并分发 |
| 测试服务 | 选渠道、填内容一键试发，检验通道有效性 |
| API 管理 | 接口地址、测试/生产密钥、IP 白名单、限速、权限范围 |
| 用户设置 | 修改密码、创建带权限的 IAM 子账号 |

## API 调用

**接口**：`POST /api/v1/send`
**鉴权**：请求头 `Authorization: Bearer <你的密钥>`

请求体（`group` 与 `template` 二选一定位目标）：

```jsonc
{
  "group": "sms-16",          // 按“分组编号”发送
  // "template": "welcome",   // 或按“模板编号”发送
  "to": "13800000000",        // 接收方（手机号/邮箱/openid，按渠道而定）
  "subject": "标题",          // 邮件用
  "content": "正文内容",       // 直接内容（用 group 时）
  "templateCode": "SMS_123",  // 短信/微信的服务商模板ID
  "variables": { "code": "8888" }  // 模板变量
}
```

示例：

```bash
curl -X POST http://localhost:3000/api/v1/send \
  -H "Authorization: Bearer qwq_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"group":"hook-1","content":"你好，世界"}'
```

返回：`{"success":true,"method":"WEBHOOK","channelId":"...","detail":"..."}`

- **测试密钥**（`qwq_test_`）：无 IP 限制，但有每分钟调用上限（防盗用，管理员可设默认值）
- **生产密钥**（`qwq_live_`）：可设可信 IP 白名单、按分发方式限权

## 渠道实现状态

已实测：Webhook、SMTP 邮件。已按官方规范实现、待真实账号验证：阿里云/腾讯云/火山
短信、Zeabur 邮件、微信公众号、飞书、钉钉。各渠道所需参数见「渠道配置」页表单。

## 部署到 Zeabur

> 线上需用 **PostgreSQL**（容器文件系统重启会丢数据，SQLite 不适合）。

1. **创建 Postgres**：在 Zeabur 项目里添加一个 PostgreSQL 服务，复制它的连接串。
2. **切换数据库类型**：把 `prisma/schema.prisma` 顶部的 `provider = "sqlite"` 改成
   `provider = "postgresql"`。（`src/lib/db.ts` 会按连接串自动选适配器，无需改动。）
3. **推送代码**到 GitHub，在 Zeabur 从该仓库部署 Next.js 服务。
4. **配置环境变量**（Zeabur 服务的 Variables）：
   - `DATABASE_URL` = 第 1 步的 Postgres 连接串
   - `AUTH_SECRET` = 随机 64 位十六进制串
     （`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`）
   - `APP_URL` = 你的线上域名
   - （可选）`QWQ_SSO_*`：用 SSO 时填；生产请用 `sk_live_` 并设 `QWQ_SSO_ALLOWED_EMAILS`
5. **建表**：把本地 `.env` 的 `DATABASE_URL` 临时指向线上 Postgres，执行一次
   `npx prisma db push`。
6. 打开线上域名，创建管理员账号即可。

## 清理演示数据

本地开发可能建了演示数据（测试账号、示例分组/渠道/模板/密钥）。线上是全新 Postgres，
不会带过去。想清空本地重来：删掉 `dev.db` 再 `npx prisma db push`。

## 安全提示

- **务必设置随机的 `AUTH_SECRET`**（默认值仅用于本地）。
- qwq-sso 生产用 `sk_live_` 密钥，并用 `QWQ_SSO_ALLOWED_EMAILS` 限定可登录邮箱。
- 生产密钥务必设置可信 IP 白名单。
