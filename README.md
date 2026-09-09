# msg-viewer

Read an Outlook `.msg` file in the browser. Drop a file in and you get the
subject, the people on it, the body and the attachments.

The file is parsed by JavaScript in the page. Nothing is uploaded, and there is
no server-side storage to clear afterwards.

## What it does

- Parses `.msg` (Compound File Binary) with
  [`@kenjiuno/msgreader`](https://github.com/HiraokaHyperTools/msgreader).
- Prefers the HTML body and falls back to the plain-text one.
- Sanitises the body before rendering: scripts, event handlers and
  `javascript:` URLs are dropped.
- Blocks remote images until you ask for them, so opening a message sends no
  request to the sender.
- Resolves `cid:` images from the attachments inside the file itself.
- Lists attachments with their size and writes them to disk on request.

## Design

The interface follows the
[Luca Ramseyer brand guidelines](https://luca-ramseyer.github.io/brand/style-guide.html):
Cormorant Garamond for display, Montserrat for text and UI, the cream and ink
palette with Swiss red as the single accent, hairline rules, 3px corners and an
8-point spacing scale. The tokens live in `tailwind.config.ts` and
`src/styles/globals.css`.

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
