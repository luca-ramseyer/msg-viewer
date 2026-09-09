import {
  MailParseError,
  looksLikeMessageAttachment,
  mimeTypeFor,
  normaliseContentId,
  type ParseContext,
  type ParsedAttachment,
  type ParsedMessage,
} from "@/lib/mail";

/**
 * A reader for TNEF, the format behind the winmail.dat that arrives when
 * Outlook sends rich content to a client that cannot read it. The body and the
 * real attachments are inside; this pulls them back out.
 *
 * Layout per [MS-OXTNEF]: a signature and key, then a run of attributes. Each
 * attribute is a level byte, a 4-byte id, a 4-byte length, the data, and a
 * checksum. Attributes at level 1 describe the message, level 2 the attachment
 * most recently started.
 */

const TNEF_SIGNATURE = 0x223e9f78;

// Attribute ids, low 16 bits of the 4-byte attribute.
const ATT_SUBJECT = 0x8004;
const ATT_BODY = 0x800c;
const ATT_DATE_SENT = 0x8005;
const ATT_FROM = 0x8000;
const ATT_MAPI_PROPS = 0x9003;
const ATT_ATTACH_DATA = 0x800f;
const ATT_ATTACH_TITLE = 0x8010;
const ATT_ATTACH_META = 0x9005;
const ATT_ATTACH_REND = 0x9002;

// MAPI property ids we care about.
const PID_SUBJECT = 0x0037;
const PID_BODY = 0x1000;
const PID_BODY_HTML = 0x1013;
const PID_SENDER_NAME = 0x0c1a;
const PID_SENDER_EMAIL = 0x0c1f;
const PID_SENDER_SMTP = 0x5d01;
const PID_ATTACH_LONG_FILENAME = 0x3707;
const PID_ATTACH_FILENAME = 0x3704;
const PID_ATTACH_MIME_TAG = 0x370e;
const PID_ATTACH_CONTENT_ID = 0x3712;

// MAPI property types.
const PT_STRING8 = 0x001e;
const PT_UNICODE = 0x001f;
const PT_BINARY = 0x0102;
const PT_OBJECT = 0x000d;
const PT_MULTI = 0x1000;

class Cursor {
  constructor(
    readonly view: DataView,
    readonly bytes: Uint8Array,
    public offset = 0,
  ) {}

  get remaining(): number {
    return this.bytes.byteLength - this.offset;
  }

