import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full resize-none rounded-md border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary shadow-sm transition-colors placeholder:text-text-tertiary focus-visible:outline-none focus:border-brand focus:shadow-brand focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-danger focus:border-danger focus:shadow-none",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
