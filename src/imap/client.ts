import { ImapFlow } from "imapflow";
import type { Account } from "../config/accounts.js";
import { publicAccountView } from "../config/accounts.js";
import { logError, logInfo, logWarn } from "../log.js";
import { replyTargets } from "../mail/compose.js";
import { attachmentNodes, textParts, type MimeNode } from "../mail/mime.js";
import {
  assertComposeBody,
  buildRfc822,
  forwardSubject,
  generateMessageId,
  quoteOriginal,
  replySubject,
} from "../mail/rfc822.js";
import type {
  AccountInfo,
  AttachmentMeta,
  ComposeInput,
  FolderInfo,
  ForwardInput,
  MailBackend,
  MessageBody,
  MessageMeta,
  OutboundResult,
  ReplyInput,
  SearchQuery,
} from "../mail/types.js";
import { assertAttachmentAllowed } from "../sanitize/attachments.js";
import { pickBody, truncateBody } from "../sanitize/html.js";
import { applyBodyGate, assertNotBlocked, blockedStub, redactSearchHit } from "../sanitize/present.js";
import { classifyEnvelope } from "../sanitize/sensitive.js";
import { messageId, wrapUntrustedEmail } from "../sanitize/untrusted.js";
import { sendSmtp } from "../smtp/client.js";
import { toImapSearch } from "./search.js";

const MAX_FOLDERS = 200;
const VERSION = "0.1.0";

function envelopeAddr(
  list: Array<{ address?: string; name?: string }> | undefined,
): string | undefined {
  if (!list?.length) return undefined;
  return list
    .map((a) => a.address)
    .filter(Boolean)
    .join(", ");
}

function domainOfAddress(address: string): string {
  const at = address.lastIndexOf("@");
  return at > 0 ? address.slice(at + 1) : "localhost";
}

export class ImapMailBackend implements MailBackend {
  constructor(private readonly accounts: Account[]) {}

  listAccounts(): AccountInfo[] {
    return this.accounts.map(publicAccountView);
  }

  private account(id: string): Account {
    const found = this.accounts.find((a) => a.id === id);
    if (!found) throw new Error(`unknown account ${id}`);
    return found;
  }

