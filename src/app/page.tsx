"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import Dropzone from "@/components/mail/dropzone";
import MessageView from "@/components/mail/message-view";
import { Button } from "@/components/ui/button";
import { MailParseError, type ParsedMessage } from "@/lib/mail";
import { openMail } from "@/lib/open-mail";

interface Loaded {
  fileName: string;
  message: ParsedMessage;
}

export default function HomePage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [isReading, setIsReading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setIsReading(true);
    try {
      const message = await openMail(file);
      setLoaded({ fileName: file.name, message });
    } catch (error) {
      const description =
        error instanceof MailParseError || error instanceof Error
          ? error.message
          : "The file could not be read.";
      toast.error("Could not open this file", { description });
    } finally {
      setIsReading(false);
    }
  }, []);

  return (
    <main className="mx-auto w-full max-w-column flex-1 px-s4 pb-s7 pt-s6">
      {loaded ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-s2 pb-s5">
            <p className="eyebrow truncate">{loaded.fileName}</p>
            <Button variant="ghost" size="sm" onClick={() => setLoaded(null)}>
              Open another file
            </Button>
          </div>
          <MessageView message={loaded.message} />
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
              Open an Outlook <span className="text-red">.msg</span> or a MIME{" "}
              <span className="text-red">.eml</span> without a mail client. Drop
              the file in and you get the subject, the people on it, the headers,
              the body and the attachments. Parsing happens in this tab, so
              nothing is uploaded.
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
                  title: "Shows the headers",
                  copy: "The full transport headers are one click away, alongside the attachments, which save straight to disk.",
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
