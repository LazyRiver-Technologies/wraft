"use client"

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Trash2, FileText, Globe, UploadCloud, Loader2 } from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  if (status === 'ready') return <Badge className="bg-emerald-500 hover:bg-emerald-600">Ready</Badge>
  if (status === 'pending') return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>
  if (status === 'processing') return <Badge className="bg-blue-500 hover:bg-blue-600 animate-pulse">Processing <Loader2 className="ml-1 h-3 w-3 animate-spin inline" /></Badge>
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>
  return <Badge variant="outline">{status}</Badge>
}

interface Source {
  id: string;
  type: string;
  name: string;
  status: string;
  chunk_count?: number;
  error_msg?: string;
}

export default function SourcesPage() {
  const { botId } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [url, setUrl] = useState('')
  const [sitemap, setSitemap] = useState('')
  const [textName, setTextName] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const { data: sources, isLoading } = useQuery({
    queryKey: ['sources', botId],
    queryFn: () => fetchApi(`/api/v1/bots/${botId}/sources`),
    refetchInterval: (query) => {
      // Poll every 3s if any source is pending or processing
      const hasProcessing = (query.state.data as Source[])?.some((s) => s.status === 'pending' || s.status === 'processing')
      return hasProcessing ? 3000 : false
    }
  })

  // Add Link/Sitemap/Text
  const { mutate: addSource, isPending: addingSource } = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      const { type, ...data } = payload;
      return fetchApi(`/api/v1/bots/${botId}/sources/${type}`, {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources', botId] })
      toast({ title: "Success", description: "Source queued for processing." })
      setUrl(''); setSitemap(''); setTextName(''); setText('')
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  })

  // Upload PDF
  const { mutate: uploadFile, isPending: uploading } = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected")
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/bots/${botId}/sources/pdf`, {
        method: "POST",
        body: formData,
        headers: {
           // Let browser set content-type with boundary automatically for form-data
          'Authorization': `Bearer ${useStore.getState().token}`
        }
      })
      if (!res.ok) throw new Error("Upload failed")
      return res.json()
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['sources', botId] })
       toast({ title: "Success", description: "File uploaded and queued." })
       setFile(null)
       // Reset standard input strictly
       if (typeof document !== 'undefined') {
          const el = document.getElementById('file-upload') as HTMLInputElement
          if (el) el.value = ''
       }
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  })

  const { mutate: deleteSource } = useMutation({
    mutationFn: (sourceId: string) => fetchApi(`/api/v1/bots/${botId}/sources/${sourceId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources', botId] }),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Sources</h1>
        <p className="text-slate-500">Train your bot on customized proprietary data.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Source</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pdf" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="pdf">PDF File</TabsTrigger>
              <TabsTrigger value="url">Web URL</TabsTrigger>
              <TabsTrigger value="sitemap">Sitemap</TabsTrigger>
              <TabsTrigger value="text">Raw Text</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pdf" className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-10 flex flex-col items-center justify-center">
                <UploadCloud className="h-10 w-10 text-slate-400 mb-2" />
                <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
                <p className="text-xs text-slate-500 mb-4">PDF up to 10MB</p>
                <Input id="file-upload" type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="max-w-xs" />
              </div>
              <Button onClick={() => uploadFile()} disabled={uploading || !file}>
                {uploading ? "Uploading..." : "Train on File"}
              </Button>
            </TabsContent>
            
            <TabsContent value="url" className="space-y-4">
              <Input placeholder="https://example.com/about" value={url} onChange={e => setUrl(e.target.value)} />
              <Button onClick={() => addSource({ type: "url", name: url, url: url })} disabled={addingSource || !url}>Train on URL</Button>
            </TabsContent>
            
            <TabsContent value="sitemap" className="space-y-4">
              <Input placeholder="https://example.com/sitemap.xml" value={sitemap} onChange={e => setSitemap(e.target.value)} />
              <Button onClick={() => addSource({ type: "sitemap", name: sitemap, url: sitemap })} disabled={addingSource || !sitemap}>Train on Sitemap</Button>
            </TabsContent>
            
            <TabsContent value="text" className="space-y-4">
              <Input placeholder="Document Title" value={textName} onChange={e => setTextName(e.target.value)} />
              <Textarea placeholder="Paste your text content here..." rows={6} value={text} onChange={e => setText(e.target.value)} />
              <Button onClick={() => addSource({ type: "text", name: textName || "Raw Text", content: text })} disabled={addingSource || !text}>Train on Text</Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Sources ({sources?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : (
            <div className="rounded-md border border-slate-200">
              {sources?.map((s: Source, i: number) => (
                <div key={s.id} className={`flex items-center justify-between p-4 ${i !== sources.length - 1 ? 'border-b border-slate-200' : ''}`}>
                  <div className="flex items-center gap-4">
                    {s.type === 'pdf' ? <FileText className="h-5 w-5 text-indigo-500" /> : 
                     s.type === 'text' ? <FileText className="h-5 w-5 text-slate-500" /> : 
                     s.type === 'sitemap' ? <Globe className="h-5 w-5 text-emerald-500" /> : 
                     <Globe className="h-5 w-5 text-blue-500" />}
                    <div>
                      <h4 className="font-medium text-sm">{s.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={s.status} />
                        <span className="text-xs text-slate-500 uppercase">{s.type}</span>
                        {s.status === 'ready' && <span className="text-xs text-slate-500">• {s.chunk_count} chunks</span>}
                        {s.status === 'failed' && <span className="text-xs text-red-500">• {s.error_msg}</span>}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { if(confirm("Are you sure?")) deleteSource(s.id) }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              {sources?.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">No sources added yet.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
    </div>
  )
}

// Importing useStore implicitly for the File Upload boundary
import { useStore } from '@/lib/store'
