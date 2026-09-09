import MsgReader from "@kenjiuno/msgreader";
import type { FieldsData } from "@kenjiuno/msgreader/lib/MsgReader";

import {
  MailParseError,
  mimeTypeFor,
  normaliseContentId,
  toDate,
  type ParsedAttachment,
  type ParsedMessage,
  type Party,
} from "@/lib/mail";

function toParty(field: FieldsData): Party {
  const email = field.smtpAddress ?? field.email ?? "";
  return {
    name: field.name?.trim() ?? "",
    email: email.trim(),
  };
}

/** Parse an Outlook .msg file (a compound file with MAPI properties). */
export function parseMsg(buffer: ArrayBuffer): ParsedMessage {
  let fields: FieldsData;
  let reader: MsgReader;

  try {
    reader = new MsgReader(buffer);
    fields = reader.getFileData();
  } catch (cause) {
    throw new MailParseError(
      "This file could not be read as an Outlook message.",
      { cause },
    );
  }

  // A valid compound file that carries none of the message properties is some
  // other Office document wearing the same container format.
  const looksLikeMessage =
    fields.dataType === "msg" &&
    Boolean(
      fields.subject ??
        fields.body ??
        fields.bodyHtml ??
        fields.senderName ??
        fields.recipients?.length,
    );

  if (!looksLikeMessage) {
    throw new MailParseError(
      "This file is a compound document, but not an Outlook message.",
    );
  }

  const recipients = fields.recipients ?? [];
  const attachments: ParsedAttachment[] = [];

  (fields.attachments ?? []).forEach((attachment, index) => {
    // Embedded messages are a nested CFBF storage, not a byte stream.
    if (attachment.innerMsgContent) return;

    let content: Uint8Array;
    try {
      content = reader.getAttachment(attachment).content;
    } catch {
      return;
    }

    const fileName =
      attachment.fileName ??
      attachment.fileNameShort ??
      attachment.name ??
      `attachment-${index + 1}`;

    attachments.push({
      id: `${index}-${fileName}`,
      fileName,
      size: attachment.contentLength ?? content.length,
      mimeType: mimeTypeFor(fileName, attachment.attachMimeTag),
      contentId: normaliseContentId(attachment.pidContentId),
      hidden: attachment.attachmentHidden === true,
      bytes: content,
    });
  });

  const bodyHtml = fields.bodyHtml?.trim();
  const bodyText = fields.body?.trim();

  return {
    format: "msg",
    subject: fields.subject?.trim() ?? "",
    sender: {
      name: fields.senderName?.trim() ?? "",
      email: (fields.senderSmtpAddress ?? fields.senderEmail ?? "").trim(),
    },
    to: recipients.filter((r) => (r.recipType ?? "to") === "to").map(toParty),
    cc: recipients.filter((r) => r.recipType === "cc").map(toParty),
    bcc: recipients.filter((r) => r.recipType === "bcc").map(toParty),
    replyTo: [],
    sentAt: toDate(fields.clientSubmitTime) ?? toDate(fields.messageDeliveryTime),
    body: bodyHtml ?? bodyText ?? "",
    bodyIsHtml: Boolean(bodyHtml),
    attachments,
    headers: fields.headers?.trim() ?? "",
  };
}
