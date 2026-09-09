import {
  MailParseError,
  mimeTypeFor,
  toDate,
  type ParseContext,
  type ParsedAttachment,
  type ParsedMessage,
} from "@/lib/mail";
import { headerValue, partText, readMime, type MimePart } from "@/lib/mime";

/**
 * MHT is a web page saved as MIME: one HTML part plus the images and
 * stylesheets it references. Parts are tied to the page by Content-Location
 * rather than by content-id, which is the one thing a mail parser does not
 * carry, so this reads the parts directly.
 */
export function parseMht(
  buffer: ArrayBuffer,
  _context: ParseContext = { depth: 0 },
): ParsedMessage {
  const document = readMime(new Uint8Array(buffer));
  const root = document.parts.find((part) => part.contentType === "text/html");

  if (!root) {
    throw new MailParseError("This archive has no HTML page inside it.");
  }

  const resources = document.parts.filter((part) => part !== root);
  const attachments: ParsedAttachment[] = [];
  let html = partText(root);

  resources.forEach((part, index) => {
    // Give each resource a content-id and point the page at it, so the same
    // machinery that resolves inline mail images resolves these.
    const contentId = `mht-resource-${index}`;
    const fileName = fileNameFor(part, index);

    if (part.contentLocation) {
      html = replaceAll(html, part.contentLocation, `cid:${contentId}`);
    }

    attachments.push({
      id: `${index}-${fileName}`,
      fileName,
      size: part.body.byteLength,
      mimeType: mimeTypeFor(fileName, part.contentType),
      contentId,
      // These are page furniture, not things the author attached.
      hidden: true,
      bytes: part.body,
      message: null,
    });
  });

  const headers = document.headers;

  return {
    format: "mht",
    subject: headerValue(headers, "subject").trim(),
    sender: { name: "", email: headerValue(headers, "from").trim() },
    to: [],
    cc: [],
    bcc: [],
    replyTo: [],
    sentAt: toDate(headerValue(headers, "date")),
    body: html,
    bodyIsHtml: true,
    attachments,
    headers: headerLines(headers),
  };
}

function fileNameFor(part: MimePart, index: number): string {
  if (part.fileName) return part.fileName;

  const fromLocation = part.contentLocation.split(/[?#]/)[0]?.split("/").pop();
  if (fromLocation) return decodeURIComponent(fromLocation);

  return `resource-${index + 1}`;
}

function headerLines(headers: Map<string, string>): string {
  return [...headers]
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n")
    .trim();
}

function replaceAll(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  return haystack.split(needle).join(replacement);
}
