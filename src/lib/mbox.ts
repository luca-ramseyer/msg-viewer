import { addressParser, decodeWords } from "postal-mime";

import { parseEml, toParties } from "@/lib/eml";
import {
  MailParseError,
  toDate,
  type MailSummary,
  type ParseContext,
  type ParsedMailFile,
  type ParsedMessage,
} from "@/lib/mail";
import { headerValue, parseHeaders } from "@/lib/mime";

/** The header line that must follow a separator for it to be a real one. */
const HEADER_LINE = /^[A-Za-z][A-Za-z0-9-]*:/;

const decodeLatin1 = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

interface Chunk {
  start: number;
  end: number;
}

/**
 * Find each message in an mbox without decoding any of them. Latin-1 keeps one
 * character per byte, so offsets into the decoded text are byte offsets.
 */
export function splitMbox(bytes: Uint8Array): Chunk[] {
  const text = decodeLatin1(bytes);
  const starts: number[] = [];

  let lineStart = 0;
  while (lineStart < text.length) {
    let lineEnd = text.indexOf("\n", lineStart);
    if (lineEnd === -1) lineEnd = text.length;

    // A real separator is followed straight away by the message's headers.
    // Prose beginning "From " is common in bodies that were never escaped,
    // and splitting on it would invent an empty message.
    if (text.startsWith("From ", lineStart)) {
      const nextEnd = text.indexOf("\n", lineEnd + 1);
      const next = text
        .slice(lineEnd + 1, nextEnd === -1 ? text.length : nextEnd)
        .replace(/\r$/, "");
      if (HEADER_LINE.test(next)) starts.push(lineStart);
    }

    lineStart = lineEnd + 1;
  }

  return starts.map((start, index) => {
    // Skip the separator line itself; the headers begin on the next one.
    const afterSeparator = text.indexOf("\n", start);
    return {
      start: afterSeparator === -1 ? start : afterSeparator + 1,
      end: starts[index + 1] ?? bytes.length,
    };
  });
}

/**
 * Undo the `>From ` escaping mbox applies to body lines that would otherwise
 * look like a separator. mboxrd escapes any run of `>` before `From `.
 */
function unescapeBody(bytes: Uint8Array): Uint8Array {
  const text = decodeLatin1(bytes);
  if (!text.includes(">From ")) return bytes;

  const unescaped = text.replace(/^>(>*From )/gm, "$1");
  const out = new Uint8Array(unescaped.length);
  for (let index = 0; index < unescaped.length; index += 1) {
    out[index] = unescaped.charCodeAt(index) & 0xff;
  }
  return out;
}

/** Read just the header block, which is all a list entry needs. */
function summariseRfc822(bytes: Uint8Array): MailSummary {
  const text = decodeLatin1(bytes.subarray(0, 16384));
  const headerEnd = text.search(/\r?\n\r?\n/);
  const headers = parseHeaders(headerEnd === -1 ? text : text.slice(0, headerEnd));

  const from = headerValue(headers, "from");
  const [sender] = toParties(from ? addressParser(from) : []);

  return {
    subject: decodeWords(headerValue(headers, "subject")).trim(),
    sender: sender ?? { name: "", email: "" },
    sentAt: toDate(headerValue(headers, "date")),
  };
}

/** Read a Unix mbox archive: many messages, concatenated. */
export function parseMbox(
  buffer: ArrayBuffer,
  context: ParseContext = { depth: 0 },
): ParsedMailFile {
  const bytes = new Uint8Array(buffer);
  const chunks = splitMbox(bytes);

  if (chunks.length === 0) {
    throw new MailParseError(
      "This file has no mbox separator lines, so it holds no messages.",
    );
  }

  const messages = chunks.map((chunk) =>
    unescapeBody(bytes.subarray(chunk.start, chunk.end)),
  );
  const cache = new Map<number, Promise<ParsedMessage>>();

  return {
    format: "mbox",
    entries: messages.map(summariseRfc822),
    open: (index) => {
      const message = messages[index];
      if (!message) {
        return Promise.reject(new MailParseError("That message is not in this archive."));
      }

      const cached = cache.get(index);
      if (cached) return cached;

      const parsed = parseEml(
        message.buffer.slice(
          message.byteOffset,
          message.byteOffset + message.byteLength,
        ),
        "eml",
        context,
      );
      cache.set(index, parsed);
      return parsed;
    },
  };
}
