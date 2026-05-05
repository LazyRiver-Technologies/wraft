"use client"
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import * as React from "react"
import { useState } from "react"
import { useActions, useCreateAction, useUpdateAction, useDeleteAction } from "@/hooks/api/useActions"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Bell, Calculator, PackageSearch, Zap, Plus, ArrowRight, ArrowLeft, Trash2, Edit } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { useProfileWithPlan } from "@/hooks/api/useBilling"
import { FeatureGate } from "@/components/ui/FeatureGate"

const ACTION_TYPES = [
  {
    id: "notify_owner",
    title: "Notify Owner",
    description: "Send you a WhatsApp message when customer needs human help",
    icon: Bell,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20"
  },
  {
    id: "calculate_quote",
    title: "Calculate Quote",
    description: "Bot calculates and quotes prices for your services",
    icon: Calculator,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20"
  },
  {
    id: "check_availability",
    title: "Check Availability",
    description: "Bot tells customers if products are in stock",
    icon: PackageSearch,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20"
  }
]

export default function ActionsPage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ botId: string }>)
  const botId = params.botId
  const { toast } = useToast()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  
  // Form State
  const [actionName, setActionName] = useState("")
  const [actionDesc, setActionDesc] = useState("")
  const [quoteItems, setQuoteItems] = useState([{ name: "", rate: "", unit: "" }])
  const [availItems, setAvailItems] = useState([{ name: "", available: true }])

  const { data: actions, isLoading } = useActions(botId as string)
  const { mutate: createAction, isPending: isCreating } = useCreateAction()
  const { mutate: updateAction } = useUpdateAction()
  const { mutate: deleteAction } = useDeleteAction()
  
  const { data: profile } = useProfileWithPlan()
  const hasActionsAccess = profile?.plans?.custom_actions === true || profile?.plans?.check_availability === true
  const hasScaleAccess = profile?.plans?.calculate_quote === true

  const createMutation = {
    isPending: isCreating,
    mutate: (payload: any) => {
      createAction({ botId: botId as string, data: payload }, {
        onSuccess: () => {
          setIsModalOpen(false)
          resetForm()
          toast({ title: "Action Created", description: "Your bot can now use this action magically." })
        },
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
      })
    }
  }

  const patchMutation = {
    mutate: ({ id, payload }: { id: string, payload: any }) => {
      updateAction({ botId: botId as string, actionId: id, data: payload }, {
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
      })
    }
  }

  const deleteMutation = {
    mutate: (id: string) => {
      deleteAction({ botId: botId as string, actionId: id }, {
        onSuccess: () => toast({ title: "Action Deleted" }),
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
      })
    }
  }

  const resetForm = () => {
    setStep(1)
    setSelectedType(null)
    setActionName("")
    setActionDesc("")
    setQuoteItems([{ name: "", rate: "", unit: "" }])
    setAvailItems([{ name: "", available: true }])
  }

  const handleCreate = () => {
    const payload: any = {
      name: selectedType, // technical name
      display_name: actionName,
      description: actionDesc || "Action functionality constraint",
      action_type: selectedType,
      config: {}
    }

    if (selectedType === "calculate_quote") {
      payload.config.items = quoteItems.map(i => ({ name: i.name, rate: Number(i.rate), unit: i.unit }))
    } else if (selectedType === "check_availability") {
      payload.config.items = availItems
    }
    
    createMutation.mutate(payload)
  }

  const toggleStatus = (id: string, current: boolean) => {
    patchMutation.mutate({ id, payload: { is_active: !current } })
  }

  const renderConfigStep = () => {
    if (selectedType === "notify_owner") {
      return (
        <div className="py-8 text-center border border-white/10 rounded-xl bg-white/5 space-y-3">
          <Bell className="h-12 w-12 text-amber-500/50 mx-auto" />
          <h3 className="text-lg font-medium text-white">No Configuration Needed</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            This action simply connects to your base Notification Settings. The bot will automatically trigger it when the user asks for a human.
          </p>
        </div>
      )
    }

    if (selectedType === "calculate_quote") {
      return (
        <div className="space-y-4">
          <div className="p-4 border border-white/10 rounded-xl bg-white/5">
            <h4 className="font-medium text-emerald-100 mb-2">Pricing Catalog</h4>
            <div className="space-y-3">
              {quoteItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input 
                    placeholder="E.g. Web Design" 
                    value={item.name}
                    onChange={(e) => {
                      const newArr = [...quoteItems]
                      newArr[idx].name = e.target.value
                      setQuoteItems(newArr)
                    }}
                    className="bg-black/20 border-white/10 text-white flex-[2]" 
                  />
                  <Input 
                    type="number"
                    placeholder="Rate (₹)" 
                    value={item.rate}
                    onChange={(e) => {
                      const newArr = [...quoteItems]
                      newArr[idx].rate = e.target.value
                      setQuoteItems(newArr)
                    }}
                    className="bg-black/20 border-white/10 text-white flex-1" 
                  />
                  <Input 
                    placeholder="Unit (per hr)" 
                    value={item.unit}
                    onChange={(e) => {
                      const newArr = [...quoteItems]
                      newArr[idx].unit = e.target.value
                      setQuoteItems(newArr)
                    }}
                    className="bg-black/20 border-white/10 text-white flex-1" 
                  />
                </div>
              ))}
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setQuoteItems([...quoteItems, { name: "", rate: "", unit: "" }])}
                className="mt-4 border-white/10 bg-transparent text-slate-300 hover:text-white"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Row
            </Button>
          </div>
        </div>
      )
    }

    if (selectedType === "check_availability") {
      return (
        <div className="space-y-4">
          <div className="p-4 border border-white/10 rounded-xl bg-white/5">
            <h4 className="font-medium text-emerald-100 mb-2">Inventory Tracker</h4>
            <div className="space-y-3">
              {availItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 bg-black/20 p-2 rounded-lg border border-white/5">
                  <Input 
                    placeholder="E.g. iPhone 15 Pro" 
                    value={item.name}
                    onChange={(e) => {
                      const newArr = [...availItems]
                      newArr[idx].name = e.target.value
                      setAvailItems(newArr)
                    }}
                    className="border-transparent bg-transparent text-white flex-1 outline-none focus-visible:ring-0 px-2" 
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Available</span>
                    <Switch 
                      checked={item.available}
                      onCheckedChange={(val) => {
                        const newArr = [...availItems]
                        newArr[idx].available = val
                        setAvailItems(newArr)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAvailItems([...availItems, { name: "", available: true }])}
                className="mt-4 border-white/10 bg-transparent text-slate-300 hover:text-white"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>
        </div>
      )
    }
  }

  const getActionStyles = (type: string) => {
    return ACTION_TYPES.find(a => a.id === type) || ACTION_TYPES[0]
  }

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-500 pb-10">
      <FeatureGate hasAccess={hasActionsAccess} requiredPlan="Growth">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
            <Zap className="h-6 w-6 text-emerald-400" />
            AI Actions
          </h1>
          <p className="text-slate-400 text-sm">
            Let your bot do things, not just answer. Your bot can notify you, calculate quotes, and check product availability automatically.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="h-4 w-4 mr-2" /> Add Action
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl bg-[#0f1413]/50" />)}
        </div>
      ) : actions?.length === 0 ? (
        <div className="py-20 border border-white/5 rounded-2xl bg-[#0f1413]/50 flex flex-col items-center">
            <Zap className="h-12 w-12 text-emerald-500/50 mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Supercharge Your Bot</h3>
            <p className="text-slate-400 mb-8 max-w-sm text-center">Give your bot access to external tools directly mapping logic seamlessly.</p>
            <div className="grid md:grid-cols-3 gap-4 max-w-4xl px-4">
               {ACTION_TYPES.map(type => {
                 const Icon = type.icon
                 const isScaleOnly = type.id === 'calculate_quote'
                 const disabled = isScaleOnly && !hasScaleAccess
                 
                 return (
                   <Card key={type.id} className={`bg-black/20 border-white/5 transition-all flex flex-col ${disabled ? 'opacity-50 grayscale' : 'hover:border-emerald-500/30 cursor-pointer group'} relative`} onClick={() => { if(!disabled) { resetForm(); setSelectedType(type.id); setIsModalOpen(true); setTimeout(() => setStep(2), 100); } }}>
                     {disabled && <div className="absolute top-2 right-2 bg-rose-500/10 text-rose-500 text-[10px] px-2 py-0.5 rounded border border-rose-500/20 font-bold uppercase tracking-wider">Scale Plan</div>}
                     <CardHeader className="text-center pb-2 flex-grow">
                         <div className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${!disabled ? 'group-hover:scale-110' : ''} transition-transform ${type.bg} border ${type.border}`}>
                            <Icon className={`h-6 w-6 ${type.color}`} />
                         </div>
                         <CardTitle className="text-base text-emerald-50">{type.title}</CardTitle>
                         <CardDescription className="text-xs max-w-[200px] mx-auto mt-2 leading-relaxed">{type.description}</CardDescription>
                     </CardHeader>
                     <CardFooter className="pt-2 pb-4">
                       <Button variant="ghost" disabled={disabled} className="w-full text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 h-8 text-xs">{disabled ? "Upgrade to unlock" : "Set up"} <ArrowRight className="h-3 w-3 ml-1" /></Button>
                     </CardFooter>
                   </Card>
                 )
               })}
            </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actions?.map((action: any) => {
            const styles = getActionStyles(action.action_type)
            const Icon = styles.icon
            return (
              <Card key={action.id} className={`bg-[#0f1413] border-white/5 flex flex-col relative overflow-hidden transition-all ${!action.is_active && 'opacity-60 grayscale'}`}>
                {action.is_active && <div className={`absolute top-0 right-0 w-32 h-32 ${styles.bg} blur-3xl -z-10 rounded-full mix-blend-screen opacity-20`}></div>}
                
                <CardHeader className="pb-3 border-b border-white/5">
                   <div className="flex justify-between items-start">
                     <div className="flex gap-3 items-center">
                       <div className={`p-2 rounded-lg border ${styles.bg} ${styles.border}`}>
                          <Icon className={`h-5 w-5 ${styles.color}`} />
                       </div>
                       <div>
                         <CardTitle className="text-base leading-tight text-white">{action.display_name}</CardTitle>
                         <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mt-1">{styles.title}</div>
                       </div>
                     </div>
                     <Switch checked={action.is_active} onCheckedChange={() => toggleStatus(action.id, action.is_active)} />
                   </div>
                </CardHeader>
                <CardContent className="py-4 flex-1">
                   {action.action_type === 'calculate_quote' && (
                     <div className="text-sm text-slate-400 font-mono">
                        {action.config?.items?.length || 0} products mapped
                     </div>
                   )}
                   {action.action_type === 'check_availability' && (
                     <div className="flex flex-wrap gap-1.5 mt-1">
                        {action.config?.items?.slice(0, 3).map((v:any, idx:number) => (
                           <span key={idx} className="bg-white/5 text-slate-300 border border-white/10 text-[10px] px-2 py-0.5 rounded-full inline-flex items-center">
                             {v.name} {v.available ? '✅' : '❌'}
                           </span>
                        ))}
                     </div>
                   )}
                   {action.action_type === 'notify_owner' && (
                      <div className="text-sm text-slate-400">Routes to configured owner phone instantly</div>
                   )}
                </CardContent>
                <CardFooter className="pt-0 flex justify-between items-center bg-black/20 px-4 py-3 border-t border-white/5">
                   <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-500/70">
                      <Zap className="h-3 w-3" /> Triggered {action.trigger_count || 0} times
                   </div>
                   <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
                        onClick={() => {
                          setSelectedType(action.action_type)
                          setActionName(action.display_name)
                          if (action.action_type === "calculate_quote") setQuoteItems(action.config?.items || [])
                          if (action.action_type === "check_availability") setAvailItems(action.config?.items || [])
                          setStep(3); setIsModalOpen(true);
                        }}
                      ><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(action.id)} className="h-8 w-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                   </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL WORKFLOW */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#0f1413] border-white/10 text-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add AI Action</DialogTitle>
            <DialogDescription className="text-slate-400">Step {step} of 3</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {step === 1 && (
              <div className="grid md:grid-cols-3 gap-4">
                 {ACTION_TYPES.map(type => {
                   const Icon = type.icon
                   const isScaleOnly = type.id === 'calculate_quote'
                   const disabled = isScaleOnly && !hasScaleAccess

                   return (
                     <Card 
                        key={type.id} 
                        className={`bg-black/40 border-white/5 transition-all flex flex-col relative ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:border-emerald-500/50 group'} ${selectedType === type.id ? 'ring-2 ring-emerald-500 border-emerald-500' : ''}`} 
                        onClick={() => { if(!disabled) setSelectedType(type.id) }}
                     >
                       {disabled && <div className="absolute top-2 right-2 bg-rose-500/10 text-rose-500 text-[10px] px-2 py-0.5 rounded border border-rose-500/20 font-bold uppercase tracking-wider">Scale Plan</div>}
                       <CardHeader className="text-center pb-4 flex-grow">
                           <div className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${type.bg} border ${type.border}`}>
                              <Icon className={`h-6 w-6 ${type.color}`} />
                           </div>
                           <CardTitle className="text-base text-emerald-50">{type.title}</CardTitle>
                           <CardDescription className="text-xs mx-auto mt-2 leading-relaxed">{type.description}</CardDescription>
                       </CardHeader>
                     </Card>
                   )
                 })}
              </div>
            )}

            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                {renderConfigStep()}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                   <label className="text-sm font-medium text-emerald-100">Display Name</label>
                   <Input 
                     value={actionName} 
                     onChange={e => setActionName(e.target.value)}
                     placeholder="e.g. Provide Pricing Estimate" 
                     className="bg-black/40 border-white/10 focus-visible:ring-emerald-500 text-white" 
                   />
                   <p className="text-xs text-slate-400">This is how the action appears to you internally.</p>
                </div>
                {/* description hidden dynamically for simple UI constraints since actions explicitly override descriptions internally for LLMs */}
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between w-full border-t border-white/10 pt-4 mt-2">
            <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : setIsModalOpen(false)} className="text-slate-300 hover:text-white">
              {step > 1 ? <><ArrowLeft className="h-4 w-4 mr-2" /> Back</> : "Cancel"}
            </Button>
            
            {step < 3 ? (
              <Button disabled={!selectedType} onClick={() => setStep(step + 1)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button disabled={!actionName || createMutation.isPending} onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {createMutation.isPending ? "Creating..." : "Confirm & Create"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </FeatureGate>
    </div>
  )
}