  private createClient(account: Account): ImapFlow {
    const client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: true,
      auth: { user: account.address, pass: account.authCode },
      logger: false,
      disableAutoIdle: true,
      disableIMAP4rev2: account.preset.disableImap4rev2,
      clientInfo: account.sendImapId
        ? { name: "grok-bot-cn-mail", version: VERSION, vendor: "grok-bot-cn-mail" }
        : undefined,
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    });
    client.on("error", (err) => {
      logError("imap.error", err, { accountId: account.id, host: account.host });
    });
    return client;
  }

  private async withConnection<T>(account: Account, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = this.createClient(account);
    try {
      await client.connect();
      return await fn(client);
    } finally {
      try {
        await client.logout();
      } catch (err) {
        logWarn("imap.logout_failed", { accountId: account.id });
        logError("imap.logout", err, { accountId: account.id });
      }
    }
  }

  private async withMailbox<T>(
    account: Account,
    folder: string,
    fn: (client: ImapFlow) => Promise<T>,
    readOnly = true,
  ): Promise<T> {
    return this.withConnection(account, async (client) => {
      const lock = await client.getMailboxLock(folder, { readOnly });
      try {
        return await fn(client);
      } finally {
        lock.release();
      }
    });
  }

  private async specialUsePath(client: ImapFlow, use: "\\Drafts" | "\\Sent"): Promise<string> {
    const boxes = await client.list();
    const hit = boxes.find((b) => b.specialUse === use);
    if (!hit) throw new Error(`no ${use} folder on this mailbox`);
    return hit.path;
  }

  async listFolders(accountId: string): Promise<FolderInfo[]> {
    const account = this.account(accountId);
    return this.withConnection(account, async (client) => {
      const boxes = await client.list();
      return boxes.slice(0, MAX_FOLDERS).map((b) => ({
        path: b.path,
        name: b.name,
        specialUse: b.specialUse || undefined,
      }));
    });
  }

  async search(query: SearchQuery): Promise<MessageMeta[]> {
    const account = this.account(query.accountId);
    const criteria = toImapSearch(query);
    return this.withMailbox(account, query.folder, async (client) => {
      const uids = await client.search(criteria, { uid: true });
      const list = Array.isArray(uids) ? uids : [];
      const sliced = list.slice(-query.limit);
      if (sliced.length === 0) return [];
      const out: MessageMeta[] = [];
      for await (const msg of client.fetch(
        sliced,
        { envelope: true, bodyStructure: true, uid: true },
        { uid: true },
      )) {
        const atts = attachmentNodes(msg.bodyStructure as MimeNode | undefined);
        const env = msg.envelope;
        out.push(
          redactSearchHit(
            {
              uid: msg.uid,
              folder: query.folder,
              from: envelopeAddr(env?.from),
              to: envelopeAddr(env?.to),
              date: env?.date ? new Date(env.date).toISOString() : undefined,
              subject: env?.subject,
              hasAttachment: atts.length > 0,
            },
            query.accountId,
          ),
        );
      }
      return out.reverse();
    });
  }

  async getMessage(accountId: string, folder: string, uid: number): Promise<MessageBody> {
    const account = this.account(accountId);
    return this.withMailbox(account, folder, async (client) => {
      const envMsg = await client.fetchOne(String(uid), { envelope: true, uid: true }, { uid: true });
      if (!envMsg) throw new Error(`message ${uid} not found in ${folder}`);
      const env = envMsg.envelope;
      const from = envelopeAddr(env?.from);
      const date = env?.date ? new Date(env.date).toISOString() : undefined;
      const envCls = classifyEnvelope(from, env?.subject);
      if (envCls) {
        logInfo("mail.blocked", { accountId, uid, class: envCls, stage: "envelope" });
        return blockedStub(uid, folder, from, date, envCls);
      }

      const msg = await client.fetchOne(
        String(uid),
        { envelope: true, bodyStructure: true, uid: true },
        { uid: true },
      );
      if (!msg) throw new Error(`message ${uid} not found in ${folder}`);
      const structure = msg.bodyStructure as MimeNode | undefined;
      const parts = textParts(structure);
      let plain: string | undefined;
      let html: string | undefined;
      if (parts.plain) {
        const downloaded = await client.download(String(uid), parts.plain.part, { uid: true });
        plain = await streamToString(downloaded.content);
      }
      if (parts.html) {
        const downloaded = await client.download(String(uid), parts.html.part, { uid: true });
        html = await streamToString(downloaded.content);
      }
      const picked = pickBody(plain, html);
      const { text, truncated } = truncateBody(picked);
      const attachments = attachmentNodes(structure).map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        size: a.size,
        part: a.part,
      }));
      const id = messageId(accountId, folder, uid);
      const fullEnv = msg.envelope;
      const rfcMessageId = fullEnv?.messageId || undefined;
      const inReplyTo = fullEnv?.inReplyTo || undefined;
      return applyBodyGate(
        {
          uid,
          folder,
          from,
          to: envelopeAddr(fullEnv?.to),
          cc: envelopeAddr(fullEnv?.cc),
          date,
          subject: fullEnv?.subject,
          body: text,
          truncated,
          wrapped: wrapUntrustedEmail(id, text),
          attachments,
          rfcMessageId,
          replyTo: envelopeAddr(fullEnv?.replyTo),
          inReplyTo,
          references: [inReplyTo, rfcMessageId].filter(Boolean).join(" ") || undefined,
        },
        accountId,
      );
    });
  }

  async listAttachments(accountId: string, folder: string, uid: number): Promise<AttachmentMeta[]> {
    const msg = await this.getMessage(accountId, folder, uid);
    if (msg.blocked) throw new Error(`refusing to list attachments on a ${msg.blockedClass} message`);
    return msg.attachments;
  }

  async getAttachment(
    accountId: string,
    folder: string,
    uid: number,
    part: string,
  ): Promise<{ filename: string; contentType: string; bytes: Buffer }> {
    const account = this.account(accountId);
    return this.withMailbox(account, folder, async (client) => {
      const envMsg = await client.fetchOne(String(uid), { envelope: true, uid: true }, { uid: true });
      if (!envMsg) throw new Error(`message ${uid} not found`);
      const envCls = classifyEnvelope(envelopeAddr(envMsg.envelope?.from), envMsg.envelope?.subject);
      if (envCls) throw new Error(`refusing to download attachments on a ${envCls} message`);
      const msg = await client.fetchOne(String(uid), { bodyStructure: true, uid: true }, { uid: true });
      if (!msg) throw new Error(`message ${uid} not found`);
      const atts = attachmentNodes(msg.bodyStructure as MimeNode | undefined);
      const meta = atts.find((a) => a.part === part);
      if (!meta) throw new Error(`attachment part ${part} not found`);
      assertAttachmentAllowed(meta.filename, meta.size);
      const downloaded = await client.download(String(uid), part, { uid: true });
      const bytes = await streamToBuffer(downloaded.content);
      assertAttachmentAllowed(meta.filename, bytes.length);
      return {
        filename: downloaded.meta.filename || meta.filename,
        contentType: downloaded.meta.contentType || meta.contentType,
        bytes,
      };
    });
  }

  async check(): Promise<{ id: string; ok: boolean; error?: string }[]> {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const account of this.accounts) {
      const client = this.createClient(account);
      try {
        await client.connect();
        results.push({ id: account.id, ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError("imap.check_failed", err, { accountId: account.id });
        results.push({ id: account.id, ok: false, error: message });
      } finally {
        try {
          await client.logout();
        } catch {
          /* ignore */
        }
      }
    }
    return results;
  }

  async saveDraft(input: ComposeInput): Promise<OutboundResult> {
    const account = this.account(input.accountId);
    assertComposeBody(input.body);
    const messageIdHdr = generateMessageId(domainOfAddress(account.address));
    const raw = buildRfc822({
      from: account.address,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      body: input.body,
      messageId: messageIdHdr,
    });
    const uid = await this.appendRaw(account, "\\Drafts", raw, ["\\Draft"]);
    logInfo("mail.draft_saved", { accountId: account.id, to: input.to, subject: input.subject, uid });
    return {
      folder: "Drafts",
      uid,
      messageId: messageIdHdr,
      to: input.to,
      cc: input.cc ?? [],
      subject: input.subject,
    };
  }

  async saveReplyDraft(input: ReplyInput): Promise<OutboundResult> {
    const orig = await this.getMessage(input.accountId, input.folder, input.uid);
    assertNotBlocked(orig, "reply");
    const account = this.account(input.accountId);
    const targets = replyTargets({
      self: account.address,
      from: orig.from,
      replyTo: orig.replyTo,
      to: orig.to,
      cc: orig.cc,
      replyAll: input.replyAll === true,
    });
    const body = `${input.body.trim()}\n\n${quoteOriginal(orig.from, orig.date, orig.body)}`;
    assertComposeBody(body);
    const subject = replySubject(orig.subject);
    const messageIdHdr = generateMessageId(domainOfAddress(account.address));
    const raw = buildRfc822({
      from: account.address,
      to: targets.to,
      cc: targets.cc,
      subject,
      body,
      messageId: messageIdHdr,
      inReplyTo: orig.rfcMessageId,
      references: orig.references || orig.rfcMessageId,
    });
    const uid = await this.appendRaw(account, "\\Drafts", raw, ["\\Draft"]);
    logInfo("mail.draft_saved", { accountId: account.id, to: targets.to, subject, uid, replyToUid: input.uid });
    return { folder: "Drafts", uid, messageId: messageIdHdr, to: targets.to, cc: targets.cc, subject };
  }

  async sendEmail(input: ComposeInput): Promise<OutboundResult> {
    return this.deliver(input.accountId, {
      to: input.to,
      cc: input.cc ?? [],
      subject: input.subject,
      body: input.body,
    });
  }

  async sendReply(input: ReplyInput): Promise<OutboundResult> {
    const orig = await this.getMessage(input.accountId, input.folder, input.uid);
    assertNotBlocked(orig, "reply");
    const account = this.account(input.accountId);
    const targets = replyTargets({
      self: account.address,
      from: orig.from,
      replyTo: orig.replyTo,
      to: orig.to,
      cc: orig.cc,
      replyAll: input.replyAll === true,
    });
    const body = `${input.body.trim()}\n\n${quoteOriginal(orig.from, orig.date, orig.body)}`;
    return this.deliver(input.accountId, {
      to: targets.to,
      cc: targets.cc,
      subject: replySubject(orig.subject),
      body,
      inReplyTo: orig.rfcMessageId,
      references: orig.references || orig.rfcMessageId,
    });
  }

  async sendForward(input: ForwardInput): Promise<OutboundResult> {
    const orig = await this.getMessage(input.accountId, input.folder, input.uid);
    assertNotBlocked(orig, "forward");
    const quoted = quoteOriginal(orig.from, orig.date, orig.body);
    const body = input.comment?.trim() ? `${input.comment.trim()}\n\n${quoted}` : quoted;
    return this.deliver(input.accountId, {
      to: input.to,
      cc: input.cc ?? [],
      subject: forwardSubject(orig.subject),
      body,
    });
  }

  async sendDraft(accountId: string, uid: number): Promise<OutboundResult> {
    const account = this.account(accountId);
    const draftsPath = await this.withConnection(account, (c) => this.specialUsePath(c, "\\Drafts"));
    const orig = await this.getMessage(accountId, draftsPath, uid);
    assertNotBlocked(orig, "send");
    const to = orig.to ? orig.to.split(/,\s*/) : [];
    const cc = orig.cc ? orig.cc.split(/,\s*/) : [];
    if (to.length === 0) throw new Error("draft has no To header");
    return this.deliver(accountId, {
      to,
      cc,
      subject: orig.subject || "(no subject)",
      body: orig.body,
      inReplyTo: orig.inReplyTo,
      references: orig.references,
    });
  }

  private async deliver(
    accountId: string,
    payload: {
      to: string[];
      cc: string[];
      subject: string;
      body: string;
      inReplyTo?: string;
      references?: string;
    },
  ): Promise<OutboundResult> {
    const account = this.account(accountId);
    assertComposeBody(payload.body);
    const messageIdHdr = generateMessageId(domainOfAddress(account.address));
    await sendSmtp(account, {
      from: account.address,
      to: payload.to,
      cc: payload.cc,
      subject: payload.subject,
      text: payload.body,
      messageId: messageIdHdr,
      inReplyTo: payload.inReplyTo,
      references: payload.references,
    });
    logInfo("mail.sent", {
      accountId: account.id,
      to: payload.to,
      cc: payload.cc,
      subject: payload.subject,
      messageId: messageIdHdr,
    });
    let sentCopied = false;
    try {
      const raw = buildRfc822({
        from: account.address,
        to: payload.to,
        cc: payload.cc,
        subject: payload.subject,
        body: payload.body,
        messageId: messageIdHdr,
        inReplyTo: payload.inReplyTo,
        references: payload.references,
      });
      await this.appendRaw(account, "\\Sent", raw, ["\\Seen"]);
      sentCopied = true;
    } catch (err) {
      logWarn("mail.sent_copy_failed", { accountId: account.id });
      logError("mail.sent_copy", err, { accountId: account.id });
    }
    return {
      messageId: messageIdHdr,
      to: payload.to,
      cc: payload.cc,
      subject: payload.subject,
      sentCopied,
    };
  }

  private async appendRaw(
    account: Account,
    use: "\\Drafts" | "\\Sent",
    raw: string,
    flags: string[],
  ): Promise<number | undefined> {
    return this.withConnection(account, async (client) => {
      const path = await this.specialUsePath(client, use);
      const res = await client.append(path, raw, flags);
      const uid = res && typeof res === "object" ? Number(res.uid) : undefined;
      return Number.isFinite(uid) ? uid : undefined;
    });
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  return (await streamToBuffer(stream)).toString("utf8");
}
