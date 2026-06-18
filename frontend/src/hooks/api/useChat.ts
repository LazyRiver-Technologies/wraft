import { useState, useRef, useEffect } from "react"
import { fetchApi } from "@/lib/api"
import { useQueryClient } from "@tanstack/react-query"

export interface ChatMessage {
  id: string | number
  text: string
  isBot: boolean
  confidence: "high" | "medium" | "low" | ""
}

export function useChat(botSlug?: string) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 1, 
    text: "Welcome to LazyRiver! How can I help you today?", 
    isBot: true, 
    confidence: "high"
  }])
  const [isTyping, setIsTyping] = useState(false)

  const sendMessage = async (text: string) => {
    if (!botSlug || !text.trim()) return

    const userMsg: ChatMessage = { id: Date.now(), text, isBot: false, confidence: "" }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      const response = await fetchApi(`/api/v1/chat/${botSlug}`, {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          session_id: "preview_session",
          preview_mode: true
        })
      })

      // Assuming backend returns { response: "text", confidence: "high" }
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: response.response || "No response generated.",
        isBot: true,
        confidence: response.confidence || "high"
      }])

      // Force dashboard analytics to update live
      queryClient.invalidateQueries({ queryKey: ["analytics"] })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: "Error communicating with the bot: " + errorMessage,
        isBot: true,
        confidence: "low"
      }])
    } finally {
      setIsTyping(false)
    }
  }

  return {
    messages,
    isTyping,
    sendMessage
  }
}
