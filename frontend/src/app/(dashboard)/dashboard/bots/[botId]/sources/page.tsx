"use client"

import * as React from "react"
import { useState } from "react"
import { 
  FileText, Globe, Map, Type, Trash2, ChevronDown, RefreshCw, AlertCircle, Plus, Loader2
} from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useSources, useDeleteSource, useRetrainSource, useUpdateSource, useCreateSource } from "@/hooks/api/useSources"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useProfileWithPlan } from "@/hooks/api/useBilling"
import { FeatureGate } from "@/components/ui/FeatureGate"

type SourceModalType = 'pdf' | 'url' | 'sitemap' | 'text' | null;

export default function BotSourcesPage(props: { params: any }) {
  const params = React.use(props.params as Promise<{ botId: string }>)
  const { data: sourcesResp, isLoading } = useSources(params.botId)
  const sources = sourcesResp || []
  const { toast } = useToast()
  
  const deleteSource = useDeleteSource()
  const retrainSource = useRetrainSource()
  const updateSource = useUpdateSource()
  const createSource = useCreateSource()
  const { data: profile } = useProfileWithPlan()

  const [activeModal, setActiveModal] = useState<SourceModalType>(null)
  
  // Modal states
  const [urlInput, setUrlInput] = useState("")
  const [textName, setTextName] = useState("")
  const [textContent, setTextContent] = useState("")
  const [fileInput, setFileInput] = useState<File | null>(null)
  
  const handleDelete = (sourceId: string) => {
    if (confirm("Permanently delete this data source?")) {
      deleteSource.mutate({ botId: params.botId, sourceId }, {
        onSuccess: () => toast({ title: "Deleted", description: "Source removed successfully." })
      })
    }
  }
  
  const handleRetrain = (sourceId: string) => {
    retrainSource.mutate({ botId: params.botId, sourceId }, {
      onSuccess: () => toast({ title: "Retraining started", description: "The AI is relearning this source." })
    })
  }
  
  const handleToggleRetrain = (sourceId: string, checked: boolean) => 
    updateSource.mutate({ botId: params.botId, sourceId, options: { auto_retrain: checked } })
    
  const handleRetrainFrequency = (sourceId: string, frequency: 'daily' | 'weekly' | 'monthly') => 
    updateSource.mutate({ botId: params.botId, sourceId, options: { retrain_frequency: frequency } })

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
  
  const resetModal = () => {
    setActiveModal(null)
    setUrlInput("")
    setTextName("")
    setTextContent("")
    setFileInput(null)
  }

  const handleCreate = () => {
    if (!activeModal) return;

    let payload: any;
    
    if (activeModal === 'url' || activeModal === 'sitemap') {
      if (!urlInput.trim()) return toast({ title: "Error", description: "URL is required.", variant: "destructive" });
      payload = { 
        url: urlInput.trim(),
        name: activeModal === 'url' ? 'Web URL' : 'Sitemap'
      };
    } else if (activeModal === 'text') {
      if (!textName.trim() || !textContent.trim()) return toast({ title: "Error", description: "Name and content are required.", variant: "destructive" });
      payload = { name: textName.trim(), content: textContent.trim() };
    } else if (activeModal === 'pdf') {
      if (!fileInput) return toast({ title: "Error", description: "A PDF file is required.", variant: "destructive" });
      payload = new FormData();
      payload.append("file", fileInput);
    }

    createSource.mutate({ botId: params.botId, type: activeModal, payload }, {
      onSuccess: () => {
        toast({ title: "Source Added", description: "Data source has been queued for processing." });
        resetModal();
      },
      onError: (err: any) => {
        toast({ title: "Failed to add source", description: err.message, variant: "destructive" });
      }
    });
  }

  const getIconForType = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="h-4 w-4 text-brand" />;
      case 'url': return <Globe className="h-4 w-4 text-success" />;
      case 'sitemap': return <Map className="h-4 w-4 text-warning" />;
      case 'text': return <Type className="h-4 w-4 text-text-primary" />;
      default: return <FileText className="h-4 w-4 text-text-tertiary" />;
    }
  }

  const getBackgroundForType = (type: string) => {
    switch (type) {
      case 'pdf': return "bg-brand/10 border-brand/20";
      case 'url': return "bg-success/10 border-success/20";
      case 'sitemap': return "bg-warning/10 border-warning/20";
      case 'text': return "bg-bg-elevated border-border-default";
      default: return "bg-bg-tertiary border-border-default";
    }
  }

  return (
    <div className="pb-10 animate-in fade-in duration-500">
      <PageHeader 
        title="Data Sources" 
        description="Manage the knowledge base connected exclusively to this bot."
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add source <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-bg-elevated border-border-default">
            <DropdownMenuItem className="cursor-pointer focus:bg-bg-tertiary focus:text-text-primary py-2" onSelect={() => setActiveModal('pdf')}>
              <FileText className="mr-2 h-4 w-4 text-brand" /> PDF Document
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer focus:bg-bg-tertiary focus:text-text-primary py-2" onSelect={() => setActiveModal('url')}>
              <Globe className="mr-2 h-4 w-4 text-success" /> Web URL
            </DropdownMenuItem>
            <FeatureGate hasAccess={profile?.plans?.sitemap_source === true} requiredPlan="Starter">
              <DropdownMenuItem className="cursor-pointer focus:bg-bg-tertiary focus:text-text-primary py-2" onSelect={() => setActiveModal('sitemap')}>
                <Map className="mr-2 h-4 w-4 text-warning" /> Sitemap
              </DropdownMenuItem>
            </FeatureGate>
            <DropdownMenuItem className="cursor-pointer focus:bg-bg-tertiary focus:text-text-primary py-2" onSelect={() => setActiveModal('text')}>
              <Type className="mr-2 h-4 w-4 text-text-primary" /> Raw Text
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      <div className="flex flex-col gap-4 mt-6">
        {isLoading && (
          <div className="flex flex-col gap-4">
             {[1, 2, 3].map(i => (
               <div key={i} className="h-24 bg-bg-secondary border border-border-default rounded-xl animate-pulse" />
             ))}
          </div>
        )}
        
        {sources.length === 0 && !isLoading && (
          <div className="p-20 text-center bg-bg-secondary rounded-xl border border-dashed border-border-default">
            <div className="bg-bg-tertiary w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
               <Database className="h-6 w-6 text-text-tertiary" />
            </div>
            <h3 className="text-text-primary font-medium mb-1">No data sources discovered</h3>
            <p className="text-text-secondary text-sm max-w-xs mx-auto">Start by uploading a PDF or linking a URL to train your assistant.</p>
            <Button variant="outline" className="mt-6 h-9" onClick={() => setActiveModal('url')}>Connect first source</Button>
          </div>
        )}

        {sources.map((source: any) => (
          <div 
            key={source.id} 
            className={`
              flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-xl border bg-bg-secondary transition-all hover:shadow-sm
              ${source.status === 'processing' ? 'border-brand/40 shadow-brand-glow/10 animate-pulse-brand' : 'border-border-default hover:border-border-hover'}
              ${source.status === 'failed' ? 'border-danger/30 bg-danger/5' : ''}
            `}
          >
            {/* Left Box: Identity */}
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
              <div className={`h-11 w-11 flex items-center justify-center rounded-full border shadow-sm ${getBackgroundForType(source.type)}`}>
                {getIconForType(source.type)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-text-primary text-sm line-clamp-1 break-all max-w-[200px] md:max-w-[400px]">
                    {source.name}
                  </h4>
                  <Badge variant="outline" className="text-[9px] py-0 h-4 uppercase font-bold tracking-tighter bg-bg-tertiary border-none">
                    {source.type}
                  </Badge>
                </div>
                {/* Error rendering inline if failed */}
                {source.status === 'failed' && (
                  <p className="text-[11px] text-danger mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3 w-3 shrink-0" /> 
                    <span className="truncate max-w-[200px] md:max-w-[400px]">
                      {(source.error_msg || source.error || "Training failed").length > 80 
                        ? (source.error_msg || source.error || "Training failed").substring(0, 80) + '...'
                        : (source.error_msg || source.error || "Training failed")}
                    </span>
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 lg:hidden">
                   {source.status === 'ready' && <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-widest">{source.chunk_count || source.chunks || 0} chunks</span>}
                </div>
              </div>
            </div>

            {/* Middle Box: Data Specs */}
            {source.status === 'ready' && (
              <div className="hidden lg:flex flex-col mx-8 flex-1">
                <span className="text-sm font-semibold text-text-primary">{source.chunk_count || source.chunks || 0} chunks</span>
                <span className="text-[11px] text-text-tertiary uppercase tracking-widest font-bold">Stored Knowledge</span>
              </div>
            )}
            {source.type === 'pdf' && source.file_size_bytes != null && (
              <div className="hidden lg:flex flex-col mx-8 flex-1">
                <span className="text-sm font-semibold text-text-primary">
                  {source.file_size_bytes < 1024 
                    ? `${source.file_size_bytes} B` 
                    : source.file_size_bytes < 1048576 
                    ? `${(source.file_size_bytes / 1024).toFixed(1)} KB` 
                    : `${(source.file_size_bytes / 1048576).toFixed(1)} MB`}
                </span>
                <span className="text-[11px] text-text-tertiary uppercase tracking-widest font-bold">File Size</span>
              </div>
            )}
            {(source.type === 'url' || source.type === 'sitemap') && source.last_retrained_at && (
              <div className="hidden lg:flex flex-col mx-8 flex-1">
                <span className="text-sm font-semibold text-text-primary">Last updated {formatRelativeTime(source.last_retrained_at)}</span>
                <span className="text-[11px] text-text-tertiary uppercase tracking-widest font-bold">Sync Status</span>
              </div>
            )}

            {/* Right Box: Status & Controls */}
            <div className="flex items-center gap-4 justify-between sm:justify-end border-t border-border-default sm:border-t-0 pt-3 sm:pt-0">
              
              {source.status === 'pending' && <Badge variant="outline" className="h-6 text-warning border-warning/50 bg-warning/10">Pending</Badge>}
              {source.status === 'processing' && <Badge variant="brand" className="animate-pulse h-6"><Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>Processing</Badge>}
              {source.status === 'ready' && <Badge variant="success" className="h-6">Ready</Badge>}
              {source.status === 'failed' && <Badge variant="danger" className="h-6">Failed</Badge>}

              <div className="flex items-center gap-4 ml-2">
                {(source.type === 'url' || source.type === 'sitemap') && (
                  <FeatureGate hasAccess={profile?.plans?.auto_retrain_frequency != null} requiredPlan="Growth">
                    <div className="flex items-center gap-2 bg-bg-tertiary/50 px-2 py-1 rounded-lg">
                      <span className="text-[10px] text-text-tertiary font-bold uppercase hidden md:inline">Auto-sync</span>
                      <Switch 
                         checked={!!source.auto_retrain} 
                         onCheckedChange={(checked) => handleToggleRetrain(source.id, checked)} 
                         className="scale-75"
                      />
                      {source.auto_retrain && (
                        <select 
                          className="bg-transparent text-[10px] font-medium text-text-secondary outline-none border-none cursor-pointer uppercase ml-1"
                          value={source.retrain_frequency || 'weekly'}
                          onChange={(e) => handleRetrainFrequency(source.id, e.target.value as 'daily' | 'weekly' | 'monthly')}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      )}
                    </div>
                  </FeatureGate>
                )}
                
                <div className="flex items-center gap-1 ml-1">
                  {(source.type === 'url' || source.type === 'sitemap') && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-text-tertiary hover:text-brand hover:bg-brand/5" onClick={() => handleRetrain(source.id)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-text-tertiary hover:bg-danger/10 hover:text-danger" onClick={() => handleDelete(source.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* MODALS */}
      <Dialog open={!!activeModal} onOpenChange={(open) => !open && resetModal()}>
        <DialogContent className="bg-bg-secondary border-border-default text-text-primary sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {activeModal === 'pdf' && "Upload PDF Document"}
              {activeModal === 'url' && "Scrape Single URL"}
              {activeModal === 'sitemap' && "Import Entire Sitemap"}
              {activeModal === 'text' && "Add Raw Text"}
            </DialogTitle>
            <DialogDescription className="text-text-secondary">
              {activeModal === 'pdf' && "Upload a PDF containing FAQs, manuals, or company policies."}
              {activeModal === 'url' && "The bot will scrape the visible text content of this webpage."}
              {activeModal === 'sitemap' && "The bot will traverse the sitemap and ingest all listed webpages."}
              {activeModal === 'text' && "Manually paste unstructured text for the bot to learn."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {(activeModal === 'url' || activeModal === 'sitemap') && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Web Address</label>
                <Input 
                  placeholder={activeModal === 'sitemap' ? "https://example.com/sitemap.xml" : "https://example.com/about"}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="bg-bg-primary border-border-default focus:border-brand"
                />
              </div>
            )}

            {activeModal === 'text' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Title / Reference Name</label>
                  <Input 
                    placeholder="e.g. Return Policy Fallback"
                    value={textName}
                    onChange={(e) => setTextName(e.target.value)}
                    className="bg-bg-primary border-border-default focus:border-brand"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Text Content</label>
                  <Textarea 
                    placeholder="Paste the raw text here..."
                    className="min-h-[160px] bg-bg-primary border-border-default focus:border-brand"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                  />
                </div>
              </>
            )}

            {activeModal === 'pdf' && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Select File</label>
                <Input 
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFileInput(e.target.files?.[0] || null)}
                  className="bg-bg-primary border-border-default file:text-text-primary file:bg-bg-elevated file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-md cursor-pointer"
                />
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border-default pt-4">
            <Button variant="ghost" onClick={resetModal} className="text-text-secondary hover:text-text-primary">
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createSource.isPending}
            >
              {createSource.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Import Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Ensure the page doesn't crash if lucide icon is missing
function Database(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  )
}
