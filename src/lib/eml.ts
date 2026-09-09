import PostalMime, { type Address, type Email } from "postal-mime";

import {
  MailParseError,
  mimeTypeFor,
  normaliseContentId,
  toDate,
  type MailFormat,
  type ParsedAttachment,
  type ParsedMessage,
  type Party,
} from "@/lib/mail";

/** A header address can be a group, which has to be flattened into mailboxes. */
function toParties(addresses: Address[] | undefined): Party[] {
  if (!addresses) return [];

  return addresses.flatMap((address) => {
    if (address.group) return toParties(address.group);
    return [{ name: address.name?.trim() ?? "", email: address.address?.trim() ?? "" }];
  });
}

function toContent(content: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof content === "string") return new TextEncoder().encode(content);
  if (content instanceof Uint8Array) return content;
  return new Uint8Array(content);
}

/** The full header block, which postal-mime hands back line by line. */
function headerBlock(email: Email): string {
  return email.headerLines.map((header) => header.line).join("\n").trim();
}

/** Parse an .eml file (RFC 5322 / MIME). */
export async function parseEml(
  buffer: ArrayBuffer,
  format: MailFormat = "eml",
): Promise<ParsedMessage> {
  let email: Email;

  try {
    email = await PostalMime.parse(buffer, { attachmentEncoding: "arraybuffer" });
  } catch (cause) {
    throw new MailParseError("This file could not be read as a MIME message.", {
      cause,
    });
  }

  // Anything can be decoded as text, so look for the shape of a mail before
  // claiming we parsed one.
  const looksLikeMessage = Boolean(
    email.from ??
      email.subject ??
      email.date ??
      email.to?.length ??
      email.html ??
      email.text,
  );

  if (!looksLikeMessage) {
    throw new MailParseError(
      "This file has no mail headers or body. Save the message as .eml and try again.",
    );
  }

  const attachments: ParsedAttachment[] = email.attachments.map(
    (attachment, index): ParsedAttachment => {
      const bytes = toContent(attachment.content);
      const fileName = attachment.filename?.trim() ?? `attachment-${index + 1}`;

      return {
        id: `${index}-${fileName}`,
        fileName,
        size: bytes.byteLength,
        mimeType: mimeTypeFor(fileName, attachment.mimeType),
        contentId: normaliseContentId(attachment.contentId),
        // `related` marks a part the body pulls in rather than one the sender
        // attached, so it does not belong in the attachment list on its own.
        hidden: attachment.disposition === "inline" && attachment.related === true,
        bytes,
      };
    },
  );

  const html = email.html?.trim();
  const text = email.text?.trim();
  const [sender] = toParties(email.from ? [email.from] : undefined);

  return {
    format,
    subject: email.subject?.trim() ?? "",
    sender: sender ?? { name: "", email: "" },
    to: toParties(email.to),
    cc: toParties(email.cc),
    bcc: toParties(email.bcc),
    replyTo: toParties(email.replyTo),
    sentAt: toDate(email.date),
    body: html ?? text ?? "",
    bodyIsHtml: Boolean(html),
    attachments,
    headers: headerBlock(email),
  };
}

/**
 * Apple Mail's .emlx wraps a plain RFC 5322 message: a line holding the
 * message's byte length, the message itself, then an Apple plist of flags.
 * Trim it back to the message and it is ordinary MIME.
 */
export function unwrapEmlx(buffer: ArrayBuffer): ArrayBuffer | null {
  const bytes = new Uint8Array(buffer);
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 64));
  const match = /^[ \t]*(\d+)[ \t]*\r?\n/.exec(head);

  if (!match) return null;

  const start = match[0].length;
  const length = Number(match[1]);

  // A length running past the file means this is not an emlx after all.
  if (!Number.isSafeInteger(length) || start + length > bytes.byteLength) return null;

  return buffer.slice(start, start + length);
}

/** Parse an Apple Mail .emlx file. */
export async function parseEmlx(buffer: ArrayBuffer): Promise<ParsedMessage> {
  const inner = unwrapEmlx(buffer);

  if (!inner) {
    throw new MailParseError("This file is not a readable Apple Mail message.");
  }

  return parseEml(inner, "emlx");
}
