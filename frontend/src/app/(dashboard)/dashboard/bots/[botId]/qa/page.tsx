"use client"

import * as React from "react"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useQA, useCreateQA, useUpdateQA, useDeleteQA } from "@/hooks/api/useQA"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { HelpCircle, Plus, Trash2, Edit2, Lightbulb, ToggleLeft, ToggleRight, Loader2 } from "lucide-react"

// Types
interface QAPair {
  id: string
  bot_id: string
  question: string
  answer: string
  is_active: boolean
  hit_count: number
  created_at: string
}

const TEMPLATES = [
  { title: "Business hours", question: "What are your business hours?", icon: "Clock" },
  { title: "Location and address", question: "Where are you located? What is your full address?", icon: "MapPin" },
  { title: "Payment modes", question: "What payment modes do you accept? Do you accept UPI or credit cards?", icon: "CreditCard" },
  { title: "Delivery areas", question: "Which cities or pin codes do you deliver to?", icon: "Truck" },
  { title: "Return/refund policy", question: "What is your return and refund policy?", icon: "RotateCcw" },
  { title: "GST and billing", question: "Do you provide GST invoices?", icon: "Receipt" },
  { title: "EMI options", question: "Do you offer EMI or payment installment options?", icon: "Wallet" },
  { title: "Contact number", question: "What is your customer care or support contact number?", icon: "Phone" },
]

