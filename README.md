# mail-viewer

Preview a saved mail in the browser. Drop a file in and you get the subject,
the people on it, the headers, the body and the attachments.

The file is parsed by JavaScript in the page. Nothing is uploaded, and there is
no server-side storage to clear afterwards.

## Formats

| Extension | Format | Parser |
| --- | --- | --- |
| `.msg` | Outlook compound file with MAPI properties | [`@kenjiuno/msgreader`](https://github.com/HiraokaHyperTools/msgreader) |
| `.eml` | RFC 5322 / MIME | [`postal-mime`](https://github.com/postalsys/postal-mime) |
| `.emlx` | Apple Mail (a byte count, the message, an Apple plist) | `postal-mime`, after unwrapping |

The format is chosen from the file's bytes rather than its name, so a message
saved with the wrong extension still opens.

## What it does

- Prefers the HTML body and falls back to the plain-text one.
- Sanitises the body before rendering: scripts, event handlers and
  `javascript:` URLs are dropped.
- Blocks remote images until you ask for them, so opening a message sends no
  request to the sender.
- Resolves `cid:` images from the parts inside the file itself.
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
src/lib/msg.ts         .msg  -> ParsedMessage
src/lib/eml.ts         .eml and .emlx -> ParsedMessage
src/lib/open-mail.ts   format detection and dispatch
```

Adding a format means writing one parser that returns a `ParsedMessage` and
adding a branch to `detectFormat`.

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
