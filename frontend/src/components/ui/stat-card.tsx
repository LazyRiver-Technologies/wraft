import * as React from "react"
import { TrendingDown, TrendingUp, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  change?: string
  trend?: "up" | "down" | "neutral"
  icon?: React.ElementType
  description?: string
}

export function StatCard({
  title,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  description,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-default bg-bg-secondary p-5",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wider text-text-secondary uppercase">
            {title}
          </p>
          <div className="mt-1 flex flex-col items-start gap-1">
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-semibold text-text-primary">
                {value}
              </h2>
              {change && (
                <span
                  className={cn(
                    "flex items-center text-xs font-medium",
                    trend === "up" && "text-success",
                    trend === "down" && "text-danger",
                    trend === "neutral" && "text-text-tertiary"
                  )}
                >
                  {trend === "up" && <TrendingUp className="mr-1 h-3 w-3" />}
                  {trend === "down" && <TrendingDown className="mr-1 h-3 w-3" />}
                  {trend === "neutral" && <Minus className="mr-1 h-3 w-3" />}
                  {change}
                </span>
              )}
            </div>
            {description && (
               <p className="text-xs text-text-tertiary mt-1">{description}</p>
            )}
          </div>
        </div>
        {Icon && (
          <div className="text-text-tertiary">
            <Icon className="h-8 w-8 opacity-80" strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  )
}
