import { parseEml, parseEmlx, unwrapEmlx } from "@/lib/eml";
import {
  MAX_NESTING_DEPTH,
  MailParseError,
  singleMessageFile,
  type MailFormat,
  type ParseContext,
  type ParsedMailFile,
  type ParsedMessage,
} from "@/lib/mail";
import { parseMbox } from "@/lib/mbox";
import { parseMht } from "@/lib/mht";
import { parseMsg } from "@/lib/msg";
import { parseTnef } from "@/lib/tnef";

/** Compound File Binary header, which every Outlook .msg starts with. */
const CFBF_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** TNEF signature 0x223E9F78, little-endian. */
const TNEF_MAGIC = [0x78, 0x9f, 0x3e, 0x22];

/** `Subject: …`, `Received: …` — a folded RFC 5322 header line. */
const HEADER_LINE = /^[A-Za-z][A-Za-z0-9-]*:[ \t]?\S/m;

/** An mbox begins with its first separator line. */
const MBOX_START = /^From (?:[^\s]*\s)?.*(\r?\n)/;

const startsWith = (bytes: Uint8Array, magic: number[]) =>
  magic.every((byte, index) => bytes[index] === byte);

const textPrefix = (bytes: Uint8Array) =>
  new TextDecoder("utf-8").decode(bytes.subarray(0, 8192));

/**
 * Work out which format a file is from its bytes rather than its name, so a
 * message saved with the wrong extension still opens.
 */
export function detectFormat(buffer: ArrayBuffer): MailFormat | null {
  const bytes = new Uint8Array(buffer);

  if (startsWith(bytes, CFBF_MAGIC)) return "msg";
  if (startsWith(bytes, TNEF_MAGIC)) return "tnef";

  // The rest are text. Decoding a prefix is enough to tell them apart from a
  // binary blob and from each other.
  const text = textPrefix(bytes);

  if (MBOX_START.test(text)) return "mbox";

  // Apple Mail puts a byte count ahead of an otherwise ordinary message, so
  // this has to be ruled out before the headers below match it as plain MIME.
  if (/^[ \t]*\d+[ \t]*\r?\n/.test(text)) {
    const inner = unwrapEmlx(buffer);
    if (inner && HEADER_LINE.test(textPrefix(new Uint8Array(inner)))) return "emlx";
  }

  if (HEADER_LINE.test(text)) {
    // An MHT is MIME too, and only its content type says otherwise.
    return /content-type:\s*multipart\/related/i.test(text) &&
      /content-location:|^\s*mime-version:.*\r?\n\s*content-type:\s*multipart\/related/im.test(
        text,
      )
      ? "mht"
      : "eml";
  }

  return null;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/**
 * Open a message found inside another message. Anything that is not readable
 * mail comes back as null, because a failed nested parse is just an
 * attachment, not an error for the file as a whole.
 */
async function parseNested(
  bytes: Uint8Array,
  depth: number,
): Promise<ParsedMessage | null> {
  if (depth > MAX_NESTING_DEPTH) return null;

  const buffer = toArrayBuffer(bytes);
  const context: ParseContext = { depth, parseNested };

  try {
    switch (detectFormat(buffer)) {
      case "msg":
        return await parseMsg(buffer, context);
      case "eml":
        return await parseEml(buffer, "eml", context);
      case "emlx":
        return await parseEmlx(buffer, context);
      case "mht":
        return parseMht(buffer, context);
      case "tnef":
        return await parseTnef(buffer, context);
      // An archive inside a message is a file, not a message to show in place.
      default:
        return null;
    }
  } catch {
    return null;
  }
}

const readAsArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new MailParseError("The file could not be read."));
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(result);
      else reject(new MailParseError("The file could not be read."));
    };
    reader.readAsArrayBuffer(file);
  });

/** Read a mail file of any supported format. Throws MailParseError. */
export async function openMail(file: File): Promise<ParsedMailFile> {
  if (file.size === 0) throw new MailParseError("This file is empty.");

  const buffer = await readAsArrayBuffer(file);
  const format = detectFormat(buffer);
  const context: ParseContext = { depth: 0, parseNested };

  switch (format) {
    case "msg":
      return singleMessageFile(format, await parseMsg(buffer, context));
    case "eml":
      return singleMessageFile(format, await parseEml(buffer, "eml", context));
    case "emlx":
      return singleMessageFile(format, await parseEmlx(buffer, context));
    case "mht":
      return singleMessageFile(format, parseMht(buffer, context));
    case "tnef":
      return singleMessageFile(format, await parseTnef(buffer, context));
    case "mbox":
      return parseMbox(buffer, context);
    default:
      throw new MailParseError(
        "This does not look like a mail file. Drop a .msg, .eml, .emlx, .mbox, .mht or a winmail.dat.",
      );
  }
}
