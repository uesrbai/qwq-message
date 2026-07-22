# qwq 消息分发 · 系统对接文档

本文档面向**开发者**，介绍如何让你的业务系统通过 API 调用本平台发送通知。

- 接口地址前缀：`https://<你的部署域名>`（例如 `https://qwq-message.zeabur.app`）
- 数据格式：JSON（`Content-Type: application/json`）
- 字符编码：UTF-8

---

## 1. 认证

所有接口都用 **API 密钥**（Bearer Token）认证，在请求头携带：

```
Authorization: Bearer <你的密钥>
```

密钥在后台「**API 管理**」页创建，分两种：

| 类型 | 前缀 | 特点 |
|------|------|------|
| 测试密钥 | `qwq_test_` | 无 IP 限制；有**每分钟调用上限**（防盗用），管理员可设 |
| 生产密钥 | `qwq_live_` | 可绑定**可信 IP 白名单**；可**按分发方式限定权限** |

> 密钥可设为「全部权限」或「指定分发方式」。若为指定方式，调用不在授权范围内的方式会返回 403。

---

## 2. 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/send` | 发送一条通知 |
| GET  | `/api/v1/templates` | 列出可用模板 |
| GET  | `/api/v1/templates?code=<编号>` | 查询单个模板及其变量 |

---

## 3. 发送通知 `POST /api/v1/send`

### 3.1 请求体参数

**目标二选一**（`group` 与 `template` 至少提供一个；同时提供时以 `template` 优先）：

| 参数 | 类型 | 说明 |
|------|------|------|
| `group` | string | **分组编号**。发送到该分组，按其策略选渠道并容灾 |
| `template` | string | **模板编号**。用模板的正文/主题，`variables` 代入变量 |

**内容相关**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `to` | string | 视渠道 | 接收方：手机号 / 邮箱 / 微信 openid（邮箱可逗号分隔多个） |
| `content` | string | 用 `group` 时必填 | 正文内容（用 `template` 时由模板提供，可不传） |
| `subject` | string | 否 | 邮件主题 |
| `templateCode` | string | 短信/微信必填 | **服务商侧**的模板 ID（如短信在服务商申请的模板 CODE/ID） |
| `variables` | object | 否 | 模板变量键值对，如 `{"code":"8888"}` |

### 3.2 各渠道要传什么

| 分发方式 | `to` | 关键字段 | 说明 |
|----------|------|----------|------|
| Webhook | 可选 | `content` | 按渠道配置的请求体模板或默认 JSON 发出 |
| 短信（火山/阿里/腾讯）| 手机号 | `templateCode` + `variables` | 短信走服务商模板，`content` 被忽略 |
| 邮箱（SMTP/Zeabur）| 邮箱 | `subject` + `content` | Zeabur 支持逗号分隔多个收件人 |
| 微信公众号 | openid | `templateCode` + `variables` | 模板消息 |
| 飞书 / 钉钉 / 企业微信 | 忽略 | `content` | 群机器人文本消息 |

### 3.3 成功响应（HTTP 200）

```json
{
  "success": true,
  "channelId": "cmr...",   // 实际发送所用渠道的内部 ID
  "method": "SMS",          // 分发方式
  "detail": "..."           // 服务商返回的原始信息（截断）
}
```

### 3.4 失败响应

```json
{ "success": false, "error": "错误说明", "detail": "服务商原始返回（可选）" }
```

| HTTP | 场景 |
|------|------|
| 400 | 请求体不是合法 JSON / 缺少 `content` / 未提供 `group` 或 `template` |
| 401 | 缺少密钥 / 密钥无效或已停用 |
| 403 | 生产密钥 IP 不在白名单 / 密钥无该分发方式权限 |
| 404 | 分组或模板不存在（或对该密钥不可见） |
| 429 | 超出测试密钥限速 |
| 502 | 分组内全部渠道均发送失败（`error` 会列出各渠道失败原因） |

### 3.5 容灾（自动换渠道）

一个分组内配置多个渠道时：按策略（轮询 / 调用最少）排出顺序，**逐个尝试**，某渠道
**失败或已达限速**就自动跳到下一个，直到成功或全部失败。因此单个服务商临时故障不影响送达。

---

## 4. 查询模板 `GET /api/v1/templates`

供业务系统获取"某模板需要哪些变量"。

**列出全部**：`GET /api/v1/templates`

```json
{
  "success": true,
  "count": 1,
  "templates": [
    {
      "code": "order-paid",
      "name": "订单支付通知",
      "method": "SMS",
      "subject": null,
      "content": "您的订单${orderNo}已支付${amount}元",
      "variables": ["orderNo", "amount"],
      "variablesJson": { "orderNo": "", "amount": "" }
    }
  ]
}
```

