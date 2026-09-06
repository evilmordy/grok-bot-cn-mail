---
name: mail-imap
description: Enable IMAP/SMTP and create an authorization code (授权码) for QQ, 163, or 126 mail so grok-bot-cn-mail can read (and optionally draft/send). Never ask for the web login password.
---

# IMAP 授权码

grok-bot-cn-mail 只用 **IMAP 授权码**，不要网页登录密码。

## QQ / Foxmail

1. 打开 https://mail.qq.com → 设置 → 账号与安全 → 安全设置
2. 开启 IMAP/SMTP
3. 生成 16 位授权码并备注「qqconnect」
4. 把授权码放进环境变量 `MAIL_AUTH_CODE`，邮箱地址放进 `MAIL_USER`
5. 服务器：`imap.qq.com:993`（本连接器会按域名自动填）

作废：同一页的授权码管理。改 QQ 密码会使授权码失效。

## 163 / 126

1. 网页邮箱 → 设置 → POP3/SMTP/IMAP → 开启 IMAP
2. 按提示发短信，生成客户端授权码
3. 163 在 LOGIN 之后必须发 IMAP `ID`。本连接器默认会发。若仍报 `SELECT Unsafe Login` / `kefu@188.com`，先确认授权码是新的，不要改用 POP3。

## 接到 Grok Bot

加邮箱只报变量名（第一封 `MAIL_USER` / `MAIL_AUTH_CODE`，第二封 `MAIL_USER_2` / `MAIL_AUTH_CODE_2`），请用户在**插件密钥框**填写。地址也是密钥，不要发到聊天。不要读或改仓库 `.env`，不要改 MCP 启动命令。填好后请用户重载 qqconnect。

## 不要做的

- 不要把授权码或邮箱地址发给模型或贴进聊天
- 不要用 POP3
- 不要为了连上而关闭 TLS 校验
- 不要为加邮箱发明 `run-mcp.sh` 或 `source .env` 启动方式
