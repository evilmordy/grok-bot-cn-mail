import { assertAttachmentAllowed } from "../sanitize/attachments.js";
import { pickBody, truncateBody } from "../sanitize/html.js";
import { applyBodyGate, assertNotBlocked, redactSearchHit } from "../sanitize/present.js";
import { messageId, wrapUntrustedEmail } from "../sanitize/untrusted.js";
import { replyTargets } from "./compose.js";
import {
  assertComposeBody,
  forwardSubject,
  generateMessageId,
  quoteOriginal,
  replySubject,
} from "./rfc822.js";
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
} from "./types.js";

export type FakeMessage = {
  uid: number;
  folder: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  subject: string;
  plain?: string;
  html?: string;
  rfcMessageId?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; contentType: string; bytes: Buffer; part: string }>;
};

export class FakeMailBackend implements MailBackend {
  readonly sent: OutboundResult[] = [];
  private nextUid = 1000;

  constructor(
    private readonly accounts: AccountInfo[],
    private readonly folders: Record<string, FolderInfo[]>,
    private readonly messages: Record<string, FakeMessage[]>,
  ) {
    for (const id of Object.keys(this.folders)) {
      const list = this.folders[id] ?? [];
      if (!list.some((f) => f.specialUse === "\\Drafts")) {
        list.push({ path: "Drafts", name: "Drafts", specialUse: "\\Drafts" });
      }
      if (!list.some((f) => f.specialUse === "\\Sent")) {
        list.push({ path: "Sent Messages", name: "Sent Messages", specialUse: "\\Sent" });
      }
      this.folders[id] = list;
      this.messages[id] ??= [];
    }
  }

  listAccounts(): AccountInfo[] {
    return this.accounts;
  }

  async listFolders(accountId: string): Promise<FolderInfo[]> {
    const list = this.folders[accountId];
    if (!list) throw new Error(`unknown account ${accountId}`);
    return list;
  }

  async search(query: SearchQuery): Promise<MessageMeta[]> {
    const msgs = this.messages[query.accountId] ?? [];
    const hit = msgs.filter((m) => {
      if (m.folder !== query.folder) return false;
      if (query.from && !m.from.includes(query.from)) return false;
      if (query.to && !m.to.includes(query.to)) return false;
      if (query.subject && !m.subject.includes(query.subject)) return false;
      if (query.since && m.date < query.since) return false;
      if (query.before && m.date >= query.before) return false;
      return true;
    });
    return hit.slice(0, query.limit).map((m) =>
      redactSearchHit(
        {
          uid: m.uid,
          folder: m.folder,
          from: m.from,
          to: m.to,
          date: m.date,
          subject: m.subject,
          snippet: (m.plain ?? "").slice(0, 180),
          hasAttachment: (m.attachments?.length ?? 0) > 0,
        },
        query.accountId,
      ),
    );
  }

