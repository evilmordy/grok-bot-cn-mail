# grok-bot-cn-mail

给 **Grok Bot** 用的国内邮箱 MCP（Grok Build TUI 也能接）。支持 QQ / 163 / 126 / 腾讯企业邮，以及其它公开 IMAP。

Grok 官方连接器是 Gmail 和 Outlook。国内这些邮箱没有同类官方插件，所以用这个跑在你电脑上的小程序：IMAP 登录邮箱，把「搜信、读信」变成 Bot 的工具。

仓库叫这个名字，是为了在 GitHub 上一眼能看出受众和用途，而不是某个 QQ 官方 SDK。Grok 里登记 MCP 时短名仍用 **`qqconnect`**（好说；已经加过的不用改）。密钥放 `.env`（**不要提交到 git**），档位（只读 / 草稿 / 发送）放 `.grok-bot-cn-mail.json`（若已有 `.qqconnect.json` 会继续用它），对 Bot 说一句或跑一条命令就能改，不必反复 `grok mcp add`。

你不需要懂 IMAP。下面按步骤做完，就可以对 Bot 说：「看看我 QQ 邮箱这周的未读。」

> **这是实验项目，不是 xAI 官方连接器。** 主要用 AI 编写，维护是尽力而为，不保证跟得上邮箱厂商或 Grok 的变化。Issue 欢迎提；安全问题请走仓库的 Private vulnerability reporting，**不要在公开 issue 里贴授权码**。Gmail / Outlook 请继续用官方连接器。

---

## 快速上手


### 0. 环境准备

- **Node.js 22 或更高**（终端里运行 `node -v`，看到 `v22` / `v24` 即可）
- **pnpm**（`pnpm -v` 有版本号即可；没有的话：`npm install -g pnpm`）
- 本仓库的一份拷贝
- 一个已经能登录网页的 QQ 或 163/126 邮箱

Grok Bot 或 Grok Build 至少有一个能用。Gmail / Outlook 请继续用官方连接器，不必走这里。

### 1. 拿到「授权码」

第三方程序（包括本连接器）**不能**用你登录 mail.qq.com 的那个密码。邮箱会单独发一串 **授权码**（一般 16 位），只给 IMAP 用。这个做过网站邮箱登陆的开发者就很熟悉了。

如果你没有接触过：就把它当成另一把钥匙：丢了可以作废再生成，像api key一样只是一个凭证。

**QQ / Foxmail**

