import nodemailer from "nodemailer";
import type { Account } from "../config/accounts.js";

export const MAX_SENDS_PER_PROCESS = 5;

export class SendLimiter {
  private count = 0;
  constructor(private readonly max = MAX_SENDS_PER_PROCESS) {}
  take(): void {
    if (this.count >= this.max) {
      throw new Error(`send rate limit: at most ${this.max} messages per process`);
    }
    this.count += 1;
  }
}

export type SmtpPayload = {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
};

export async function sendSmtp(account: Account, payload: SmtpPayload): Promise<void> {
  if (!account.smtpHost) {
    throw new Error(`account ${account.id} has no SMTP host; set smtpHost`);
  }
  const transport = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort || 465,
    secure: true,
    auth: { user: account.address, pass: account.authCode },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });
  try {
    await transport.sendMail({
      from: payload.from,
      to: payload.to.join(", "),
      cc: payload.cc && payload.cc.length > 0 ? payload.cc.join(", ") : undefined,
      subject: payload.subject,
      text: payload.text,
      messageId: payload.messageId,
      inReplyTo: payload.inReplyTo,
      references: payload.references,
    });
  } finally {
    transport.close();
  }
}
