import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-sans font-medium uppercase tracking-label transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-ink bg-ink text-paper hover:border-black hover:bg-black",
        ghost: "border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
        accent: "border-red bg-red text-white hover:border-red-deep hover:bg-red-deep",
        quiet:
          "border-line bg-surface text-ink hover:border-ink hover:bg-paper",
        link: "border-transparent text-ink underline decoration-line underline-offset-4 hover:text-red hover:decoration-red",
      },
      size: {
        default: "px-[26px] py-[13px] text-[12.5px]",
        sm: "px-4 py-2 text-[11px]",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
