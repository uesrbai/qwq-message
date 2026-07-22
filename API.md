# qwq 消息分发 · 系统对接文档

> 面向**开发者**：如何让你的业务系统通过 API 调用本平台发送通知（短信 / 邮件 / Webhook / 微信 / 飞书 / 钉钉 / 企业微信）。
>
> 版本：**v1.0.0** · 接口版本前缀：`/api/v1`

---

## 目录

1. [快速开始](#1-快速开始)
2. [基本约定](#2-基本约定)
3. [认证与密钥](#3-认证与密钥)
4. [接口一览](#4-接口一览)
5. [发送通知 `POST /api/v1/send`](#5-发送通知-post-apiv1send)
6. [各分发方式怎么传参](#6-各分发方式怎么传参)
7. [查询模板 `GET /api/v1/templates`](#7-查询模板-get-apiv1templates)
8. [响应结构](#8-响应结构)
9. [错误码大全](#9-错误码大全)
10. [限速、IP 白名单与容灾](#10-限速ip-白名单与容灾)
11. [多语言 SDK 示例](#11-多语言-sdk-示例)
12. [常见问题 FAQ](#12-常见问题-faq)
13. [附录 A：qwq-sso 单点登录（管理员）](#附录-aqwq-sso-单点登录管理员)

---

## 1. 快速开始

三步即可发出第一条通知：

1. **建渠道**：后台「渠道配置」里，选一种分发方式 → 建分组（会得到一个**分组编号**）→ 在分组下建至少一个渠道并填服务商凭证。
2. **拿密钥**：后台「API 管理」里新建一个密钥，复制 `qwq_test_...` 或 `qwq_live_...`。
3. **发请求**：

```bash
curl -X POST https://qwq-message.zeabur.app/api/v1/send \
  -H "Authorization: Bearer qwq_test_你的密钥" \
  -H "Content-Type: application/json" \
  -d '{ "group": "你的分组编号", "content": "hello from qwq" }'
```

返回 `{"success": true, ...}` 即成功。

---

## 2. 基本约定

| 项 | 值 |
|----|----|
| 接口地址前缀 | `https://<你的部署域名>`，例：`https://qwq-message.zeabur.app` |
| 请求 / 响应格式 | JSON（请求头 `Content-Type: application/json`） |
| 字符编码 | UTF-8 |
| 认证方式 | HTTP 头 `Authorization: Bearer <密钥>` |
| 分发方式（method） | `WEBHOOK` · `SMS` · `EMAIL` · `WECHAT_MP` · `FEISHU` · `DINGTALK` · `WECOM` |

> **术语**：
> - **分组编号（group code）**、**模板编号（template code）**：都是你在后台自己填的短标识，用于在 API 里指定目标，**不是**数据库内部 ID。
> - **服务商模板 ID（templateCode）**：短信/微信服务商侧申请的模板编号，与本平台的"模板编号"是两回事。

---

## 3. 认证与密钥

所有接口都用 **API 密钥**（Bearer Token）认证：

```
Authorization: Bearer qwq_live_xxxxxxxxxxxxxxxx
```

缺失或无效会返回 **401**。密钥在后台「**API 管理**」创建，分两类：

| 类型 | 前缀 | 特点 |
|------|------|------|
| 测试密钥 | `qwq_test_` | 无 IP 限制；有**每分钟调用上限**（防盗刷），超限返回 **429** |
| 生产密钥 | `qwq_live_` | 可绑定**可信 IP 白名单**（非白名单 IP 返回 403）；上限默认不限 |

**权限范围（scope）**：每个密钥可设为

- **全部权限（FULL）**：可调用任意分发方式；
- **指定方式（SCOPED）**：只能调用被授权的 method，调用范围外的方式返回 **403**。

**密钥可见性规则**（后台设计，供你理解）：

- **受限（SCOPED）密钥**：加密存储，可在后台**重复查看**明文，方便找回；权限创建后不可改。
- **全权限（FULL）密钥**：只存哈希，**仅创建时显示一次**，请当场保存；丢失只能重建。

> 妥善保管密钥，泄露后请立即在后台停用并重建。密钥一旦停用，请求立即返回 401。

---

## 4. 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/send` | 发送一条通知 |
| GET  | `/api/v1/templates` | 列出当前密钥可见的所有模板 |
| GET  | `/api/v1/templates?code=<编号>` | 查询单个模板及其变量骨架 |

---

## 5. 发送通知 `POST /api/v1/send`

### 5.1 目标：`group` 或 `template` 二选一

请求体里**必须提供** `group` 或 `template` 之一；两者都给时以 **`template` 优先**。

| 参数 | 类型 | 说明 |
|------|------|------|
| `template` | string | **模板编号**。用后台模板的正文/主题，`variables` 代入占位变量。正文由平台维护，改文案不用改代码。 |
| `group` | string | **分组编号**。发到该分组，`content` 由你直接提供，平台按分组策略选渠道并容灾。 |

### 5.2 内容字段

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `to` | string | 视渠道而定 | 接收方：手机号 / 邮箱 / 微信 openid。邮箱可用英文逗号分隔多个（部分服务商支持）。 |
| `content` | string | 用 `group` 时**必填** | 正文。用 `template` 时正文来自模板，可不传。 |
| `subject` | string | 否 | 邮件主题。 |
| `templateCode` | string | 短信/微信必填 | **服务商侧**的模板 ID（如短信服务商审核通过的模板 CODE/ID）。 |
| `variables` | object | 否 | 模板变量键值对，如 `{"code":"8888","name":"张三"}`。键名须与模板占位一致。 |

> 未识别的字段会被忽略；`variables` 必须是对象，否则按空对象处理。

### 5.3 校验顺序（便于定位报错）

1. 认证密钥（401） →
2. 生产密钥 IP 白名单（403）/ 测试密钥限速（429） →
3. 解析 JSON（400） →
4. `template` 分支：模板存在且启用（404）→ 密钥有该 method 权限（403）；
   `group` 分支：分组存在（404）→ 密钥有该 method 权限（403）→ `content` 非空（400） →
5. 进入分发引擎（容灾），全部渠道失败返回 502。

---

## 6. 各分发方式怎么传参

| 分发方式 | `to` | 关键字段 | 说明 |
|----------|------|----------|------|
| **Webhook** | 可选 | `content` | 无自定义请求体模板时，默认 POST 一个 JSON（见下）。 |
| **短信** 火山/阿里/腾讯 | 手机号 | `templateCode` + `variables` | 短信内容走**服务商模板**，`content` 被忽略。 |
| **邮箱** SMTP / Zeabur | 邮箱 | `subject` + `content` | Zeabur Email 支持逗号分隔多个收件人；`content` 可为 HTML。 |
| **微信公众号** | openid | `templateCode` + `variables` | 模板消息；`templateCode` 缺省用渠道配置的默认模板 ID。 |
| **飞书 / 钉钉 / 企业微信** | 忽略 | `content` | 群机器人**文本**消息，直接发到群里。 |

**Webhook 默认请求体**（未在渠道里配置"请求体模板"时）：

```json
{ "to": "...", "subject": "...", "content": "...", "<你的variables键>": "..." }
```

- 请求头默认 `Content-Type: application/json`，可在渠道里加自定义头。
- 若渠道配置了**签名密钥**，会额外带一个 `X-Signature` 头，值为 `HMAC-SHA256(body, secret)` 的十六进制。
- 配置了"请求体模板"时，用 `{{变量名}}` 占位（`to`/`subject`/`content` 及 `variables` 均可引用）。

---

## 7. 查询模板 `GET /api/v1/templates`

供业务系统获取"某模板需要哪些变量"，避免手工对齐。

**列出全部**（仅返回当前密钥有权限的 method 的模板）：`GET /api/v1/templates`

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

**查单个**：`GET /api/v1/templates?code=order-paid`

```json
{ "success": true, "template": { "code": "order-paid", "...": "..." } }
```

不存在或无权限返回 **404**。`variablesJson` 是"填好值即可作为 `variables` 传给发送接口"的骨架。

---

## 8. 响应结构

### 8.1 成功（HTTP 200）

```json
{
  "success": true,
  "channelId": "cmr...",   // 实际发送所用渠道的内部 ID
  "method": "SMS",          // 分发方式
  "detail": "..."           // 服务商返回的原始信息（截断，便于排查）
}
```

### 8.2 失败

```json
{ "success": false, "error": "错误说明（中/英）", "detail": "服务商原始返回（可选）" }
```

`detail` 在容灾全失败（502）时会汇总各渠道的失败原因，便于逐个排查。

---

## 9. 错误码大全

| HTTP | 触发场景 | `error` 文案（示例） |
|------|----------|----------------------|
| 400 | 请求体不是合法 JSON | `请求体不是合法 JSON / invalid JSON body` |
| 400 | 用 `group` 但缺少 `content` | `缺少 content` |
| 400 | 既没给 `group` 也没给 `template` | `必须提供 group（分组编号）或 template（模板编号）` |
| 401 | 未带密钥 | `缺少 API 密钥 / missing API key` |
| 401 | 密钥无效或已停用 | `无效或已停用的密钥 / invalid or disabled key` |
| 403 | 生产密钥 IP 不在白名单 | `IP 不在白名单 / IP not allowed: <ip>` |
| 403 | 密钥无该分发方式权限 | `密钥无 <METHOD> 权限` |
| 404 | 模板不存在或已停用 | `模板不存在或已停用: <code>` |
| 404 | 分组不存在 | `分组不存在: <code>` |
| 429 | 超出测试密钥每分钟限速 | `超出测试密钥限速（每分钟 N 次）/ rate limit exceeded (N/min)` |
| 502 | 分组内**全部**渠道均发送失败 | 视各渠道而定，`detail` 汇总原因 |

> 约定：`2xx` 且 `success:true` 才算受理成功；其余一律读取 `error` 处理。建议客户端对 **429/502** 做指数退避重试，对 **4xx（除 429）** 不重试（属配置/参数问题）。

---

## 10. 限速、IP 白名单与容灾

- **测试密钥限速**：每分钟调用数达上限后返回 **429**。上限在「API 管理」按密钥设置，未设则用系统默认值。
- **生产密钥 IP 白名单**：设置了可信 IP 时，仅这些 IP 的请求被接受，否则 **403**。
  IP 取自 `X-Forwarded-For` 的第一段（回落 `X-Real-IP`），**需部署在可信反向代理之后**才准确。
- **渠道级限速**：单个渠道可设"每分钟条数"，超出后该渠道被**自动跳过**，交给同组其他渠道。
- **容灾（自动换渠道）**：一个分组配多个渠道时，按策略（**轮询 / 调用最少**）排序后**逐个尝试**，
  某渠道失败或已达限速就跳到下一个，直到成功或全部失败。因此单个服务商临时故障不影响送达，
  且**成功即止，绝不重复发**。

---

## 11. 多语言 SDK 示例

> 下列示例统一以"按平台模板发送"为例（最推荐：文案集中在后台维护）。

### 11.1 curl —— 按分组发送（Webhook / 群机器人 / 邮件）

```bash
curl -X POST https://qwq-message.zeabur.app/api/v1/send \
  -H "Authorization: Bearer qwq_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{ "group": "ops-alert", "content": "服务器 CPU 超过 90%，请及时处理。" }'
```

### 11.2 curl —— 按分组发短信（服务商模板 + 变量）

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

### 11.3 curl —— 按平台模板发送（推荐）

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

### 11.4 curl —— 发邮件（多个收件人，HTML 正文）

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

### 11.5 Node.js（含错误处理与超时）

```js
async function notify() {
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
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`发送失败[${res.status}]：${data.error}`);
  }
  return data; // { success, channelId, method, detail }
}
```

### 11.6 Python（requests）

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
if not (resp.ok and data.get("success")):
    raise RuntimeError(f"发送失败[{resp.status_code}]：{data.get('error')}")
```

### 11.7 PHP（cURL）

```php
$ch = curl_init("https://qwq-message.zeabur.app/api/v1/send");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
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
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($code !== 200 || empty($data["success"])) {
    error_log("发送失败[$code]：" . ($data["error"] ?? ""));
}
```

### 11.8 Go（net/http）

```go
package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"
)

func notify() error {
	payload, _ := json.Marshal(map[string]any{
		"template":  "order-paid",
		"to":        "13800000000",
		"variables": map[string]string{"orderNo": "SO20260101", "amount": "199.00"},
	})
	req, _ := http.NewRequest("POST",
		"https://qwq-message.zeabur.app/api/v1/send", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer qwq_live_xxxxxxxx")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var data struct {
		Success bool   `json:"success"`
		Error   string `json:"error"`
	}
	json.NewDecoder(resp.Body).Decode(&data)
	if resp.StatusCode != 200 || !data.Success {
		return &SendError{Status: resp.StatusCode, Msg: data.Error}
	}
	return nil
}
```

---

## 12. 常见问题 FAQ

**Q：`group` 和 `template` 有什么区别？**
A：`group` 直接指定用哪组渠道、内容你自己传；`template` 用后台建好的模板（含正文和变量清单），
业务系统只传编号和变量，正文由平台统一维护，改文案不用改代码、不用重新发版。

**Q：短信的 `templateCode` 是什么？和平台"模板编号"什么关系？**
A：`templateCode` 是你在**短信服务商**（火山/阿里/腾讯）后台申请、审核通过的模板 ID；
平台"模板编号（template）"是本系统里的标识。二者无关。`variables` 的键要与服务商模板占位一致。

**Q：怎么确认发送结果？**
A：响应 `success:true` 即已受理/送达；失败看 `error`（和 `detail`）。后台「日志 → 最近调用记录」
可逐条查看，支持按分组筛选、导出 Excel。

**Q：一条请求会不会重复发送？**
A：不会。容灾是"前一个失败才试下一个"，成功即停止，绝不向多个渠道重复发。

**Q：能查某模板需要哪些变量吗？**
A：能。`GET /api/v1/templates?code=<编号>`，返回里的 `variables` 是变量名清单、
`variablesJson` 是可直接填值的骨架。

**Q：429 / 502 该怎么处理？**
A：都建议**指数退避重试**（如 1s、2s、4s）。429 是触发了测试密钥限速（可换生产密钥或调高上限）；
502 是该分组所有渠道都失败（检查渠道凭证/服务商状态，看 `detail`）。

---

## 附录 A：qwq-sso 单点登录（管理员）

> 此附录面向**部署本平台的管理员**，与上面的"业务发送 API"无关——它讲的是让团队成员用
> qwq-sso 账号登录本平台后台。终端业务系统对接发送**不需要**读这一节。

本平台后台登录支持 **qwq-sso（OIDC 授权码流程）**。配置在后台「**系统设置**」：

| 字段 | 说明 |
|------|------|
| 应用访问地址 | 你的公开域名（拼回调地址用，须准确，不带末尾斜杠） |
| SSO 服务地址 | qwq-sso 的地址，如 `https://qwqsso.zeabur.app` |
| Client ID / Client Secret | 在 qwq-sso「应用管理」建应用后获得 |

**回调地址**（务必加入 qwq-sso 应用的 `callback_url` 白名单，且完全一致）：

```
https://<你的域名>/api/auth/sso/callback
```

**登录模式：先绑定，再登录。**

- 团队成员**首次**用 qwq-sso 登录时，若该 SSO 身份尚未绑定平台账号，会被**引导到绑定页**，
  用平台账号密码登录一次即完成绑定；之后即可一键 qwq-sso 登录。
- 也可先用平台账号登录，在「用户设置 → qwq-sso」里主动绑定。
- 管理员可在「系统设置 → qwq-sso 绑定管理」查看/解绑所有账号的 SSO 绑定（用于清理错绑）。

**排错**：登录失败会带细分错误码回登录页，常见：

| 错误码 | 含义 | 处理 |
|--------|------|------|
| `sso_token_401` | 换 token 时 qwq-sso 返回 401 | **Client ID / Client Secret 填错**，去系统设置重填 |
| `sso_token_400` | 换 token 返回 400（`invalid_grant`） | 回调地址与注册的 `callback_url` 不一致，或授权码过期 |
| `sso_userinfo_401` | 取用户信息 401 | access_token 失效，重试；持续则检查 qwq-sso 侧配置 |
| `sso_badstate` / `sso_nostate` | 防 CSRF 的 state 校验失败 | 多为跨站 cookie 未回传，检查域名/HTTPS |
| `sso_nocfg` | 未配置 SSO | 系统设置里补全三项配置 |

---

_本文档随代码维护；如与实际行为不一致，以后台「API 管理 / 系统设置」页面提示与实际响应为准。_
