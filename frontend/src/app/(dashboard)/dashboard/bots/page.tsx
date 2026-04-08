"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useStore, Bot } from '@/lib/store'

export default function BotsPage() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const setCurrentBot = useStore(state => state.setCurrentBot)

  const { data: bots, isLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: () => fetchApi('/api/v1/bots')
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (newBot: {name: string, slug: string}) => fetchApi('/api/v1/bots', {
      method: 'POST',
      body: JSON.stringify(newBot)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      setOpen(false)
      setName('')
      setSlug('')
      toast({ title: "Success", description: "Bot created successfully!" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  })

  const handleNameChange = (val: string) => {
    setName(val)
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''))
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !slug) return
    mutate({ name, slug })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Bots</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Bot</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new Bot</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bot Name</label>
                <Input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="E.g. Customer Support" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL Slug</label>
                <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="customer-support" required />
              </div>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Creating..." : "Create Bot"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          bots?.map((bot: Bot) => (
            <Link key={bot.id} href={`/dashboard/bots/${bot.id}`} onClick={() => setCurrentBot(bot)}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{bot.name}</CardTitle>
                    <div className={`h-2 w-2 rounded-full ${bot.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </div>
                  <span className="text-sm text-slate-500">/{bot.slug}</span>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm text-slate-600 mt-4">
                    <span>Sources: {bot.data_sources?.length || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
        {bots?.length === 0 && !isLoading && (
          <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed rounded-lg">
            No bots yet. Create your first indexing bot!
          </div>
        )}
      </div>
    </div>
  )
}
