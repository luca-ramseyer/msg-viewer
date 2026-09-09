/**
 * A small MIME reader for formats postal-mime does not cover.
 *
 * postal-mime handles mail, but it drops Content-Location, which is exactly
 * what an MHT archive uses to tie its parts to the page. This walks the parts
 * itself and keeps every header.
 */

export interface MimePart {
  headers: Map<string, string>;
  contentType: string;
  charset: string;
  encoding: string;
  contentLocation: string;
  contentId: string;
  fileName: string;
  body: Uint8Array;
}

export function headerValue(headers: Map<string, string>, name: string): string {
  return headers.get(name.toLowerCase()) ?? "";
}

/** Pull `name="value"` or `name=value` out of a header's parameters. */
export function headerParam(header: string, name: string): string {
  const quoted = new RegExp(`;\\s*${name}\\s*=\\s*"([^"]*)"`, "i").exec(header);
  if (quoted) return quoted[1]!;

  const bare = new RegExp(`;\\s*${name}\\s*=\\s*([^;\\s]+)`, "i").exec(header);
  return bare ? bare[1]! : "";
}

const decodeLatin1 = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

/** Split a header block into names and values, unfolding continuation lines. */
export function parseHeaders(block: string): Map<string, string> {
  const headers = new Map<string, string>();
  const unfolded = block.replace(/\r?\n[ \t]+/g, " ");

  for (const line of unfolded.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;

    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    // A repeated header (Received, mostly) keeps its first value.
    if (!headers.has(name)) headers.set(name, value);
  }

  return headers;
}

function decodeQuotedPrintable(text: string): Uint8Array {
  const withoutSoftBreaks = text.replace(/=\r?\n/g, "");
  const bytes: number[] = [];

  for (let index = 0; index < withoutSoftBreaks.length; index += 1) {
    const char = withoutSoftBreaks[index]!;
    if (char === "=" && index + 2 < withoutSoftBreaks.length) {
      const hex = withoutSoftBreaks.slice(index + 1, index + 3);
      if (/^[0-9a-f]{2}$/i.test(hex)) {
        bytes.push(parseInt(hex, 16));
        index += 2;
        continue;
      }
    }
    bytes.push(char.charCodeAt(0) & 0xff);
  }

  return new Uint8Array(bytes);
}

function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/=]/g, "");
  try {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
}

function decodeBody(raw: Uint8Array, encoding: string): Uint8Array {
  switch (encoding.toLowerCase()) {
    case "base64":
      return decodeBase64(decodeLatin1(raw));
    case "quoted-printable":
      return decodeQuotedPrintable(decodeLatin1(raw));
    default:
      return raw;
  }
}

/** Decode a part's bytes to text using the charset it declared. */
export function partText(part: MimePart): string {
  try {
    return new TextDecoder(part.charset || "utf-8").decode(part.body);
  } catch {
    return decodeLatin1(part.body);
  }
}

function toPart(headerBlock: string, body: Uint8Array): MimePart {
  const headers = parseHeaders(headerBlock);
  const contentTypeHeader = headerValue(headers, "content-type");
  const disposition = headerValue(headers, "content-disposition");
  const encoding = headerValue(headers, "content-transfer-encoding") || "7bit";

  return {
    headers,
    contentType: (contentTypeHeader.split(";")[0] ?? "").trim().toLowerCase(),
    charset: headerParam(contentTypeHeader, "charset").toLowerCase(),
    encoding,
    contentLocation: headerValue(headers, "content-location"),
    contentId: headerValue(headers, "content-id"),
    fileName:
      headerParam(disposition, "filename") || headerParam(contentTypeHeader, "name"),
    body: decodeBody(body, encoding),
  };
}

/** Find the byte offset of the blank line ending a header block. */
function bodyStart(bytes: Uint8Array, from: number): number {
  for (let index = from; index + 1 < bytes.length; index += 1) {
    if (bytes[index] === 0x0a && bytes[index + 1] === 0x0a) return index + 2;
    if (
      bytes[index] === 0x0d &&
      bytes[index + 1] === 0x0a &&
      bytes[index + 2] === 0x0d &&
      bytes[index + 3] === 0x0a
    ) {
      return index + 4;
    }
  }
  return bytes.length;
}

export interface MimeDocument {
  headers: Map<string, string>;
  contentType: string;
  parts: MimePart[];
}

/**
 * Read a MIME document into its top-level headers and a flat list of parts.
 * Nested multiparts are walked, since an MHT can wrap its page in one.
 */
export function readMime(bytes: Uint8Array): MimeDocument {
  const headerEnd = bodyStart(bytes, 0);
  const headers = parseHeaders(decodeLatin1(bytes.subarray(0, headerEnd)));
  const contentTypeHeader = headerValue(headers, "content-type");
  const contentType = (contentTypeHeader.split(";")[0] ?? "").trim().toLowerCase();
  const boundary = headerParam(contentTypeHeader, "boundary");

  if (!boundary || !contentType.startsWith("multipart/")) {
    return {
      headers,
      contentType,
      parts: [toPart(decodeLatin1(bytes.subarray(0, headerEnd)), bytes.subarray(headerEnd))],
    };
  }

  return { headers, contentType, parts: splitParts(bytes.subarray(headerEnd), boundary) };
}

function splitParts(body: Uint8Array, boundary: string): MimePart[] {
  const text = decodeLatin1(body);
  const marker = `--${boundary}`;
  const parts: MimePart[] = [];

  // Latin-1 keeps one character per byte, so string offsets are byte offsets.
  const segments = text.split(new RegExp(`^${escapeRegExp(marker)}(--)?[ \t]*\r?$`, "m"));

  let offset = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === undefined) continue;

    const start = offset;
    offset += segment.length + marker.length + 1;
    // The first segment is the preamble, before any boundary.
    if (index === 0) continue;

    const segmentBytes = body.subarray(start, start + segment.length);
    if (segmentBytes.length === 0) continue;

    const partHeaderEnd = bodyStart(segmentBytes, 0);
    const part = toPart(
      decodeLatin1(segmentBytes.subarray(0, partHeaderEnd)),
      trimTrailingBreak(segmentBytes.subarray(partHeaderEnd)),
    );

    const nestedBoundary = headerParam(
      headerValue(part.headers, "content-type"),
      "boundary",
    );

    if (nestedBoundary && part.contentType.startsWith("multipart/")) {
      parts.push(...splitParts(segmentBytes.subarray(partHeaderEnd), nestedBoundary));
    } else {
      parts.push(part);
    }
  }

  return parts;
}

/** The CRLF before a boundary belongs to the boundary, not the part. */
function trimTrailingBreak(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  if (end > 0 && bytes[end - 1] === 0x0a) end -= 1;
  if (end > 0 && bytes[end - 1] === 0x0d) end -= 1;
  return bytes.subarray(0, end);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
