"use client";

import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const Dropzone = ({ onFile, disabled = false }: DropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const file = event.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [disabled, onFile],
  );

  return (
    <div
      onClick={disabled ? undefined : openPicker}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed px-s4 py-s6 text-center transition-colors duration-200",
        isDragging ? "border-red bg-surface" : "border-line bg-surface",
        disabled ? "cursor-wait opacity-60" : "cursor-pointer hover:border-ink",
      )}
    >
      <p className="eyebrow">Outlook message</p>
      <p className="mt-s2 font-serif text-h2 text-ink">
        Drop a <span className="text-red">.msg</span> file here
      </p>
      <p className="mt-s2 max-w-[46ch] text-small text-stone">
        The file is read in this browser tab and never leaves your computer.
      </p>

      <Button
        variant="ghost"
        className="mt-s3"
        disabled={disabled}
        // The whole panel already opens the picker; do not open it twice.
        onClick={(event) => {
          event.stopPropagation();
          openPicker();
        }}
      >
        {disabled ? "Reading…" : "Choose a file"}
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept=".msg,application/vnd.ms-outlook"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // Reset so re-picking the same file fires change again.
          event.target.value = "";
        }}
      />
    </div>
  );
};

export default Dropzone;
