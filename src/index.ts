#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { runCli } from "./cli.js";
import { loadAccounts } from "./config/accounts.js";
import { loadDotEnv } from "./config/dotenv.js";
import { getSettings } from "./config/settings.js";
import { ImapMailBackend } from "./imap/client.js";
import { logError, logInfo } from "./log.js";
import { createMailServer } from "./mcp/server.js";

function usage(): void {
  process.stderr.write(`grok-bot-cn-mail (qqconnect) — IMAP MCP for Grok Bot (read by default; draft/send via config)

Usage:
  qqconnect                 start MCP on stdio
  qqconnect --check         login to each mailbox and exit
  qqconnect setup           interactive mode picker
  qqconnect config show
  qqconnect config set-mode read|draft|send [--allow a@b.com]
  qqconnect config allowlist add|remove|set a@b.com,...
  qqconnect config allow-sensitive on|off

Secrets (.env): MAIL_USER / MAIL_AUTH_CODE
Policy (.qqconnect.json): mode, send_allowlist, allow_sensitive
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    usage();
    process.exit(0);
  }

  loadDotEnv();

  if (args[0] === "config" || args[0] === "setup") {
    await runCli(args);
    return;
  }

  const accounts = loadAccounts();
  const backend = new ImapMailBackend(accounts);

  if (args.includes("--check")) {
    const results = await backend.check();
    process.stderr.write(`${JSON.stringify({ results }, null, 2)}\n`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }

  const settings = getSettings();
  logInfo("mcp.start", {
    accounts: accounts.map((a) => a.id),
    mode: settings.mode,
    allowlistCount: settings.send_allowlist.length,
  });

  const handle = serveStdio(() => createMailServer(backend));

  const exit = async () => {
    try {
      await handle.close();
    } catch (err) {
      logError("mcp.close", err);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void exit();
  });
  process.on("SIGTERM", () => {
    void exit();
  });
  process.stdin.on("end", () => {
    void exit();
  });
  process.stdin.on("close", () => {
    void exit();
  });
}

main().catch((err) => {
  logError("fatal", err);
  process.exit(1);
});
