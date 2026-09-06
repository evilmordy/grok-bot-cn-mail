# Changelog

## Unreleased

- 打开 `allow_sensitive` 要确认卡（本机改 JSON / `config allow-sensitive on` 除外）。
- 拒绝收件人和 RFC822 头里的 CR/LF。
- 附件下载与读信走同一套验证码拦截；IMAP 下载有字节上限。
- `--check` 与运行时一样拒绝解析到私网的主机。
- 发草稿时按与新邮件相同的规则解析 To/Cc；确认卡主题与实际发出一致。

## 0.1.0

- 默认只读的 IMAP MCP：QQ / 163 / 126 / 腾讯企业邮。
- 草稿和 SMTP 发送需显式开档；发送要白名单和确认卡。
- `pnpm test` / CI 用假后端；真登录用本地 `pnpm check`。
