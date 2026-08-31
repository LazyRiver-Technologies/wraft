"use client"

import * as React from "react"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { fetchApi } from "@/lib/api"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Check, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { PageHeader } from "@/components/ui/page-header"

export default function SuggestionsPage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ botId: string }>)
  const botId = params.botId
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("pending")
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState<Record<string, unknown> | null>(null)
  const [answerText, setAnswerText] = useState("")

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["suggestions", botId, activeTab],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("suggestions")
        .select("*")
        .eq("bot_id", botId)
        .eq("status", activeTab)
        .order("frequency", { ascending: false })
      if (error) throw error
      return { data: data || [] }
    },
    placeholderData: keepPreviousData
  })

  const patchMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("suggestions")
        .update({ status })
        .eq("id", id)
        .eq("bot_id", botId)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions", botId] })
      queryClient.invalidateQueries({ queryKey: ["suggestions_count", botId] })
    }
  })

  const addQaMutation = useMutation({
    mutationFn: async ({ question, answer }: { question: string; answer: string }) => {
      return fetchApi(`/api/v1/bots/${botId}/qa`, {
        method: "POST",
        body: JSON.stringify({ question, answer })
      })
    },
    onSuccess: async () => {
      if (activeSuggestion) {
        await patchMutation.mutateAsync({ id: String(activeSuggestion.id), status: "added_qa" })
      }
      setIsModalOpen(false)
      setActiveSuggestion(null)
      setAnswerText("")
      toast({
        title: "Added to Knowledge Base",
        description: "The Q&A pair has been added successfully."
      })
    }
  })

  const handleDismiss = (id: string) => {
    patchMutation.mutate({ id, status: "dismissed" })
    toast({
      title: "Suggestion Dismissed",
      description: "It has been moved to the dismissed tab."
    })
  }

  const openQaModal = (suggestion: Record<string, unknown>) => {
    setActiveSuggestion(suggestion)
    setAnswerText("")
    setIsModalOpen(true)
  }

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const renderCards = () => {
    if (isLoading) {
      return (
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          {[1, 2, 3, 4].map(i => (
             <Skeleton key={i} className="h-48 w-full rounded-xl bg-bg-secondary border border-border-default" />
          ))}
        </div>
      )
    }

    const data = suggestions?.data || []

    if (data.length === 0) {
      return (
        <div className="text-center py-20 bg-bg-secondary/50 border border-border-default border-dashed rounded-2xl flex flex-col items-center justify-center mt-6">
          <Sparkles className="h-10 w-10 text-brand/30 mb-4" />
          <h3 className="text-xl font-medium text-text-primary mb-2">
            {activeTab === "pending" ? "No knowledge gaps discovered yet!" : `No ${activeTab} suggestions.`}
          </h3>
          {activeTab === "pending" && (
             <p className="text-text-tertiary">Your bot seems to be answering everything perfectly.</p>
          )}
        </div>
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 mt-6">
        {data.map((item: Record<string, unknown>) => (
          <Card key={String(item.id)} className="bg-bg-secondary border-border-default flex flex-col shadow-sm hover:shadow-md transition-all">
            <CardHeader className="pb-3 border-b border-border-default">
              <CardTitle className="text-lg leading-tight text-text-primary">{String(item.question)}</CardTitle>
              <CardDescription className="text-brand pt-1 font-bold uppercase text-[10px] tracking-widest">
                Asked {String(item.frequency)} times this week
              </CardDescription>
            </CardHeader>
            <CardContent className="py-4 flex-1">
              <button 
                onClick={() => toggleExpand(String(item.id))}
                className="flex items-center text-xs font-semibold text-text-tertiary hover:text-brand transition-colors uppercase tracking-wider"
              >
                {expandedCards[String(item.id)] ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                {expandedCards[String(item.id)] ? "Hide similar variations" : "See user variations"}
              </button>
              
              {expandedCards[String(item.id)] && item.sample_questions && Array.isArray(item.sample_questions) ? (
                <div className="mt-3 p-3 bg-bg-tertiary/50 rounded-lg border border-border-default space-y-2">
                  {item.sample_questions.map((q: unknown, idx: number) => (
                    <div key={idx} className="text-sm text-text-secondary italic opacity-80">&quot;{String(q)}&quot;</div>
                  ))}
                </div>
              ) : null}
            </CardContent>
            {activeTab === "pending" && (
              <CardFooter className="flex gap-2 w-full mt-auto border-t border-border-default pt-4 pb-4">
                <Button 
                  onClick={() => openQaModal(item)}
                  className="flex-1 h-9"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Add to Q&A
                </Button>
                <Button 
                  onClick={() => handleDismiss(String(item.id))}
                  variant="secondary" 
                  className="flex-1 h-9"
                >
                  <X className="h-4 w-4 mr-2" />
                  Dismiss
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="pb-10 animate-in fade-in duration-500">
      <PageHeader 
        title="Suggestions" 
        description="Identify and patch knowledge gaps discovered by the AI during real conversations."
      />

      <Tabs defaultValue="pending" onValueChange={setActiveTab} className="mt-6">
        <TabsList className="bg-bg-tertiary border border-border-default">
          <TabsTrigger value="pending" className="data-[state=active]:bg-bg-elevated data-[state=active]:text-brand">
            Pending Gaps
          </TabsTrigger>
          <TabsTrigger value="added_qa" className="data-[state=active]:bg-bg-elevated data-[state=active]:text-brand">
            Resolved
          </TabsTrigger>
          <TabsTrigger value="dismissed" className="data-[state=active]:bg-bg-elevated data-[state=active]:text-brand">
            Dismissed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="m-0">
          {renderCards()}
        </TabsContent>
        <TabsContent value="added_qa" className="m-0">
          {renderCards()}
        </TabsContent>
        <TabsContent value="dismissed" className="m-0">
          {renderCards()}
        </TabsContent>
      </Tabs>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-bg-secondary border-border-default text-text-primary sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Patch Knowledge Gap</DialogTitle>
            <DialogDescription className="text-text-tertiary">
              Define an exact response for this topic. Future similar queries will use this answer.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Detected Topic</label>
              <div className="p-3 bg-bg-tertiary rounded-md border border-border-default text-sm font-medium">
                {activeSuggestion ? String(activeSuggestion.question) : ""}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Forced Response</label>
              <Textarea 
                placeholder="Type the exact response you want the bot to say..."
                className="bg-bg-primary border-border-default focus:border-brand min-h-[140px]"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter className="border-t border-border-default pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              disabled={!answerText.trim() || addQaMutation.isPending}
              onClick={() => {
                 if (activeSuggestion) {
                    addQaMutation.mutate({ question: String(activeSuggestion.question), answer: answerText })
                 }
              }}
            >
              {addQaMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Activate Answer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
