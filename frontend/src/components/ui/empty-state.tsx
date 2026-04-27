import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-bg-secondary p-12 text-center",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-bg-tertiary p-3">
          <Icon className="h-6 w-6 text-text-secondary" />
        </div>
      )}
      <h3 className="mb-1 block text-lg font-semibold text-text-primary">
        {title}
      </h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm text-text-secondary">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}
