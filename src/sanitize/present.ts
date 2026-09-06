import { logInfo } from "../log.js";
import type { MessageBody, MessageMeta } from "../mail/types.js";
import { classifyBody, classifyEnvelope, redactedLabel, type SensitiveClass } from "./sensitive.js";

export function redactSearchHit(meta: MessageMeta, accountId: string): MessageMeta {
  const cls = classifyEnvelope(meta.from, meta.subject);
  if (!cls) return meta;
  logInfo("mail.blocked", { accountId, uid: meta.uid, class: cls, stage: "search" });
  return {
    ...meta,
    subject: redactedLabel(cls),
    snippet: undefined,
    blocked: true,
    blockedClass: cls,
  };
}

export function blockedStub(
  uid: number,
  folder: string,
  from: string | undefined,
  date: string | undefined,
  cls: SensitiveClass,
): MessageBody {
  return {
    uid,
    folder,
    from,
    date,
    subject: redactedLabel(cls),
    body: "",
    truncated: false,
    wrapped: "",
    attachments: [],
    blocked: true,
    blockedClass: cls,
  };
}

export function applyBodyGate(msg: MessageBody, accountId: string): MessageBody {
  const envCls = classifyEnvelope(msg.from, msg.subject);
  if (envCls) {
    logInfo("mail.blocked", { accountId, uid: msg.uid, class: envCls, stage: "envelope" });
    return blockedStub(msg.uid, msg.folder, msg.from, msg.date, envCls);
  }
  const bodyCls = classifyBody(msg.body);
  if (bodyCls) {
    logInfo("mail.blocked", { accountId, uid: msg.uid, class: bodyCls, stage: "body" });
    return blockedStub(msg.uid, msg.folder, msg.from, msg.date, bodyCls);
  }
  return msg;
}

export function assertNotBlocked(msg: MessageBody, action: string): void {
  if (msg.blocked) {
    throw new Error(`refusing to ${action} a ${msg.blockedClass ?? "sensitive"} message`);
  }
}
