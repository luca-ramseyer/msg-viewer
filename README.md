# mail-viewer

Preview a saved mail in the browser. Drop a file in and you get the subject,
the people on it, the headers, the body and the attachments.

The file is parsed by JavaScript in the page. Nothing is uploaded, and there is
no server-side storage to clear afterwards.

## Formats

| Extension | Format | Read by |
| --- | --- | --- |
| `.msg` | Outlook compound file with MAPI properties | [`@kenjiuno/msgreader`](https://github.com/HiraokaHyperTools/msgreader) |
| `.eml` | RFC 5322 / MIME | [`postal-mime`](https://github.com/postalsys/postal-mime) |
| `.emlx` | Apple Mail: a byte count, the message, an Apple plist | `postal-mime`, after unwrapping |
| `.mbox` | Unix mailbox: many messages in one file | `src/lib/mbox.ts`, then `postal-mime` per message |
| `.mht` | MHTML web archive | `src/lib/mime.ts` |
| `winmail.dat` | Outlook TNEF | `src/lib/tnef.ts` |

The format is chosen from the file's bytes rather than its name, so a message
saved with the wrong extension still opens.

An `.mbox` is listed rather than opened: the archive is split and summarised
from its headers, and a message is decoded only when you select it. A
1500-message archive lists in about 130ms.

A message carried inside another one, whether a forwarded `.eml`, an embedded
`.msg` or a TNEF stream, opens in place with a trail back out. Nesting stops at
five levels.

## What it does

- Prefers the HTML body and falls back to the plain-text one.
- Sanitises the body before rendering: scripts, event handlers and
  `javascript:` URLs are dropped, and links carry `noopener`.
- Blocks remote images until you ask for them, so opening a message sends no
  request to the sender.
- Resolves inline images from the parts inside the file itself, whether they
  are referenced by content-id or, in an MHT, by content-location.
- Lists attachments with their size and writes them to disk on request.
- Shows the raw transport headers when the file carries them.

## Design

The interface follows the
[Luca Ramseyer brand guidelines](https://luca-ramseyer.github.io/brand/style-guide.html):
Cormorant Garamond for display, Montserrat for text and UI, the cream and ink
palette with Swiss red as the single accent, hairline rules, 3px corners and an
8-point spacing scale. The tokens live in `tailwind.config.ts` and
`src/styles/globals.css`.

## Layout

```
src/lib/mail.ts        shared types, body sanitising, formatters
src/lib/mime.ts        a MIME reader for what postal-mime does not carry
src/lib/msg.ts         .msg   -> ParsedMessage
src/lib/eml.ts         .eml and .emlx -> ParsedMessage
src/lib/mht.ts         .mht   -> ParsedMessage
src/lib/tnef.ts        winmail.dat -> ParsedMessage
src/lib/mbox.ts        .mbox  -> ParsedMailFile, opened one message at a time
src/lib/open-mail.ts   format detection, dispatch, and nested messages
```

Adding a format means writing one parser that returns a `ParsedMessage` and
adding a branch to `detectFormat`. Parsers never import each other: the
dispatcher passes down a `parseNested` callback, which is how a message inside
a message gets opened whatever format it is in.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build
npm run start
```

Next.js 14 App Router, TypeScript, Tailwind CSS. There is no runtime
configuration and no environment variables to set.
