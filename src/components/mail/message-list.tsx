"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { displayName, formatDate, initialsOf, type MailSummary } from "@/lib/mail";
import { cn } from "@/lib/utils";

/** An archive can hold tens of thousands of messages; render them in pages. */
const PAGE_SIZE = 100;

interface MessageListProps {
  entries: MailSummary[];
  selected: number | null;
  busy: number | null;
  onSelect: (index: number) => void;
}

const MessageList = ({ entries, selected, busy, onSelect }: MessageListProps) => {
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = entries.slice(0, shown);

  return (
  <nav aria-label="Messages in this archive">
    <p className="eyebrow">
      <span className="pr-[0.5em] text-red">
        {entries.length.toString().padStart(2, "0")}
      </span>
      {entries.length === 1 ? "Message" : "Messages"}
    </p>

    <ul className="mt-s2 border-t border-line">
      {visible.map((entry, index) => (
        <li key={index}>
          <button
            type="button"
            aria-current={selected === index}
            onClick={() => onSelect(index)}
            className={cn(
              "flex w-full items-start gap-s2 border-b border-line px-s1 py-s2 text-left transition-colors duration-200",
              selected === index ? "bg-surface" : "hover:bg-surface",
              busy === index && "opacity-60",
            )}
          >
            <span
              aria-hidden
              className="mt-[2px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-paper font-serif text-[12px] font-medium text-ink"
            >
              {initialsOf(entry.sender)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif text-[17px] leading-snug text-ink">
                {entry.subject || "No subject"}
              </span>
              <span className="block truncate font-sans text-[12.5px] text-stone">
                {displayName(entry.sender)}
                {entry.sentAt && (
                  <>
                    <span className="px-[0.45em] text-red">·</span>
                    {formatDate(entry.sentAt)}
                  </>
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>

    {shown < entries.length && (
      <div className="mt-s3 flex items-center gap-s2">
        <Button
          variant="quiet"
          size="sm"
          onClick={() => setShown((count) => count + PAGE_SIZE)}
        >
          Show more
        </Button>
        <p className="text-small text-stone">
          {visible.length} of {entries.length} shown
        </p>
      </div>
    )}
  </nav>
  );
};

export default MessageList;