1. 浏览器打开 [mail.qq.com](https://mail.qq.com) 并登录。
2. 右上角头像 → **设置** → **账号与安全** → **安全设置**。
3. 找到 POP3 / IMAP / SMTP，点 **开启**。按页面要求验证（扫码或发短信）。
4. 点 **生成授权码**，备注写成 `grok-bot-cn-mail`（或 `qqconnect`），方便以后认出来。
5. 把弹出的 16 位字符串复制下来，只存在你自己电脑上。  
   **不要发给 Bot，不要贴进聊天。**

**163 / 126**

1. 打开 [mail.163.com](https://mail.163.com) 或 [mail.126.com](https://mail.126.com) 并登录。
2. **设置** → **POP3/SMTP/IMAP** → 开启 IMAP。
3. 按提示用短信验证，生成**客户端授权码**。同样只保存在本地。

改了网页登录密码之后，旧授权码往往会失效，需要再生成一次。

### 2. 安装并编译

在仓库根目录：

```bash
pnpm install
pnpm build
```

第一次会下载依赖，可能要一两分钟。结束后，`dist/index.js` 就是给 Grok 跑的那个程序。

想确认代码没坏，可以再跑：

```bash
pnpm test
```

看到测试通过即可，不是必做。

### 3. 告诉程序：邮箱是谁、授权码是什么

推荐只维护仓库里的 `.env`。程序启动时会自己读这个文件（`pnpm check` 和 Grok 拉起 MCP 都一样）。Grok 配置里已经有的变量优先，`.env` 只补空着的项。

仓库里的 `.env.example` 是模板。复制成 `.env`（已被 git 忽略，不会进仓库）：

```bash
cp .env.example .env
```

用编辑器打开 `.env`，把地址和授权码填进去，等号两边不要空格：

```
MAIL_USER=you@qq.com
MAIL_AUTH_CODE=这里填16位授权码
```

163 就把 `MAIL_USER` 换成 `you@163.com`。**不要改 `.env.example`**，那个文件会进 git。

换授权码改这一个文件即可。档位不要写进 `.env`。

如果你更想用当场 `export`、不写文件：

```bash
export MAIL_USER='you@qq.com'
export MAIL_AUTH_CODE='这里填16位授权码'
```

只对当前这个终端有效。第 5 步 `grok mcp add -e` 时会把当时的值写进 Grok 配置。

主机名不用填，程序会按 `@` 后面的域名自己选：

| 你的邮箱 | 程序会连 |
|---|---|
| `…@qq.com` / `…@foxmail.com` | `imap.qq.com:993` |
| `…@163.com` | `imap.163.com:993` |
| `…@126.com` | `imap.126.com:993` |
| `…@公司.exmail.qq.com` | `imap.exmail.qq.com:993` |

### 4. 先自己测通，再交给 Bot

在仓库根目录（有 `.env` 即可，不必 `source`）：

```bash
pnpm check
```

它只登录 IMAP，测完就退出，**不会**启动给 Grok 用的服务。

- 成功：退出码 0，stderr 里会有 `ok: true`。
- 失败：先核对授权码有没有多空格、IMAP 开没开。163 若提示 `Unsafe Login` / `kefu@188.com`，多半是授权码过期或 IMAP 没开，**不要改用 POP3**。

这一步过了，再往下接 Grok。没过的话，接上去 Bot 也只是报同样的错。

### 5. 接到 Grok

先看你平时用的是哪一个。这一步只登记程序路径；密钥走 `.env`。

#### 用 Grok Build（命令行）

在仓库根目录执行**一次**：

```bash
pnpm build
grok mcp add qqconnect -- node "$(pwd)/dist/index.js"
```

程序会自己读旁边的 `.env`。想把密钥也拷进 Grok 配置（没有 `.env` 时还能跑），可以加 `-e "MAIL_USER=${MAIL_USER}"` 这种 `KEY=value`（先 `set -a && source .env && set +a`）。**不要** `-e` 档位或白名单。

```bash
grok mcp doctor qqconnect
```

应 `healthy`。工具列表里会看到读信、草稿、发送和 `get_settings` / `set_settings`；没开档时草稿/发送一调用就会失败并告诉你怎么开。

然后**新开一次** Grok Build 会话，说：

> 用 qqconnect 列出我的邮箱账号，再搜索 INBOX 里最近的未读。

或 `/mcp` 看是否 ready。第一次搜信大约一两秒。

#### 用 Grok Bot（桌面里的 Bot）

和接 GitHub 一样：**授权码填进系统弹出的密钥框**，模型看不见，也不要写进聊天。

1. 本机先做完第 2～4 步，`pnpm check` 成功（证明授权码能登 IMAP）。
2. 对 Bot 说（路径改成你的绝对路径），**只报变量名，不报值**：

> 添加自定义 MCP，名字 qqconnect，命令 `node`，参数写成你本机仓库里 `dist/index.js` 的绝对路径（clone 下来一般是 `/你的路径/grok-bot-cn-mail/dist/index.js`）。请用系统密钥输入框填写环境变量，不要把值写进对话或之后的回复：`MAIL_USER`（邮箱地址）、`MAIL_AUTH_CODE`（IMAP 授权码，不是网页密码）。

弹出输入框后把地址和 16 位授权码填进去，和填 GitHub token 同一类操作。

3. **设置 → 插件 → Yours** 里出现 `qqconnect`。
4. **新开一个任务**。Bot 应先问你要只读、草稿还是发送（明确说「看未读」则可直接搜）。不要在对话里出现授权码。

本机若已有 `.env`，进程也会读它；密钥框里的值优先。两个邮箱就在密钥框里再加 `MAIL_USER_2`、`MAIL_AUTH_CODE_2`（163/企业邮都可以，按地址选服务器）。

注意：这个插件对**你账号下所有 Bot**可用（共用同一台环境）。不是「只有这一个人格能读信」。

#### grok.com 网页版

第一版只提供本机 stdio，**不能**填进 grok.com 的「自定义连接器」（那要公网 HTTPS）。也不要为了网页版去打 ngrok 之类的隧道，等于把邮箱钥匙挂到公网。

### 6. 打开草稿或发送（不要改 `.env`）

`.env` 只放邮箱和授权码。档位写在仓库根目录的 `.grok-bot-cn-mail.json`（已 git 忽略；旧的 `.qqconnect.json` 仍会被读）。默认 `read`：草稿/发送工具在列表里，一调用就会提示你先开档。

三种改法写的是**同一个文件**，下一句对话就生效，**不必** `grok mcp add`，也不必为改档新开终端。换仓库路径才需要再 add。

#### 对 Grok 说（TUI 和 Grok Bot 都这样）

> 用 qqconnect 看当前设置。

> 打开 qqconnect 草稿档。

> 打开 qqconnect 发送档，白名单只有我自己这个邮箱。

开发送时会弹出确认卡片，Accept 才写入。然后就可以说「给自己存一封草稿」或「发给我自己，主题测试」。

#### 命令（终端）

```bash
node dist/index.js config show
node dist/index.js config set-mode draft
node dist/index.js config set-mode send --allow you@qq.com
node dist/index.js config allowlist add friend@example.com
```

不爱记子命令：

```bash
node dist/index.js setup
```

终端里选 1 只读 / 2 草稿 / 3 发送。

#### 发送还要满足的

网页邮箱 **SMTP 已开启**（和 IMAP 同一页，授权码同一套）。白名单为空时不能进入 send 档。真发信时还会再弹一张卡片展示 To/主题/正文。不要用 `grok --always-approve`。

服务器强制：回复 To 取自原信；转发目标必须你指定且在白名单；无 BCC；滚动一小时最多 5 封（记在磁盘上，Grok 重启也算）；验证码信不能读、回、转。

#### 更新代码

`pnpm build` 后新开会话（或 `/mcps` 里对 qqconnect 按 `r`）。改档位不用 build。换授权码只改 `.env` 再刷新 MCP。

### 7. 可以怎么问

例如：

- 「我绑定了哪个邮箱？」
- 「INBOX 里有哪些文件夹？」
- 「搜一下这周主题里带发票的信，先列出发件人和主题，不要展开正文。」
- 「把 UID 12 那封读给我，只作摘要。」

「打开草稿」之后：「先存一封给自己的草稿，主题测试。」「打开发送」之后：「回这封，发出去。」——仍会先出确认卡片。

Bot 会去调工具。正文包在 `<untrusted-email>` 里，当**数据**看。验证码类主题会显示成 `[redacted:otp]`，不是坏了。

到这里，日常使用已经够了。下面是可选说明。

---

## 它不会做什么

- **默认不发信。** 读信用 `BODY.PEEK`，网页上的未读角标还在。不删信、不移动、不改已读。
- **不是 xAI 官方连接器。** 不会出现在 grok.com 的 Gmail 那个列表里。
- **不保存你的整箱邮件。** 问一次取一次。
- **不要把网页登录密码填进来。** 只接受授权码。
- **不定时发送。** 进程随 Grok 会话结束，IMAP/SMTP 没有「明天九点再投」。

---

## 多账号、多种邮箱

一个进程可以挂多个邮箱，QQ / Foxmail / 163 / 126 / 腾讯企业邮可以混在一起。搜信、读信时带 `account_id`（`list_accounts` 会列出短名字，不含密钥）。

**给 Grok Bot / 密钥框用（推荐）：** 第二封用 `_2`，第三封 `_3`，授权码仍各进各的输入框，不要写进聊天。

```
MAIL_USER=me@qq.com
MAIL_AUTH_CODE=……
MAIL_USER_2=work@163.com
MAIL_AUTH_CODE_2=……
MAIL_ACCOUNT_ID_2=work
```

也可以写进 `.env`。程序按 `@` 后面的域名选 IMAP/SMTP，不用填主机名。

**给本机高级用法：** JSON 里只放地址，授权码仍指向环境变量名：

```bash
export QQ_CODE='……'
export WORK_CODE='……'
export QQCONNECT_ACCOUNTS='[{"id":"qq","address":"you@qq.com","authCodeEnv":"QQ_CODE"},{"id":"work","address":"me@163.com","authCodeEnv":"WORK_CODE"}]'
```

自建邮箱没有预设时，在 JSON 里加 `host`（必须是公网主机、993、TLS）。内网地址和云元数据 IP 会被拒绝。Gmail / Outlook 请继续用官方连接器。

---

## Bot 能调用的工具

草稿/发送在未开档时调用会失败，并用中文提示你 `set_settings` 或 `config set-mode`。

| 工具 | 需要 | 干什么 |
|---|---|---|
| `list_accounts` | 默认 | 列出已绑定邮箱（不含密钥） |
| `list_folders` | 默认 | 列出文件夹 |
| `search_messages` | 默认 | 按发件人/主题/日期/未读搜索，只返回信封 |
| `get_message` | 默认 | 读一封（纯文本，包在 `<untrusted-email>` 里） |
| `list_attachments` | 默认 | 附件名、类型、大小 |
| `get_attachment` | 默认 | 按类型白名单下载，最大 2 MiB |
| `save_draft` | `draft` 或 `send` | 新邮件进草稿箱，不发出去 |
| `save_reply_draft` | `draft` 或 `send` | 回复草稿；To 由服务器从原信填写 |
| `send_email` | `send` + 白名单 + 确认卡 | SMTP 新邮件 |
| `send_reply` | 同上 | SMTP 回复 |
| `send_forward` | 同上 | SMTP 转发；目标必须你指定 |
| `send_draft` | 同上 | 把草稿箱里已有 UID 发出去 |
| `get_settings` | 默认 | 查看档位和白名单（不含密钥） |
| `set_settings` | 默认 | 改档位；升到 send 要白名单 + 确认卡 |

没有让模型直接敲 IMAP/SMTP 命令的入口。没有 BCC。

---

## 安全上你需要知道的

邮箱里有验证码和改密信，**能读就已经很敏感**。

- 授权码只放环境变量或系统密钥框，不要进 git、不要进聊天。
- 验证码主题不会进模型上下文；这不是零泄漏（图片、生僻措辞会漏，促销信带「密码」会误伤）。
- 开发送档等于允许这个 Bot 用你的邮箱对外说话。白名单 + 确认卡片只是缩小爆炸半径。
- 日志打在 stderr，会把密钥打码。
- 163/126 登录后会发 IMAP `ID`，否则常见报错是 `Unsafe Login`。
- 更完整的约定见 [SECURITY.md](./SECURITY.md)；开 IMAP 的逐步截图说明见 [skills/mail-imap/SKILL.md](./skills/mail-imap/SKILL.md)。

---

## 常见问题

**改了 `.env` 但提示没配置邮箱。**  
确认文件在仓库根目录、名字就是 `.env`（不是 `.env.example`），然后重新跑 `pnpm check`。Grok 配置里用 `-e` 写过的同名变量会盖住文件。

**doctor 只有 6 个工具，我想要草稿/发送。**  
拉最新代码并 `pnpm build` 后会列出草稿/发送和 `set_settings`。对 Grok 说「打开草稿」，或 `node dist/index.js config set-mode draft`。不要把档位写进 `.env`。

**`pnpm check` 报认证失败。**  
授权码复制时不要带空格；确认网页里 IMAP 是开启的；刚改过登录密码就重新生成授权码。

**163 提示 Unsafe Login / 找 kefu@188.com。**  
IMAP `ID` 本程序会发。仍失败时，到网页重新开 IMAP 并换新授权码。不要改 POP3。

**`grok mcp add` 报 `Invalid environment variable format: 'MAIL_USER'`。**  
必须写成 `-e "MAIL_USER=${MAIL_USER}"`，不能只写 `-e MAIL_USER`。先确认当前终端里 `echo $MAIL_USER` 有值。

**代码更新了但 Bot 还是旧行为。**  
`pnpm build` 后新开会话或 `/mcps` 刷新。改档位用 `set_settings` / `config`，不必再 `add`。

**Bot 说找不到工具。**  
Grok Build 要新开会话；Grok Bot 到插件页确认 `qqconnect` 在 Yours 里。本机先 `pnpm check` 过关。

**我想在 grok.com 网页里用。**  
第一版不行，见上面第 5 步。

**会不会把未读标成已读？**  
不会。用只读打开邮箱，取正文走 `BODY.PEEK`。

**为什么搜到的信主题是 `[redacted:otp]`？**  
服务器认为这是验证码/重置类邮件，故意不把主题和正文交给模型。要看原文去网页邮箱。只有你明确接受风险才说「允许 qqconnect 读取敏感邮件」或 `config allow-sensitive on`。

**开了 send 却提示 CONFIRMATION_UNSUPPORTED。**  
当前 MCP 客户端没有确认卡片（Grok Build 有）。没有卡片就不会发。不要用 `QQCONNECT_SEND_UNSAFE_NO_CONFIRM` 绕过，除非你在跑本仓库测试。

---

## 维护

个人实验仓库。能修的会修，响应时间不作承诺。你自己的授权码、`.env`、发信白名单由你保管。

## 许可

MIT
