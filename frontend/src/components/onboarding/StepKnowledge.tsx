import * as React from 'react';
import { Globe, FileText, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";

interface Props {
  botId: string | null;
  uploadType: 'url' | 'pdf';
  setUploadType: (v: 'url' | 'pdf') => void;
  urlInput: string;
  setUrlInput: (v: string) => void;
  fileInput: File | null;
  setFileInput: (v: File | null) => void;
  onNext: () => void;
}

export function StepKnowledge({ 
  botId, uploadType, setUploadType, 
  urlInput, setUrlInput, 
  fileInput, setFileInput, 
  onNext 
}: Props) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleUploadKnowledge = async () => {
    if (!botId) return;
    setIsUploading(true);
    setError(null);
    try {
      if (uploadType === 'url') {
        if (!urlInput) throw new Error("Please enter a URL");
        await fetchApi(`/api/v1/bots/${botId}/sources/url`, { 
          method: 'POST', 
          body: JSON.stringify({ name: "Website", url: urlInput }) 
        });
      } else {
        if (!fileInput) throw new Error("Please select a file");
        const fd = new FormData();
        fd.append("file", fileInput);
        await fetchApi(`/api/v1/bots/${botId}/sources/pdf`, { 
          method: 'POST', 
          body: fd 
        });
      }
      onNext();
    } catch (err: any) {
      setError(err.message || "Failed to upload knowledge base");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="text-xs text-text-tertiary mb-4 font-medium uppercase tracking-wider">Step 4 of 7</div>
      <h1 className="text-xl font-semibold text-text-primary mb-2">Upload your knowledge base</h1>
      <p className="text-sm text-text-secondary mb-6">What should your AI assistant learn from?</p>

      <div className="flex gap-2 mb-6">
        <div 
          onClick={() => setUploadType('url')}
          className={`flex-1 p-3 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${uploadType === 'url' ? 'bg-brand/10 border-brand text-brand' : 'bg-bg-tertiary border-border-default text-text-secondary hover:border-text-tertiary'}`}
        >
          <Globe className="w-6 h-6" />
          <span className="text-xs font-medium">Website URL</span>
        </div>
        <div 
          onClick={() => setUploadType('pdf')}
          className={`flex-1 p-3 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${uploadType === 'pdf' ? 'bg-brand/10 border-brand text-brand' : 'bg-bg-tertiary border-border-default text-text-secondary hover:border-text-tertiary'}`}
        >
          <FileText className="w-6 h-6" />
          <span className="text-xs font-medium">PDF Document</span>
        </div>
      </div>

      {uploadType === 'url' ? (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Your Website Link</label>
          <input 
            autoFocus 
            value={urlInput} 
            onChange={e => setUrlInput(e.target.value)} 
            placeholder="https://example.com" 
            className="w-full text-[16px] px-4 py-3 bg-bg-tertiary border border-border-default rounded-[10px] text-text-primary outline-none focus:border-brand transition-colors" 
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Select PDF File</label>
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={e => setFileInput(e.target.files?.[0] || null)} 
            className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20" 
          />
        </div>
      )}

      {error && <div className="text-xs text-danger mt-4">{error}</div>}

      <div className="mt-auto pt-6 flex flex-col gap-3">
        <Button 
          onClick={handleUploadKnowledge} 
          disabled={isUploading || (uploadType === 'url' && !urlInput) || (uploadType === 'pdf' && !fileInput)} 
          className="w-full h-[52px] bg-brand hover:bg-brand-hover text-white rounded-xl font-medium border-none"
        >
          {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : "Train my Assistant"}
        </Button>
        <div onClick={onNext} className="text-xs text-text-tertiary text-center cursor-pointer hover:text-text-primary transition-colors">
          Skip for now →
        </div>
      </div>
    </>
  );
}
