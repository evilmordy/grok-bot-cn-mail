import type { SensitiveClass } from "../sanitize/sensitive.js";

export type AccountInfo = {
  id: string;
  address: string;
  provider: string;
  host: string;
};

export type FolderInfo = {
  path: string;
  name: string;
  specialUse?: string;
};

export type MessageMeta = {
  uid: number;
  folder: string;
  from?: string;
  to?: string;
  date?: string;
  subject?: string;
  snippet?: string;
  hasAttachment: boolean;
  blocked?: boolean;
  blockedClass?: SensitiveClass;
};

export type AttachmentMeta = {
  filename: string;
  contentType: string;
  size: number;
  part: string;
};

export type MessageBody = {
  uid: number;
  folder: string;
  from?: string;
  to?: string;
  cc?: string;
  date?: string;
  subject?: string;
  body: string;
  truncated: boolean;
  wrapped: string;
  attachments: AttachmentMeta[];
  rfcMessageId?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  blocked?: boolean;
  blockedClass?: SensitiveClass;
};

export type SearchQuery = {
  accountId: string;
  folder: string;
  from?: string;
  to?: string;
  subject?: string;
  since?: string;
  before?: string;
  unseen?: boolean;
  hasAttachment?: boolean;
  limit: number;
};

export type ComposeInput = {
  accountId: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
};

export type ReplyInput = {
  accountId: string;
  folder: string;
  uid: number;
  body: string;
  replyAll?: boolean;
};

export type ForwardInput = {
  accountId: string;
  folder: string;
  uid: number;
  to: string[];
  cc?: string[];
  comment?: string;
};

export type OutboundResult = {
  folder?: string;
  uid?: number;
  messageId: string;
  to: string[];
  cc: string[];
  subject: string;
  sentCopied?: boolean;
};

export type MailBackend = {
  listAccounts(): AccountInfo[];
  listFolders(accountId: string): Promise<FolderInfo[]>;
  search(query: SearchQuery): Promise<MessageMeta[]>;
  getMessage(accountId: string, folder: string, uid: number): Promise<MessageBody>;
  listAttachments(accountId: string, folder: string, uid: number): Promise<AttachmentMeta[]>;
  getAttachment(
    accountId: string,
    folder: string,
    uid: number,
    part: string,
  ): Promise<{ filename: string; contentType: string; bytes: Buffer }>;
  check(): Promise<{ id: string; ok: boolean; error?: string }[]>;
  saveDraft(input: ComposeInput): Promise<OutboundResult>;
  saveReplyDraft(input: ReplyInput): Promise<OutboundResult>;
  sendEmail(input: ComposeInput): Promise<OutboundResult>;
  sendReply(input: ReplyInput): Promise<OutboundResult>;
  sendForward(input: ForwardInput): Promise<OutboundResult>;
  sendDraft(accountId: string, uid: number): Promise<OutboundResult>;
};
