import sanitizeHtml from "sanitize-html";

/** The mail container formats this app can read. */
export type MailFormat = "msg" | "eml" | "emlx" | "mbox" | "mht" | "tnef";

export const FORMAT_LABELS: Record<MailFormat, string> = {
  msg: "Outlook .msg",
  eml: "MIME .eml",
  emlx: "Apple Mail .emlx",
  mbox: "mbox archive",
  mht: "MHT web archive",
  tnef: "Outlook TNEF (winmail.dat)",
};

/** How deep a message inside a message inside a message may go. */
export const MAX_NESTING_DEPTH = 5;

export interface Party {
  name: string;
  email: string;
}

export interface ParsedAttachment {
  id: string;
  fileName: string;
  size: number;
  mimeType: string;
  contentId: string | null;
  /** The format's own flag for files a mail client does not list. */
  hidden: boolean;
  bytes: Uint8Array;
  /** The message this attachment carries, when it carries one. */
  message: ParsedMessage | null;
}

export interface ParsedMessage {
  format: MailFormat;
  subject: string;
  sender: Party;
  to: Party[];
  cc: Party[];
  bcc: Party[];
  replyTo: Party[];
  sentAt: Date | null;
  /** Raw body as it came out of the file. Never render this directly. */
  body: string;
  bodyIsHtml: boolean;
  attachments: ParsedAttachment[];
  /** Raw transport headers, when the file carries them. */
  headers: string;
}

/** Enough of a message to list it, without decoding its body or attachments. */
export interface MailSummary {
  subject: string;
  sender: Party;
  sentAt: Date | null;
}

/**
 * A file holds one message, or thousands in the case of an archive. Listing is
 * cheap and opening is not, so an archive is summarised up front and each
 * message is parsed only when it is asked for.
 */
export interface ParsedMailFile {
  format: MailFormat;
  entries: MailSummary[];
  open: (index: number) => Promise<ParsedMessage>;
}

/** Wrap an already-parsed message as a one-entry file. */
export function singleMessageFile(
  format: MailFormat,
  message: ParsedMessage,
): ParsedMailFile {
  return {
    format,
    entries: [summarise(message)],
    open: () => Promise.resolve(message),
  };
}

export function summarise(message: ParsedMessage): MailSummary {
  return {
    subject: message.subject,
    sender: message.sender,
    sentAt: message.sentAt,
  };
}

/**
 * Parses a message found inside another message. The dispatcher supplies it,
 * so a parser can open nested mail of any format without importing its
 * siblings and creating a cycle.
 */
export type NestedParser = (
  bytes: Uint8Array,
  depth: number,
) => Promise<ParsedMessage | null>;

export interface ParseContext {
  /** How many messages deep this one sits. Top level is 0. */
  depth: number;
  parseNested?: NestedParser;
}

const MESSAGE_MIME_TYPES = new Set([
  "message/rfc822",
  "application/vnd.ms-outlook",
  "application/ms-tnef",
  "application/vnd.ms-tnef",
]);

const MESSAGE_EXTENSIONS = /\.(msg|eml|emlx|mht|mhtml)$/i;

/**
 * Whether an attachment is worth trying to open as a message. Sniffing every
 * attachment would turn any text file with a colon in it into a mail.
 */
export function looksLikeMessageAttachment(
  fileName: string,
  mimeType: string,
): boolean {
  return (
    MESSAGE_MIME_TYPES.has(mimeType.toLowerCase()) ||
    MESSAGE_EXTENSIONS.test(fileName) ||
    fileName.toLowerCase() === "winmail.dat"
  );
}

export class MailParseError extends Error {}

const MIME_BY_EXTENSION: Record<string, string> = {
  bmp: "image/bmp",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  eml: "message/rfc822",
  gif: "image/gif",
  htm: "text/html",
  html: "text/html",
  ics: "text/calendar",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  msg: "application/vnd.ms-outlook",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  svg: "image/svg+xml",
  txt: "text/plain",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml",
  zip: "application/zip",
};