export default function QAPage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ botId: string }>)
  const botId = params.botId
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [qData, setQData] = useState({ question: "", answer: "" })

  const { data: qaPairs, isLoading } = useQA(botId as string)
  const { mutate: createQA, isPending: isCreating } = useCreateQA()
  const { mutate: updateQA, isPending: isUpdating } = useUpdateQA()
  const { mutate: deleteQA } = useDeleteQA()
  
  const isSaving = isCreating || isUpdating

  const savePair = (payload: { question: string, answer: string, id?: string }) => {
    if (payload.id) {
      updateQA({ botId: botId as string, qaId: payload.id, data: { question: payload.question, answer: payload.answer } }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Q&A pair updated successfully!" })
          handleCloseModal()
        }
      })
    } else {
      createQA({ botId: botId as string, data: { question: payload.question, answer: payload.answer } }, {
        onSuccess: () => {
          toast({ title: "Success", description: "Q&A pair created successfully!" })
          handleCloseModal()
        },
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
      })
    }
  }

  const toggleActive = (params: { id: string, is_active: boolean }) => {
    updateQA({ botId: botId as string, qaId: params.id, data: { is_active: params.is_active } })
  }

  const deletePair = (id: string) => {
    deleteQA({ botId: botId as string, qaId: id }, {
      onSuccess: () => {
        toast({ title: "Deleted", description: "Q&A removed successfully" })
      }
    })
  }

  // Handlers
  const handleOpenModal = (templateQuestion = "", templateAnswer = "") => {
    setQData({ question: templateQuestion, answer: templateAnswer })
    setEditId(null)
    setIsModalOpen(true)
  }

  const handleEdit = (pair: QAPair) => {
    setQData({ question: pair.question, answer: pair.answer })
    setEditId(pair.id)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setQData({ question: "", answer: "" })
    setEditId(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!qData.question || !qData.answer) return
    savePair({ question: qData.question, answer: qData.answer, id: editId || undefined })
  }

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    )
  }

  const showTemplates = qaPairs?.length === 0

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <PageHeader 
        title="Q&A Pairs" 
        description="Force the AI to respond accurately to specific high-value queries."
      >
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" /> Add New Pair
        </Button>
      </PageHeader>

      {showTemplates && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold text-text-primary">Quick Start Templates</h2>
          </div>
          <p className="text-sm text-text-secondary mb-6">Start by answering the most common questions customers face.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {TEMPLATES.map((tmpl, idx) => (
              <div 
                key={idx} 
                onClick={() => handleOpenModal(tmpl.question)}
                className="border border-border-default rounded-xl p-4 cursor-pointer hover:border-brand hover:bg-brand/5 hover:shadow-md transition-all group bg-bg-secondary"
              >
                <h3 className="font-semibold text-sm mb-1 text-text-primary group-hover:text-brand transition-colors">{tmpl.title}</h3>
                <p className="text-xs text-text-secondary line-clamp-2">{tmpl.question}</p>
                <div className="mt-3 text-xs font-medium text-brand flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="h-3 w-3 mr-1" /> Add Answer
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="bg-bg-secondary border-border-default">
        <CardHeader>
          <CardTitle className="text-text-primary">Overridden Rules ({qaPairs?.length || 0})</CardTitle>
          <CardDescription className="text-text-secondary">Pairs ranked by frequency of autonomous override.</CardDescription>
        </CardHeader>
        <CardContent>
          {qaPairs?.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="bg-bg-tertiary p-4 rounded-full mb-4">
                <HelpCircle className="h-8 w-8 text-text-tertiary" />
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-1">No custom answers yet</h3>
              <p className="text-sm text-text-secondary max-w-sm mb-6">Create explicit Q&A mappings to guarantee strict answers for your most critical customer queries.</p>
              <Button onClick={() => handleOpenModal()} variant="outline">
                Add your first pair
              </Button>
            </div>
          ) : (
            <div className="rounded-md border border-border-default overflow-hidden">
              <div className="grid grid-cols-12 gap-4 bg-bg-tertiary p-3 text-xs font-medium text-text-tertiary uppercase">
                <div className="col-span-4">Target Question</div>
                <div className="col-span-4">Forced Answer</div>
                <div className="col-span-2 text-center">Hits</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <div className="divide-y divide-border-default">
                {qaPairs?.map((pair: QAPair) => (
                  <div key={pair.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-bg-tertiary/30 transition-colors">
                    <div className="col-span-4">
                      <p className="text-sm font-medium text-text-primary line-clamp-2">{pair.question}</p>
                    </div>
                    <div className="col-span-4">
                      <p className="text-sm text-text-secondary line-clamp-2">{pair.answer}</p>
                    </div>
                    <div className="col-span-2 text-center">
                      <Badge variant="outline" className="font-mono bg-bg-tertiary text-text-primary border-none">
                        {pair.hit_count}
                      </Badge>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                       <button 
                         onClick={() => toggleActive({ id: pair.id, is_active: !pair.is_active })}
                         className={`p-1.5 rounded-md transition-colors ${pair.is_active ? 'text-success hover:bg-success/10' : 'text-text-tertiary hover:bg-bg-tertiary'}`}
                         title={pair.is_active ? "Deactivate" : "Activate"}
                       >
                         {pair.is_active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                       </button>
                      <button 
                        onClick={() => handleEdit(pair)}
                        className="p-1.5 text-text-tertiary hover:text-brand hover:bg-brand/10 rounded-md transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => { if(confirm("Permanently delete this Q&A pair?")) deletePair(pair.id) }}
                        className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-bg-secondary border-border-default">
          <DialogHeader>
            <DialogTitle className="text-text-primary">{editId ? "Edit Override Rule" : "Create Strict Override"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">User's Question (or Target Concept)</label>
              <Input 
                placeholder="e.g. Do you accept credit cards?" 
                value={qData.question}
                onChange={e => setQData({ ...qData, question: e.target.value })}
                required
                className="bg-bg-primary border-border-default focus:border-brand"
              />
              <p className="text-[10px] text-text-tertiary">The AI uses semantic similarity, so exact wording isn't required.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Forced Exact Answer</label>
              <Textarea 
                placeholder="Yes, we accept all major credit cards and UPI." 
                rows={5}
                value={qData.answer}
                onChange={e => setQData({ ...qData, answer: e.target.value })}
                required
                className="bg-bg-primary border-border-default focus:border-brand"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
              <Button type="button" variant="ghost" onClick={handleCloseModal}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editId ? "Save Changes" : "Activate Pair"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