  u8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  u16(): number {
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  u32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  take(length: number): Uint8Array {
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }
}

const decodeAnsi = (bytes: Uint8Array) =>
  new TextDecoder("windows-1252").decode(bytes).replace(/\0+$/, "");

const decodeUnicode = (bytes: Uint8Array) =>
  new TextDecoder("utf-16le").decode(bytes).replace(/\0+$/, "");

interface MapiProps {
  strings: Map<number, string>;
  binaries: Map<number, Uint8Array>;
}

/** Read the MAPI property stream that TNEF embeds inside an attribute. */
function readMapiProps(bytes: Uint8Array): MapiProps {
  const strings = new Map<number, string>();
  const binaries = new Map<number, Uint8Array>();

  if (bytes.byteLength < 4) return { strings, binaries };

  const cursor = new Cursor(
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    bytes,
  );

  const count = cursor.u32();

  for (let index = 0; index < count && cursor.remaining >= 4; index += 1) {
    const tag = cursor.u32();
    const type = tag & 0xffff;
    const id = tag >>> 16;

    // A named property carries a GUID and either an id or a name first.
    if (id >= 0x8000) {
      if (cursor.remaining < 20) break;
      cursor.take(16);
      const kind = cursor.u32();
      if (kind === 1) {
        if (cursor.remaining < 4) break;
        const nameLength = cursor.u32();
        cursor.take(pad4(nameLength));
      } else {
        if (cursor.remaining < 4) break;
        cursor.u32();
      }
    }

    const isMulti = (type & PT_MULTI) !== 0;
    const baseType = type & ~PT_MULTI;

    if (
      baseType === PT_STRING8 ||
      baseType === PT_UNICODE ||
      baseType === PT_BINARY ||
      baseType === PT_OBJECT
    ) {
      if (cursor.remaining < 4) break;
      const values = cursor.u32();

      for (let value = 0; value < values && cursor.remaining >= 4; value += 1) {
        const length = cursor.u32();
        if (length > cursor.remaining) return { strings, binaries };
        const data = cursor.take(length);
        cursor.take(Math.min(pad4(length) - length, cursor.remaining));

        // Only the first value of a multi-valued property is kept.
        if (value > 0) continue;

        if (baseType === PT_UNICODE) strings.set(id, decodeUnicode(data));
        else if (baseType === PT_STRING8) strings.set(id, decodeAnsi(data));
        else binaries.set(id, data);
      }
      continue;
    }

    // Fixed-width types. Their values are not needed, only their size.
    const width = fixedWidth(baseType);
    if (width === null) return { strings, binaries };
    const slots = isMulti && cursor.remaining >= 4 ? cursor.u32() : 1;
    const total = width * slots;
    if (total > cursor.remaining) return { strings, binaries };
    cursor.take(total);
  }

  return { strings, binaries };
}

function pad4(length: number): number {
  return length + ((4 - (length % 4)) % 4);
}

function fixedWidth(type: number): number | null {
  switch (type) {
    case 0x0002: // int16, padded
    case 0x0003: // int32
    case 0x0004: // float32
    case 0x000a: // error
    case 0x000b: // boolean, padded
      return 4;
    case 0x0005: // float64
    case 0x0006: // currency
    case 0x0007: // apptime
    case 0x0014: // int64
    case 0x0040: // time
      return 8;
    case 0x0048: // guid
      return 16;
    default:
      return null;
  }
}

interface RawAttachment {
  data: Uint8Array | null;
  title: string;
  props: MapiProps | null;
}

/** Read a winmail.dat / TNEF stream. */
export async function parseTnef(
  buffer: ArrayBuffer,
  context: ParseContext = { depth: 0 },
): Promise<ParsedMessage> {
  const bytes = new Uint8Array(buffer);

  if (bytes.byteLength < 6) {
    throw new MailParseError("This file is too short to be a TNEF stream.");
  }

  const cursor = new Cursor(
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    bytes,
  );

  if (cursor.u32() !== TNEF_SIGNATURE) {
    throw new MailParseError("This file is not a TNEF stream.");
  }
  cursor.u16(); // attachment key, not needed to read the content

  let subject = "";
  let bodyText = "";
  let bodyHtml = "";
  let senderName = "";
  let senderEmail = "";
  let sentAt: Date | null = null;

  const rawAttachments: RawAttachment[] = [];
  let current: RawAttachment | null = null;

  while (cursor.remaining >= 9) {
    const level = cursor.u8();
    const attribute = cursor.u32();
    const length = cursor.u32();

    if (length > cursor.remaining) break;

    const data = cursor.take(length);
    cursor.u16(); // checksum, which we do not enforce

    const id = attribute & 0xffff;

    if (level === 1) {
      switch (id) {
        case ATT_SUBJECT:
          subject ||= decodeAnsi(data).trim();
          break;
        case ATT_BODY:
          bodyText ||= decodeAnsi(data);
          break;
        case ATT_FROM:
          senderName ||= readTriples(data);
          break;
        case ATT_DATE_SENT:
          sentAt ??= readTnefDate(data);
          break;
        case ATT_MAPI_PROPS: {
          const props = readMapiProps(data);
          subject ||= props.strings.get(PID_SUBJECT)?.trim() ?? "";
          bodyText ||= props.strings.get(PID_BODY) ?? "";
          senderName ||= props.strings.get(PID_SENDER_NAME)?.trim() ?? "";
          senderEmail ||=
            props.strings.get(PID_SENDER_SMTP)?.trim() ??
            props.strings.get(PID_SENDER_EMAIL)?.trim() ??
            "";

          const html =
            props.strings.get(PID_BODY_HTML) ??
            (props.binaries.has(PID_BODY_HTML)
              ? decodeAnsi(props.binaries.get(PID_BODY_HTML)!)
              : "");
          bodyHtml ||= html;
          break;
        }
      }
      continue;
    }

    if (level !== 2) continue;

    // A rend-data attribute starts each attachment, so anything after it
    // belongs to that one.
    if (id === ATT_ATTACH_REND) {
      current = { data: null, title: "", props: null };
      rawAttachments.push(current);
      continue;
    }

    if (!current) {
      current = { data: null, title: "", props: null };
      rawAttachments.push(current);
    }

    if (id === ATT_ATTACH_DATA) current.data = data;
    else if (id === ATT_ATTACH_TITLE) current.title = decodeAnsi(data).trim();
    else if (id === ATT_ATTACH_META) current.props = readMapiProps(data);
  }

  const attachments: ParsedAttachment[] = [];

  for (const [index, raw] of rawAttachments.entries()) {
    if (!raw.data) continue;

    const props = raw.props;
    const fileName =
      props?.strings.get(PID_ATTACH_LONG_FILENAME)?.trim() ??
      props?.strings.get(PID_ATTACH_FILENAME)?.trim() ??
      raw.title ??
      `attachment-${index + 1}`;

    const mimeType = mimeTypeFor(
      fileName,
      props?.strings.get(PID_ATTACH_MIME_TAG)?.trim(),
    );
    const contentId = normaliseContentId(props?.strings.get(PID_ATTACH_CONTENT_ID));

    attachments.push({
      id: `${index}-${fileName}`,
      fileName,
      size: raw.data.byteLength,
      mimeType,
      contentId,
      hidden: false,
      bytes: raw.data,
      message: looksLikeMessageAttachment(fileName, mimeType)
        ? ((await context.parseNested?.(raw.data, context.depth + 1)) ?? null)
        : null,
    });
  }

  const html = bodyHtml.trim();
  const text = bodyText.trim();

  if (!html && !text && attachments.length === 0) {
    throw new MailParseError(
      "This TNEF stream holds no body and no attachments that can be read.",
    );
  }

  return {
    format: "tnef",
    subject,
    sender: { name: senderName, email: senderEmail },
    to: [],
    cc: [],
    bcc: [],
    replyTo: [],
    sentAt,
    body: html || text,
    bodyIsHtml: Boolean(html),
    attachments,
    headers: "",
  };
}

/** attFrom holds a triples structure whose display name is the useful part. */
function readTriples(data: Uint8Array): string {
  const text = decodeAnsi(data);
  const parts = text.split("\0").filter(Boolean);
  return parts[0]?.trim() ?? "";
}

/** A TNEF date is seven 16-bit fields: year, month, day, hour, minute, second, weekday. */
function readTnefDate(data: Uint8Array): Date | null {
  if (data.byteLength < 12) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const date = new Date(
    Date.UTC(
      view.getUint16(0, true),
      view.getUint16(2, true) - 1,
      view.getUint16(4, true),
      view.getUint16(6, true),
      view.getUint16(8, true),
      view.getUint16(10, true),
    ),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}
