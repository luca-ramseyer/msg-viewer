import { parseEml, parseEmlx, unwrapEmlx } from "@/lib/eml";
import { MailParseError, type MailFormat, type ParsedMessage } from "@/lib/mail";
import { parseMsg } from "@/lib/msg";

/** Compound File Binary header, which every Outlook .msg starts with. */
const CFBF_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** `Subject: …`, `Received: …` — a folded RFC 5322 header line. */
const HEADER_LINE = /^[A-Za-z][A-Za-z0-9-]*:[ \t]?\S/m;

/**
 * Work out which format a file is from its bytes rather than its name, so a
 * message saved with the wrong extension still opens.
 */
export function detectFormat(buffer: ArrayBuffer): MailFormat | null {
  const bytes = new Uint8Array(buffer);

  if (CFBF_MAGIC.every((byte, index) => bytes[index] === byte)) return "msg";

  // MIME is text, so decoding a prefix is enough to tell mail from a binary
  // blob.
  const text = new TextDecoder("utf-8").decode(bytes.subarray(0, 8192));

  // Apple Mail puts a byte count ahead of an otherwise ordinary message, so
  // this has to be ruled out before the headers below match it as plain MIME.
  if (/^[ \t]*\d+[ \t]*\r?\n/.test(text)) {
    const inner = unwrapEmlx(buffer);
    const innerText = inner
      ? new TextDecoder("utf-8").decode(new Uint8Array(inner).subarray(0, 8192))
      : "";
    if (HEADER_LINE.test(innerText)) return "emlx";
  }

  if (HEADER_LINE.test(text)) return "eml";

  return null;
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

/** Read a mail file of either supported format. Throws MailParseError. */
export async function openMail(file: File): Promise<ParsedMessage> {
  if (file.size === 0) {
    throw new MailParseError("This file is empty.");
  }

  const buffer = await readAsArrayBuffer(file);
  const format = detectFormat(buffer);

  if (format === "msg") return parseMsg(buffer);
  if (format === "eml") return parseEml(buffer);
  if (format === "emlx") return parseEmlx(buffer);

  throw new MailParseError(
    "This does not look like a mail file. Drop an Outlook .msg, a MIME .eml or an Apple Mail .emlx.",
  );
}
