"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import Dropzone from "@/components/msg/dropzone";
import MessageView from "@/components/msg/message-view";
import { Button } from "@/components/ui/button";
import { MsgParseError, parseMsg, type ParsedMessage } from "@/lib/msg";

interface Loaded {
  fileName: string;
  message: ParsedMessage;
}

const readAsArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(result);
      else reject(new Error("The file could not be read."));
    };
    reader.readAsArrayBuffer(file);
  });

export default function HomePage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [isReading, setIsReading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".msg")) {
      toast.error("That is not a .msg file", {
        description: "Outlook saves messages as .msg. Pick one of those.",
      });
      return;
    }

    setIsReading(true);
    try {
      const buffer = await readAsArrayBuffer(file);
      const message = parseMsg(buffer);
      setLoaded({ fileName: file.name, message });
    } catch (error) {
      const description =
        error instanceof MsgParseError || error instanceof Error
          ? error.message
          : "The file could not be read.";
      toast.error("Could not open this message", { description });
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
              Read an Outlook <span className="text-red">.msg</span> file in your
              browser.
            </h1>
            <p className="mt-s3 max-w-[64ch] text-[18px]">
              Open a saved Outlook message without Outlook. Drop the file in and
              you get the subject, the people on it, the body and the
              attachments. Parsing happens in this tab, so nothing is uploaded.
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
                  title: "Saves attachments",
                  copy: "Every attachment is listed with its size and can be written straight to disk from the message view.",
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