**查单个**：`GET /api/v1/templates?code=order-paid` → `{ "success": true, "template": { ... } }`，
不存在返回 404。`variablesJson` 是可直接填值后作为 `variables` 传给发送接口的骨架。

---

## 5. 限速与 IP 白名单

- **测试密钥**：每分钟调用数达上限后，后续请求返回 **429**。上限在「API 管理」页由管理员设置（或用系统默认值）。
- **生产密钥**：若设置了可信 IP，则只有来自这些 IP 的请求被接受，否则返回 **403**。
  （注意：IP 依据 `X-Forwarded-For`，需部署在可信反向代理之后。）
- **渠道级限速**：单个渠道也可设「每分钟条数」，超出后该渠道被自动跳过，交给同组其他渠道。

---

## 6. 完整示例

### 6.1 按分组发送（Webhook / 群机器人 / 邮件）

```bash
curl -X POST https://qwq-message.zeabur.app/api/v1/send \
  -H "Authorization: Bearer qwq_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "group": "ops-alert",
    "content": "服务器 CPU 超过 90%，请及时处理。"
  }'
```

### 6.2 按分组发短信（服务商模板 + 变量）

```bash
curl -X POST https://qwq-message.zeabur.app/api/v1/send \
  -H "Authorization: Bearer qwq_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "group": "sms-marketing",
    "to": "13800000000",
    "templateCode": "SMS_123456",
    "variables": { "code": "8888" }
  }'
```

### 6.3 按平台模板发送（推荐）

先在后台「模板管理」建好模板（如编号 `order-paid`），业务系统只传编号和变量：

```bash
curl -X POST https://qwq-message.zeabur.app/api/v1/send \
  -H "Authorization: Bearer qwq_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "order-paid",
    "to": "13800000000",
    "variables": { "orderNo": "SO20260101", "amount": "199.00" }
  }'
```

### 6.4 发邮件（多个收件人）

```bash
curl -X POST https://qwq-message.zeabur.app/api/v1/send \
  -H "Authorization: Bearer qwq_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "group": "email-notice",
    "to": "a@example.com, b@example.com",
    "subject": "系统维护通知",
    "content": "<h3>今晚 22:00 维护</h3><p>预计 30 分钟。</p>"
  }'
```

### 6.5 Node.js

```js
const res = await fetch("https://qwq-message.zeabur.app/api/v1/send", {
  method: "POST",
  headers: {
    Authorization: "Bearer qwq_live_xxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    template: "order-paid",
    to: "13800000000",
    variables: { orderNo: "SO20260101", amount: "199.00" },
  }),
});
const data = await res.json();
if (!data.success) console.error("发送失败：", data.error);
```

### 6.6 Python

```python
import requests

resp = requests.post(
    "https://qwq-message.zeabur.app/api/v1/send",
    headers={"Authorization": "Bearer qwq_live_xxxxxxxx"},
    json={
        "template": "order-paid",
        "to": "13800000000",
        "variables": {"orderNo": "SO20260101", "amount": "199.00"},
    },
    timeout=10,
)
data = resp.json()
if not data.get("success"):
    print("发送失败：", data.get("error"))
```

### 6.7 PHP

```php
$ch = curl_init("https://qwq-message.zeabur.app/api/v1/send");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer qwq_live_xxxxxxxx",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "template" => "order-paid",
        "to" => "13800000000",
        "variables" => ["orderNo" => "SO20260101", "amount" => "199.00"],
    ]),
]);
$data = json_decode(curl_exec($ch), true);
if (empty($data["success"])) { error_log("发送失败：" . $data["error"]); }
```

---

## 7. 常见问题

**Q：`group` 和 `template` 有什么区别？**
A：`group` 直接指定用哪组渠道发、内容你自己传；`template` 用后台建好的模板（含正文和变量清单），
业务系统只传编号和变量，正文由平台统一维护，改文案不用改代码。

**Q：短信的 `templateCode` 是什么？**
A：是你在**短信服务商**（火山/阿里/腾讯）后台申请、审核通过的模板 ID，不是本平台的模板编号。
`variables` 的键要与该模板里的占位变量名一致。

**Q：怎么确认发送结果？**
A：响应里 `success` 为 `true` 即已提交/送达；失败看 `error`。后台「日志 → 最近调用记录」也能查每一条，
并可按分组筛选、导出 Excel。

**Q：一条请求会不会重复发送？**
A：不会。容灾是"前一个失败才试下一个"，成功即停止，不会向多个渠道重复发。
