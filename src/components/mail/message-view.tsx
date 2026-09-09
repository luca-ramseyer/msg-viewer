"use client";

import { ChevronDown, Download, ImageOff, Paperclip } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  FORMAT_LABELS,
  displayName,
  formatBytes,
  formatDate,
  initialsOf,
  renderBody,
  type ParsedAttachment,
  type ParsedMessage,
  type Party,
} from "@/lib/mail";

interface MessageViewProps {
  message: ParsedMessage;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1 sm:flex-row sm:gap-s2">
    <dt className="eyebrow shrink-0 pt-[3px] sm:w-[88px]">{label}</dt>
    <dd className="text-small text-graphite">{children}</dd>
  </div>
);

const PartyRow = ({ label, parties }: { label: string; parties: Party[] }) => {
  if (parties.length === 0) return null;

  return (
    <Row label={label}>
      {parties.map((party, index) => (
        <span key={`${party.email}-${index}`}>
          {index > 0 && <span className="text-stone">, </span>}
          {party.name ? (
            <>
              {party.name}
              {party.email && <span className="text-stone"> · {party.email}</span>}
            </>
          ) : (
            party.email
          )}
        </span>
      ))}
    </Row>
  );
};

const AttachmentRow = ({ attachment }: { attachment: ParsedAttachment }) => {
  const download = () => {
    const blob = new Blob([attachment.bytes], { type: attachment.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser a tick to start the download before dropping the URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <li className="flex items-center justify-between gap-s3 border-b border-line py-s2 last:border-0">
      <div className="min-w-0">
        <p className="truncate font-sans text-small text-ink">{attachment.fileName}</p>
        <p className="font-sans text-[11.5px] tracking-[0.04em] text-stone">
          {formatBytes(attachment.size)}
        </p>
      </div>
      <Button variant="quiet" size="sm" onClick={download}>
        <Download aria-hidden className="h-[13px] w-[13px]" />
        Save
      </Button>
    </li>
  );
};

const MessageView = ({ message }: MessageViewProps) => {
  const [allowRemoteImages, setAllowRemoteImages] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);

  // Inline images live inside the file itself, so resolving them stays local.
  const inlineImages = useMemo(() => {
    const map: Record<string, string> = {};
    for (const attachment of message.attachments) {
      if (!attachment.contentId) continue;
      const blob = new Blob([attachment.bytes], { type: attachment.mimeType });
      map[attachment.contentId] = URL.createObjectURL(blob);
    }
    return map;
  }, [message]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(inlineImages)) URL.revokeObjectURL(url);
    };
  }, [inlineImages]);

  const { html, blockedRemoteImages, embeddedContentIds } = useMemo(
    () => renderBody(message, { inlineImages, allowRemoteImages }),
    [message, inlineImages, allowRemoteImages],
  );

  // Files the body already shows inline are not separate attachments.
  const visibleAttachments = message.attachments.filter(
    (attachment) =>
      !attachment.hidden &&
      !(attachment.contentId && embeddedContentIds.has(attachment.contentId)),
  );

  return (
    <article className="animate-rise opacity-0">
      <header className="border-b border-line pb-s4">
        <h1 className="font-serif text-[30px] leading-tight text-ink sm:text-h1">
          {message.subject || "No subject"}
        </h1>

        <div className="mt-s4 flex items-start gap-s2">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-paper font-serif text-[17px] font-medium tracking-[0.04em] text-ink"
          >
            {initialsOf(message.sender)}
          </span>
          <div className="min-w-0 pt-1">
            <p className="font-serif text-h3 font-semibold leading-tight text-ink">
              {displayName(message.sender)}
            </p>
            {message.sender.email && (
              <p className="break-all font-sans text-small text-stone">
                {message.sender.email}
              </p>
            )}
          </div>
        </div>

        <dl className="mt-s3 flex flex-col gap-s1">
          <PartyRow label="To" parties={message.to} />
          <PartyRow label="Cc" parties={message.cc} />
          <PartyRow label="Bcc" parties={message.bcc} />
          <PartyRow label="Reply to" parties={message.replyTo} />
          {message.sentAt && <Row label="Sent">{formatDate(message.sentAt)}</Row>}
          <Row label="Format">{FORMAT_LABELS[message.format]}</Row>
        </dl>
      </header>

      {blockedRemoteImages > 0 && (
        <div className="mt-s4 flex flex-wrap items-center justify-between gap-s2 rounded-md border border-line bg-surface px-s3 py-s2">
          <p className="flex items-center gap-s1 text-small text-stone">
            <ImageOff aria-hidden className="h-4 w-4 shrink-0 text-red" />
            {blockedRemoteImages === 1
              ? "1 image is hosted on a remote server and was not loaded."
              : `${blockedRemoteImages} images are hosted on a remote server and were not loaded.`}
          </p>
          <Button variant="quiet" size="sm" onClick={() => setAllowRemoteImages(true)}>
            Load images
          </Button>
        </div>
      )}

      <div className="msg-body-scroll mt-s5">
        <div className="msg-body" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      {visibleAttachments.length > 0 && (
        <section className="mt-s6 border-t border-line pt-s4">
          <h2 className="eyebrow flex items-center gap-s1">
            <Paperclip aria-hidden className="h-[13px] w-[13px] text-red" />
            {visibleAttachments.length === 1
              ? "1 attachment"
              : `${visibleAttachments.length} attachments`}
          </h2>
          <ul className="mt-s2">
            {visibleAttachments.map((attachment) => (
              <AttachmentRow key={attachment.id} attachment={attachment} />
            ))}
          </ul>
        </section>
      )}

      {message.headers && (
        <section className="mt-s5 border-t border-line pt-s4">
          <button
            type="button"
            aria-expanded={showHeaders}
            onClick={() => setShowHeaders((shown) => !shown)}
            className="eyebrow flex items-center gap-s1 transition-colors duration-200 hover:text-red"
          >
            <ChevronDown
              aria-hidden
              className={`h-[13px] w-[13px] text-red transition-transform duration-200 ${
                showHeaders ? "rotate-180" : ""
              }`}
            />
            Message headers
          </button>
          {showHeaders && (
            <pre className="mt-s2 overflow-x-auto rounded-md border border-line bg-surface p-s2 font-mono text-[12px] leading-relaxed text-graphite">
              {message.headers}
            </pre>
          )}
        </section>
      )}
    </article>
  );
};

export default MessageView;
