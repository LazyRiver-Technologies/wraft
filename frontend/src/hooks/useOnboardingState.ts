import { useState } from 'react';
import { Screen, ClassifyResult, ChatMessage } from '@/types/onboarding';

export function useOnboardingState() {
  const [screen, setScreen] = useState<Screen>(1);
  const [businessDescription, setBusinessDescription] = useState("");
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [botId, setBotId] = useState<string | null>(null);
  const [botSlug, setBotSlug] = useState<string | null>(null);
  
  // Knowledge Base
  const [uploadType, setUploadType] = useState<'url' | 'pdf'>('url');
  const [urlInput, setUrlInput] = useState("");
  const [fileInput, setFileInput] = useState<File | null>(null);
  
  // WhatsApp
  const [waConnected, setWaConnected] = useState(false);
  
  // Chat Testing
  const [testMessages, setTestMessages] = useState<ChatMessage[]>([]);
  const [hasTestedBot, setHasTestedBot] = useState(false);
  
  // Deploy
  const [playgroundUrl, setPlaygroundUrl] = useState("");
  const [embedCode, setEmbedCode] = useState("");

  return {
    // State
    screen, businessDescription, classifyResult, ownerName, phone, 
    botId, botSlug, uploadType, urlInput, fileInput, waConnected, 
    testMessages, hasTestedBot, playgroundUrl, embedCode,
    
    // Setters
    setScreen, setBusinessDescription, setClassifyResult, setOwnerName, setPhone,
    setBotId, setBotSlug, setUploadType, setUrlInput, setFileInput, setWaConnected,
    setTestMessages, setHasTestedBot, setPlaygroundUrl, setEmbedCode
  };
}