export function mimeTypeFor(fileName: string, declared?: string): string {
  if (declared && declared !== "application/octet-stream") return declared;
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

/** A date string that will not parse must not take the whole message down. */
export function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normaliseContentId(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/^<|>$/g, "").trim() || null;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!);
}

/** Turn a plain-text body into paragraphs, with bare URLs made clickable. */
function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => {
      const escaped = escapeHtml(block.trim()).replace(/\n/g, "<br />");
      const linked = escaped.replace(
        /(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g,
        '<a href="$1">$1</a>',
      );
      return `<p>${linked}</p>`;
    })
    .filter((block) => block !== "<p></p>")
    .join("");
}

export interface RenderedBody {
  html: string;
  /** Images pointing at a remote server, which we do not fetch by default. */
  blockedRemoteImages: number;
  /** Content-ids the body embedded, so the list can skip them as files. */
  embeddedContentIds: Set<string>;
}

export interface RenderBodyOptions {
  /** Maps a content-id to a local object URL, for images the file carries itself. */
  inlineImages?: Record<string, string>;
  allowRemoteImages?: boolean;
}

/**
 * Sanitise a message body for display.
 *
 * Message HTML is attacker-controlled: anyone can send you a mail file.
 * Everything that executes or phones home is dropped, and remote images stay
 * blocked until asked for, so opening a file sends no request anywhere.
 */
export function renderBody(
  message: ParsedMessage,
  options: RenderBodyOptions = {},
): RenderedBody {
  const { inlineImages = {}, allowRemoteImages = false } = options;
  const source = message.bodyIsHtml ? message.body : textToHtml(message.body);
  let blockedRemoteImages = 0;
  const embeddedContentIds = new Set<string>();

  const html = sanitizeHtml(source, {
    allowedTags: [
      "a", "b", "blockquote", "br", "caption", "center", "code", "col",
      "colgroup", "dd", "div", "dl", "dt", "em", "figure", "figcaption", "h1",
      "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre",
      "s", "small", "span", "strike", "strong", "sub", "sup", "table", "tbody",
      "td", "tfoot", "th", "thead", "tr", "u", "ul",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan", "align", "valign"],
      th: ["colspan", "rowspan", "align", "valign"],
      "*": ["style", "align"],
    },
    // Anything that is not http(s), mailto or a local blob is dropped, which
    // rules out javascript: and data: payloads.
    allowedSchemes: ["http", "https", "mailto", "tel", "blob"],
    allowedSchemesByTag: { img: ["http", "https", "blob", "cid"] },
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        color: [/^[^;{}()]+$/],
        "background-color": [/^[^;{}()]+$/],
        "text-align": [/^(left|right|center|justify)$/],
        "text-decoration": [/^[a-z- ]+$/],
        "font-weight": [/^(normal|bold|lighter|bolder|[1-9]00)$/],
        "font-style": [/^(normal|italic|oblique)$/],
      },
    },
    transformTags: {
      // Links open away from the app, with no window.opener handle back.
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";

        if (src.toLowerCase().startsWith("cid:")) {
          const contentId = normaliseContentId(src.slice(4)) ?? "";
          const resolved = inlineImages[contentId];
          if (resolved) {
            embeddedContentIds.add(contentId);
            return { tagName, attribs: { ...attribs, src: resolved } };
          }
          return { tagName: "span", attribs: {} };
        }

        if (/^https?:/i.test(src)) {
          if (allowRemoteImages) return { tagName, attribs };
          blockedRemoteImages += 1;
          return { tagName: "span", attribs: {} };
        }

        if (src.startsWith("blob:")) return { tagName, attribs };

        return { tagName: "span", attribs: {} };
      },
    },
  });

  return { html, blockedRemoteImages, embeddedContentIds };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function initialsOf(party: Party): string {
  const source = party.name || party.email;
  const parts = source.replace(/[<>@].*$/, "").trim().split(/[\s._-]+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function displayName(party: Party): string {
  return party.name || party.email || "Unknown sender";
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}