  async getMessage(accountId: string, folder: string, uid: number): Promise<MessageBody> {
    const msg = (this.messages[accountId] ?? []).find((m) => m.folder === folder && m.uid === uid);
    if (!msg) throw new Error(`message ${uid} not found in ${folder}`);
    const picked = pickBody(msg.plain, msg.html);
    const { text, truncated } = truncateBody(picked);
    const attachments: AttachmentMeta[] = (msg.attachments ?? []).map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.bytes.length,
      part: a.part,
    }));
    const id = messageId(accountId, folder, uid);
    return applyBodyGate(
      {
        uid,
        folder,
        from: msg.from,
        to: msg.to,
        cc: msg.cc,
        date: msg.date,
        subject: msg.subject,
        body: text,
        truncated,
        wrapped: wrapUntrustedEmail(id, text),
        attachments,
        rfcMessageId: msg.rfcMessageId,
        replyTo: msg.replyTo,
        references: msg.rfcMessageId,
      },
      accountId,
    );
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
    const gated = await this.getMessage(accountId, folder, uid);
    if (gated.blocked) throw new Error(`refusing to download attachments on a ${gated.blockedClass} message`);
    const msg = (this.messages[accountId] ?? []).find((m) => m.folder === folder && m.uid === uid);
    const att = msg?.attachments?.find((a) => a.part === part);
    if (!att) throw new Error(`attachment part ${part} not found`);
    assertAttachmentAllowed(att.filename, att.bytes.length);
    return { filename: att.filename, contentType: att.contentType, bytes: att.bytes };
  }

  async check(): Promise<{ id: string; ok: boolean; error?: string }[]> {
    return this.accounts.map((a) => ({ id: a.id, ok: true }));
  }

  async saveDraft(input: ComposeInput): Promise<OutboundResult> {
    return this.putDraft(input.accountId, input.to, input.cc ?? [], input.subject, input.body);
  }

  async saveReplyDraft(input: ReplyInput): Promise<OutboundResult> {
    const acct = this.requireAccount(input.accountId);
    const orig = await this.getMessage(input.accountId, input.folder, input.uid);
    assertNotBlocked(orig, "reply");
    const targets = replyTargets({
      self: acct.address,
      from: orig.from,
      replyTo: orig.replyTo,
      to: orig.to,
      cc: orig.cc,
      replyAll: input.replyAll === true,
    });
    const body = `${input.body.trim()}\n\n${quoteOriginal(orig.from, orig.date, orig.body)}`;
    return this.putDraft(input.accountId, targets.to, targets.cc, replySubject(orig.subject), body);
  }

  async sendEmail(input: ComposeInput): Promise<OutboundResult> {
    return this.recordSend(input.accountId, input.to, input.cc ?? [], input.subject, input.body);
  }

  async sendReply(input: ReplyInput): Promise<OutboundResult> {
    const acct = this.requireAccount(input.accountId);
    const orig = await this.getMessage(input.accountId, input.folder, input.uid);
    assertNotBlocked(orig, "reply");
    const targets = replyTargets({
      self: acct.address,
      from: orig.from,
      replyTo: orig.replyTo,
      to: orig.to,
      cc: orig.cc,
      replyAll: input.replyAll === true,
    });
    const body = `${input.body.trim()}\n\n${quoteOriginal(orig.from, orig.date, orig.body)}`;
    return this.recordSend(input.accountId, targets.to, targets.cc, replySubject(orig.subject), body);
  }

  async sendForward(input: ForwardInput): Promise<OutboundResult> {
    const orig = await this.getMessage(input.accountId, input.folder, input.uid);
    assertNotBlocked(orig, "forward");
    const quoted = quoteOriginal(orig.from, orig.date, orig.body);
    const body = input.comment?.trim() ? `${input.comment.trim()}\n\n${quoted}` : quoted;
    return this.recordSend(
      input.accountId,
      input.to,
      input.cc ?? [],
      forwardSubject(orig.subject),
      body,
    );
  }

  async sendDraft(accountId: string, uid: number): Promise<OutboundResult> {
    const orig = await this.getMessage(accountId, "Drafts", uid);
    assertNotBlocked(orig, "send");
    const to = orig.to ? orig.to.split(/,\s*/) : [];
    if (to.length === 0) throw new Error("draft has no To header");
    return this.recordSend(accountId, to, orig.cc ? orig.cc.split(/,\s*/) : [], orig.subject || "(no subject)", orig.body);
  }

  private requireAccount(id: string): AccountInfo {
    const acct = this.accounts.find((a) => a.id === id);
    if (!acct) throw new Error(`unknown account ${id}`);
    return acct;
  }

  private putDraft(
    accountId: string,
    to: string[],
    cc: string[],
    subject: string,
    body: string,
  ): OutboundResult {
    this.requireAccount(accountId);
    assertComposeBody(body);
    const uid = this.nextUid++;
    const mid = generateMessageId("qq.com");
    (this.messages[accountId] ??= []).push({
      uid,
      folder: "Drafts",
      from: this.requireAccount(accountId).address,
      to: to.join(", "),
      cc: cc.join(", "),
      date: new Date().toISOString(),
      subject,
      plain: body,
      rfcMessageId: mid,
    });
    return { folder: "Drafts", uid, messageId: mid, to, cc, subject };
  }

  private recordSend(
    accountId: string,
    to: string[],
    cc: string[],
    subject: string,
    body: string,
  ): OutboundResult {
    this.requireAccount(accountId);
    assertComposeBody(body);
    const result: OutboundResult = {
      messageId: generateMessageId("qq.com"),
      to,
      cc,
      subject,
      sentCopied: true,
    };
    this.sent.push(result);
    return result;
  }
}
