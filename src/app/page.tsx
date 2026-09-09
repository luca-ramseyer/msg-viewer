"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import Dropzone from "@/components/mail/dropzone";
import MessageList from "@/components/mail/message-list";
import MessageView from "@/components/mail/message-view";
import { Button } from "@/components/ui/button";
import {
  FORMAT_LABELS,
  MailParseError,
  type ParsedMailFile,
  type ParsedMessage,
} from "@/lib/mail";
import { openMail } from "@/lib/open-mail";

interface OpenFile {
  name: string;
  parsed: ParsedMailFile;
}

const describe = (error: unknown) =>
  error instanceof MailParseError || error instanceof Error
    ? error.message
    : "The file could not be read.";

export default function HomePage() {
  const [file, setFile] = useState<OpenFile | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [isReading, setIsReading] = useState(false);
  /** The path from the opened message down through any nested ones. */
  const [trail, setTrail] = useState<ParsedMessage[]>([]);

  const select = useCallback(async (parsed: ParsedMailFile, index: number) => {
    setBusy(index);
    try {
      const message = await parsed.open(index);
      setSelected(index);
      setTrail([message]);
    } catch (error) {
      toast.error("Could not open this message", { description: describe(error) });
    } finally {
      setBusy(null);
    }
  }, []);

  const handleFile = useCallback(
    async (chosen: File) => {
      setIsReading(true);
      try {
        const parsed = await openMail(chosen);
        setFile({ name: chosen.name, parsed });
        setSelected(null);
        setTrail([]);
        // A single message needs no list to pick from.
        if (parsed.entries.length === 1) await select(parsed, 0);
      } catch (error) {
        toast.error("Could not open this file", { description: describe(error) });
      } finally {
        setIsReading(false);
      }
    },
    [select],
  );

  const reset = () => {
    setFile(null);
    setSelected(null);
    setTrail([]);
  };

  const isArchive = (file?.parsed.entries.length ?? 0) > 1;
  const current = trail[trail.length - 1];

  return (
    <main className="mx-auto w-full max-w-column flex-1 px-s4 pb-s7 pt-s6">
      {file ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-s2 pb-s5">
            <p className="eyebrow min-w-0 truncate">
              {file.name}
              <span className="px-[0.5em] text-red">·</span>
              {FORMAT_LABELS[file.parsed.format]}
            </p>
            <Button variant="ghost" size="sm" onClick={reset}>
              Open another file
            </Button>
          </div>

          {/* Where we are: the archive, then each message opened inside another. */}
          {current && (isArchive || trail.length > 1) && (
            <nav className="flex flex-wrap items-center gap-s1 pb-s4">
              {isArchive && (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0"
                  onClick={() => {
                    setSelected(null);
                    setTrail([]);
                  }}
                >
                  <ChevronLeft aria-hidden className="h-[13px] w-[13px] text-red" />
                  All messages
                </Button>
              )}
              {trail.slice(0, -1).map((message, index) => (
                <span key={index} className="flex min-w-0 items-center gap-s1">
                  <span aria-hidden className="text-red">
                    ·
                  </span>
                  <Button
                    variant="link"
                    size="sm"
                    className="block max-w-[28ch] truncate px-0 normal-case tracking-normal"
                    onClick={() => setTrail((path) => path.slice(0, index + 1))}
                  >
                    {message.subject || "No subject"}
                  </Button>
                </span>
              ))}
            </nav>
          )}

          {current ? (
            <MessageView
              key={trail.length}
              message={current}
              onOpenNested={(message) => setTrail((path) => [...path, message])}
            />
          ) : (
            <MessageList
              entries={file.parsed.entries}
              selected={selected}
              busy={busy}
              onSelect={(index) => void select(file.parsed, index)}
            />
          )}
        </>
      ) : (
        <>
          <section className="animate-rise pb-s6 opacity-0">
            <p className="eyebrow">
              <span className="pr-[0.5em] text-red">01</span>Local tool
            </p>
            <h1 className="mt-s2 font-serif text-[34px] leading-tight text-ink sm:text-h1">
              Preview a saved mail in your browser.
            </h1>
            <p className="mt-s3 max-w-[64ch] text-[18px]">
              Open an Outlook <span className="text-red">.msg</span>, a MIME{" "}
              <span className="text-red">.eml</span>, an Apple Mail{" "}
              <span className="text-red">.emlx</span>, an{" "}
              <span className="text-red">.mbox</span> archive, an{" "}
              <span className="text-red">.mht</span> page, or the{" "}
              <span className="text-red">winmail.dat</span> nobody else can read.
              Parsing happens in this tab, so nothing is uploaded.
            </p>
          </section>

          <Dropzone onFile={handleFile} disabled={isReading} />

          <section className="mt-s6 border-t border-line pt-s5">
            <p className="eyebrow">
              <span className="pr-[0.5em] text-red">02</span>What this does
            </p>
            <div className="mt-s3 grid gap-s3 sm:grid-cols-3">
              {[
                {
                  title: "Stays on your machine",
                  copy: "The file is parsed by JavaScript in this tab. No server sees it, and there is nothing to delete afterwards.",
                },
                {
                  title: "Blocks remote images",
                  copy: "Images hosted elsewhere are held back until you ask for them, so opening a message sends no request to the sender.",
                },
                {
                  title: "Opens what is inside",
                  copy: "Forwarded messages open in place, attachments save to disk, and the full transport headers are one click away.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-md border border-line bg-surface p-s3"
                >
                  <h2 className="font-serif text-h3 font-semibold text-ink">
                    {item.title}
                  </h2>
                  <p className="mt-s1 text-small text-stone">{item.copy}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
