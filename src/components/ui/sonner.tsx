"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-[3px] group-[.toaster]:border group-[.toaster]:border-line group-[.toaster]:bg-surface group-[.toaster]:font-sans group-[.toaster]:text-ink group-[.toaster]:shadow-none",
          description: "group-[.toast]:text-stone",
          actionButton:
            "group-[.toast]:rounded-[3px] group-[.toast]:bg-ink group-[.toast]:text-paper",
          cancelButton:
            "group-[.toast]:rounded-[3px] group-[.toast]:bg-paper group-[.toast]:text-stone",
          error: "group-[.toaster]:border-red",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
