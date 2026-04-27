"use client"

import * as React from "react"
import { useEffect } from "react"
import { useBot } from "@/hooks/api/useBots"
import { useStore } from "@/lib/store"
import BotLoading from "./loading"

export default function BotLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: any
}) {
  const resolvedParams = React.use(params as Promise<{ botId: string }>)
  const { data: bot, isLoading, isError } = useBot(resolvedParams.botId)
  const setCurrentBot = useStore((state) => state.setCurrentBot)

  useEffect(() => {
    if (bot) {
      setCurrentBot(bot)
    }
  }, [bot, setCurrentBot])

  if (isLoading) {
    return <BotLoading />
  }

  if (isError || !bot) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-xl font-semibold text-text-primary">Bot not found</h2>
        <p className="text-text-secondary mt-2">The bot you are looking for does not exist or you don't have access to it.</p>
      </div>
    )
  }

  return <>{children}</>
}
