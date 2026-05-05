"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from "@/utils/supabase/client"
import { Loader2, ArrowUp, Copy } from 'lucide-react'
import { Button } from "@/components/ui/button"

type Screen = 1 | 2 | 3 | 4 | 5 | 6

type ClassifyResult = {
  business_type: string
  display_name: string
  theme_color: string
  suggested_questions: string[]
}

type ChatMessage = {
  role: 'bot' | 'user'
  text: string
}

export default function OnboardingFlow() {
  const router = useRouter()
  
  // Base State
  const [screen, setScreen] = useState<Screen>(1)
  const [businessDescription, setBusinessDescription] = useState("")
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null)
  const [ownerName, setOwnerName] = useState("")
  const [phone, setPhone] = useState("")
  const [botId, setBotId] = useState<string | null>(null)
  const [botSlug, setBotSlug] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiDone, setApiDone] = useState(false)
  const [animStep, setAnimStep] = useState(0)
  const [showChips, setShowChips] = useState(false)

  // Screen 4 State (Train)
  const [trainStep, setTrainStep] = useState<number>(0)
  const [trainAnswers, setTrainAnswers] = useState<string[]>([])
  const [currentInput, setCurrentInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Screen 5 State (Test)
  const [testMessages, setTestMessages] = useState<ChatMessage[]>([])
  const [testInput, setTestInput] = useState("")
  const [hasTestedBot, setHasTestedBot] = useState(false)
  const testMessagesEndRef = useRef<HTMLDivElement>(null)

  // Screen 6 State (Deploy)
  const [playgroundUrl, setPlaygroundUrl] = useState("")
  const [embedCode, setEmbedCode] = useState("")
  const [showEmbedCode, setShowEmbedCode] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  // API helper
  const api = async (path: string, body: any) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error("No active session found")
    
    const res = await fetch(
      (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1' + path,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + session.access_token
        },
        body: JSON.stringify(body)
      }
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isTyping])

  useEffect(() => {
    testMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [testMessages, isTyping])

  // --- SCREEN 1 LOGIC ---
  const handleClassify = async () => {
    if (businessDescription.length < 2) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await api('/onboarding/classify', { description: businessDescription })
      setClassifyResult(result)
      setScreen(2)
    } catch (err: any) {
      setError(err.message || "Failed to analyze business.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (screen === 1) {
      const timer = setTimeout(() => setShowChips(true), 500)
      return () => clearTimeout(timer)
    }
  }, [screen])

  // --- SCREEN 3 LOGIC ---
  useEffect(() => {
    if (screen !== 3) return

    let intervalId: NodeJS.Timeout
    const startAnimation = async () => {
      intervalId = setInterval(() => {
        setAnimStep(prev => prev + 1)
      }, 700)

      try {
        const result = await api('/onboarding/setup', {
          business_type: classifyResult?.business_type,
          business_name: ownerName + "'s " + classifyResult?.display_name,
          display_name: classifyResult?.display_name,
          theme_color: classifyResult?.theme_color,
          owner_name: ownerName,
          phone: "+91" + phone,
          suggested_questions: classifyResult?.suggested_questions
        })
        setBotId(result.bot_id)
        setBotSlug(result.bot_slug)
        setApiDone(true)
      } catch (err: any) {
        setError(err.message || "Failed to setup workspace.")
        clearInterval(intervalId)
      }
    }
    
    startAnimation()
    return () => { if (intervalId) clearInterval(intervalId) }
  }, [screen])

  useEffect(() => {
    if (screen === 3 && animStep >= 4 && apiDone) {
      setTimeout(() => {
        setScreen(4)
      }, 500)
    }
  }, [screen, animStep, apiDone])

  // --- SCREEN 4 LOGIC ---
  useEffect(() => {
    if (screen === 4 && chatMessages.length === 0) {
      const t1 = setTimeout(() => {
        setChatMessages([{ role: 'bot', text: `Hi ${ownerName}! I'm your new AI assistant. I need to learn a few things about your business. Ready?` }])
      }, 600)
      const t2 = setTimeout(() => {
        if (classifyResult?.suggested_questions) {
          setChatMessages(prev => [...prev, { role: 'bot', text: classifyResult.suggested_questions[0] }])
        }
      }, 1500)
      return () => { clearTimeout(t1); clearTimeout(t2); }
    }
  }, [screen])

  const handleTrainSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentInput.trim()) return

    const answer = currentInput
    const question = classifyResult?.suggested_questions[trainStep] || ""
    
    setChatMessages(prev => [...prev, { role: 'user', text: answer }])
    setCurrentInput("")
    setIsTyping(true)

    // Fire and forget
    api('/onboarding/train', {
      bot_id: botId,
      question: question,
      answer: answer
    }).catch(console.error)

    setTimeout(() => {
      setIsTyping(false)
      if (trainStep < 2) {
        setChatMessages(prev => [...prev, { role: 'bot', text: "Got it! ✓" }])
        setTimeout(() => {
          if (classifyResult?.suggested_questions) {
            setChatMessages(prev => [...prev, { role: 'bot', text: classifyResult.suggested_questions[trainStep + 1] }])
          }
          setTrainStep(prev => prev + 1)
        }, 500)
      } else {
        setChatMessages(prev => [...prev, { role: 'bot', text: "Perfect! I've learned 3 key things about your business. Let me show you what I can do!" }])
        setTimeout(() => {
          setScreen(5)
        }, 1500)
      }
    }, 1000)
  }

  // --- SCREEN 5 LOGIC ---
  useEffect(() => {
    if (screen === 5 && testMessages.length === 0) {
      const t = setTimeout(() => {
        setTestMessages([{ role: 'bot', text: `Hi! I'm ${ownerName}'s assistant. How can I help you today?` }])
      }, 600)
      return () => clearTimeout(t)
    }
  }, [screen])

  const handleTestSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!testInput.trim()) return

    const msg = testInput
    setTestMessages(prev => [...prev, { role: 'user', text: msg }])
    setTestInput("")
    setIsTyping(true)

    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1/chat/' + botSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          session_id: 'onboarding-test',
          channel: 'web'
        })
      })
      const data = await res.json()
      setTestMessages(prev => [...prev, { role: 'bot', text: data.response || "I didn't get that." }])
      setHasTestedBot(true)
    } catch (err) {
      setTestMessages(prev => [...prev, { role: 'bot', text: "Sorry, I'm having trouble connecting right now." }])
    } finally {
      setIsTyping(false)
    }
  }

  // --- SCREEN 6 LOGIC ---
  useEffect(() => {
    if (screen === 6) {
      const completeOnboarding = async () => {
        setIsCompleting(true)
        try {
          const result = await api('/onboarding/complete', { bot_id: botId })
          setPlaygroundUrl(result.playground_url)
          setEmbedCode(`<script src="https://wraft.in/widget.js" data-bot-slug="${botSlug}"></script>`)
        } catch (err) {
          console.error("Failed to complete onboarding:", err)
        } finally {
          setIsCompleting(false)
        }
      }
      completeOnboarding()
    }
  }, [screen])


  // --- RENDER HELPERS ---
  const widthClass = {
    1: "w-1/6", 2: "w-2/6", 3: "w-3/6", 4: "w-4/6", 5: "w-5/6", 6: "w-full"
  }[screen]

  const renderProgressBar = () => (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-20 bg-border-default">
      <div className={`h-full bg-brand transition-all duration-400 ease-out ${widthClass}`} />
    </div>
  )

  const renderBackground = () => (
    <div className="fixed inset-0 z-0 bg-[url('/dashboard-preview.png')] bg-cover blur-[8px] brightness-[0.3] scale-105" />
  )

  const chips = ["dental clinic", "coaching institute", "restaurant", "kirana shop", "real estate"]

  const steps = [
    "Creating your AI assistant...",
    "Setting up language support...",
    `Loading templates for ${classifyResult?.display_name || 'your business'}...`,
    "Your bot is ready! 🎉"
  ]

  const ChatBubble = ({ msg }: { msg: ChatMessage }) => {
    const isBot = msg.role === 'bot'
    return (
      <div className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'}`}>
        <div className={`max-w-[85%] px-4 py-2.5 text-sm ${isBot ? 'bg-bg-tertiary rounded-2xl rounded-tl-sm text-text-primary' : 'bg-brand rounded-2xl rounded-tr-sm text-white'}`}>
          {msg.text}
        </div>
      </div>
    )
  }

  return (
    <>
      {renderBackground()}
      {renderProgressBar()}

      <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
        
        {/* --- SCREENS 1, 2, 4, 5, 6 CARD CONTAINER --- */}
        {screen !== 3 && (
          <div key={screen} className="w-full max-w-[440px] bg-bg-secondary border border-border-default rounded-2xl p-8 relative z-10 animate-[slideUp_0.25s_ease_forwards] flex flex-col min-h-[420px]">
            
            {/* --- SCREEN 1 --- */}
            {screen === 1 && (
              <>
                <div className="text-xs text-text-tertiary mb-6 font-medium uppercase tracking-wider">
                  Step 1 of 6 — Let's set up your AI assistant
                </div>
                
                <h1 className="text-xl font-semibold text-text-primary mb-2">
                  What kind of business do you run?
                </h1>
                
                <p className="text-sm text-text-secondary mb-6">
                  Describe it in a few words — we'll handle the rest
                </p>

                <input
                  value={businessDescription}
                  onChange={e => setBusinessDescription(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && businessDescription.length >= 2) {
                      handleClassify()
                    }
                  }}
                  placeholder="e.g. dental clinic, mobile repair shop..."
                  className="w-full text-[16px] px-4 py-3 bg-bg-tertiary border border-border-default rounded-[10px] text-text-primary outline-none focus:border-brand transition-colors"
                />

                {showChips && (
                  <div className="flex flex-wrap gap-2 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {chips.map(chip => (
                      <div
                        key={chip}
                        onClick={() => setBusinessDescription(chip)}
                        className="bg-bg-tertiary border border-border-default text-text-secondary text-xs rounded-full px-3 py-1.5 cursor-pointer hover:border-brand hover:text-brand transition-colors"
                      >
                        {chip}
                      </div>
                    ))}
                  </div>
                )}

                {businessDescription.length > 2 && !isLoading && (
                  <div className="text-xs text-brand mt-4 animate-in fade-in">
                    Setting up for {businessDescription}...
                  </div>
                )}
                
                {error && <div className="text-xs text-danger mt-4">{error}</div>}

                <div className="mt-auto pt-6">
                  <Button
                    onClick={handleClassify}
                    disabled={businessDescription.length < 2 || isLoading}
                    className="w-full h-[52px] bg-brand hover:bg-brand-hover text-white rounded-xl font-medium text-[15px] transition-opacity disabled:opacity-40 disabled:cursor-not-allowed border-none"
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* --- SCREEN 2 --- */}
            {screen === 2 && (
              <>
                <div 
                  onClick={() => setScreen(1)}
                  className="absolute top-6 left-6 text-xs text-text-tertiary cursor-pointer hover:text-text-primary transition-colors"
                >
                  ← Back
                </div>
                
                <div className="mt-8 text-xs text-text-tertiary mb-4 font-medium uppercase tracking-wider">
                  Step 2 of 6
                </div>

                {classifyResult && (
                  <div className="bg-brand-muted text-brand text-xs rounded-full px-3 py-1 inline-flex items-center gap-1 mb-6 border border-brand/20 self-start">
                    <span className="font-bold">✓</span> {classifyResult.display_name}
                  </div>
                )}

                <h1 className="text-xl font-semibold text-text-primary mb-2">
                  Tell us about yourself
                </h1>
                <p className="text-sm text-text-secondary mb-6">
                  We'll personalize your assistant
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">Your name</label>
                    <input
                      autoFocus
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full text-[16px] px-4 py-3 bg-bg-tertiary border border-border-default rounded-[10px] text-text-primary outline-none focus:border-brand transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">WhatsApp number</label>
                    <div className="flex">
                      <div className="bg-bg-tertiary border border-border-default border-r-0 rounded-l-xl px-3 h-[52px] text-text-secondary flex items-center justify-center min-w-[50px] font-medium text-[16px] transition-colors focus-within:border-brand">
                        +91
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhone(val);
                        }}
                        placeholder="98765 43210"
                        className="flex-1 text-[16px] px-4 py-3 bg-bg-tertiary border border-border-default border-l-0 rounded-r-xl text-text-primary outline-none h-[52px] transition-colors focus:border-brand focus:border-l"
                      />
                    </div>
                    <div className="text-xs text-text-tertiary mt-2">
                      📱 We'll send you a WhatsApp when your bot is ready
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8">
                  <Button
                    onClick={() => setScreen(3)}
                    disabled={ownerName.length < 2 || phone.length < 10}
                    className="w-full h-[52px] bg-brand hover:bg-brand-hover text-white rounded-xl font-medium text-[15px] transition-opacity disabled:opacity-40 disabled:cursor-not-allowed border-none"
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}

            {/* --- SCREEN 4 --- */}
            {screen === 4 && (
              <div className="flex flex-col h-full flex-1">
                <div className="flex items-center gap-3 border-b border-border-default pb-4 mb-2">
                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white font-bold text-sm">
                    W
                  </div>
                  <span className="text-xs text-text-secondary">{ownerName}'s Assistant · Setting up</span>
                </div>

                <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-3 min-h-[200px]">
                  {chatMessages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
                  {isTyping && (
                    <div className="flex w-full justify-start">
                      <div className="max-w-[85%] px-4 py-3 bg-bg-tertiary rounded-2xl rounded-tl-sm text-text-primary flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce delay-150"></div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="mt-auto border-t border-border-default pt-4">
                  <form onSubmit={handleTrainSubmit} className="relative flex items-center">
                    <input
                      value={currentInput}
                      onChange={e => setCurrentInput(e.target.value)}
                      placeholder="Type your answer..."
                      className="w-full text-[16px] pl-4 pr-12 py-2.5 bg-bg-tertiary border border-border-default rounded-full text-text-primary outline-none focus:border-brand transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!currentInput.trim() || isTyping}
                      className="absolute right-1 w-9 h-9 bg-brand rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-5 h-5" />
                    </button>
                  </form>
                  <div 
                    onClick={() => setScreen(5)}
                    className="text-xs text-text-tertiary text-center cursor-pointer mt-4 hover:text-text-primary transition-colors"
                  >
                    Skip for now →
                  </div>
                </div>
              </div>
            )}

            {/* --- SCREEN 5 --- */}
            {screen === 5 && (
              <div className="flex flex-col h-full flex-1">
                <div className="text-xs text-text-tertiary mb-2 font-medium uppercase tracking-wider">
                  Step 5 of 6
                </div>
                
                <h1 className="text-xl font-semibold text-text-primary mb-1">
                  Now test your bot
                </h1>
                <p className="text-sm text-text-secondary mb-4">
                  Ask it something a customer would ask
                </p>

                {!hasTestedBot && classifyResult?.suggested_questions && classifyResult.suggested_questions.length > 0 && (
                  <div 
                    onClick={() => { setTestInput(classifyResult.suggested_questions[0]); handleTestSubmit(); }}
                    className="bg-brand-muted text-brand text-sm rounded-full px-4 py-2 cursor-pointer mb-4 inline-block hover:bg-brand/20 transition-colors self-start border border-brand/20"
                  >
                    Try: '{classifyResult.suggested_questions[0]}'
                  </div>
                )}

                <div className="h-[200px] overflow-y-auto border border-border-default rounded-xl bg-bg-primary/50 p-3 flex flex-col gap-3 mb-4">
                  {testMessages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
                  {isTyping && (
                    <div className="flex w-full justify-start">
                      <div className="max-w-[85%] px-4 py-3 bg-bg-tertiary rounded-2xl rounded-tl-sm text-text-primary flex items-center gap-1 border border-border-default">
                        <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce delay-150"></div>
                      </div>
                    </div>
                  )}
                  <div ref={testMessagesEndRef} />
                </div>

                {hasTestedBot && (
                  <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-xs text-success animate-in slide-in-from-bottom-2 flex items-center gap-2 mb-4">
                    <span className="text-base">🎉</span> Your bot just answered its first question!
                  </div>
                )}

                <div className="mt-auto">
                  <form onSubmit={handleTestSubmit} className="relative flex items-center mb-4">
                    <input
                      value={testInput}
                      onChange={e => setTestInput(e.target.value)}
                      placeholder="Type a message..."
                      className="w-full text-[16px] pl-4 pr-12 py-2.5 bg-bg-tertiary border border-border-default rounded-full text-text-primary outline-none focus:border-brand transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!testInput.trim() || isTyping}
                      className="absolute right-1 w-9 h-9 bg-brand rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-5 h-5" />
                    </button>
                  </form>
                  
                  {hasTestedBot ? (
                    <Button 
                      onClick={() => setScreen(6)}
                      className="w-full h-[52px] bg-brand hover:bg-brand-hover text-white rounded-xl font-medium text-[15px] border-none"
                    >
                      Deploy my bot →
                    </Button>
                  ) : (
                    <div 
                      onClick={() => setScreen(6)}
                      className="text-xs text-text-tertiary text-center cursor-pointer hover:text-text-primary transition-colors mt-2"
                    >
                      Skip — I'll test later →
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- SCREEN 6 --- */}
            {screen === 6 && (
              <div className="flex flex-col h-full flex-1 items-center">
                <div className="text-xs text-text-tertiary w-full text-left mb-6 font-medium uppercase tracking-wider">
                  Step 6 of 6
                </div>

                <div className="text-5xl mb-4">🎉</div>
                
                <h1 className="text-xl font-semibold text-text-primary text-center mb-2">
                  Your bot is live!
                </h1>
                
                <p className="text-sm text-text-secondary text-center mb-8">
                  Share it with your customers
                </p>

                {isCompleting ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 text-brand animate-spin mb-4" />
                    <p className="text-sm text-text-secondary">Finalizing your workspace...</p>
                  </div>
                ) : (
                  <div className="w-full space-y-3 mt-auto">
                    <button
                      onClick={() => {
                        const text = encodeURIComponent("Chat with our AI assistant: " + playgroundUrl)
                        if (navigator.share) {
                          navigator.share({ title: 'Chat with our assistant', url: playgroundUrl })
                        } else {
                          window.open('https://wa.me/?text=' + text, '_blank')
                        }
                      }}
                      className="w-full h-[52px] flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-medium transition-colors"
                    >
                      <span>📱</span> Share on WhatsApp
                    </button>

                    <button
                      onClick={() => setShowEmbedCode(!showEmbedCode)}
                      className="w-full h-[48px] bg-bg-tertiary hover:bg-bg-elevated border border-border-default text-text-primary rounded-xl font-medium transition-colors"
                    >
                      🌐 Add to your website
                    </button>

                    {showEmbedCode && (
                      <div className="bg-bg-tertiary border border-border-default rounded-xl p-3 mt-2 relative animate-in fade-in slide-in-from-top-1">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(embedCode)
                            // Basic toast could be added here
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-bg-secondary hover:bg-bg-primary border border-border-default rounded-md text-text-secondary hover:text-text-primary transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <pre className="font-mono text-[11px] text-text-secondary whitespace-pre-wrap pr-8">
                          {embedCode}
                        </pre>
                      </div>
                    )}

                    <div 
                      onClick={() => router.push('/dashboard')}
                      className="text-sm text-brand font-medium text-center cursor-pointer hover:underline mt-6 pt-4"
                    >
                      Go to Dashboard →
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- SCREEN 3 --- (No card background, centered content) */}
        {screen === 3 && (
          <div key={screen} className="w-full max-w-md flex flex-col items-center justify-center text-center p-6 relative z-10 animate-[slideUp_0.25s_ease_forwards]">
            {error && <div className="bg-danger-muted text-danger p-4 rounded-lg mb-6 w-full text-sm border border-danger/20">{error}</div>}
            
            <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border-default flex items-center justify-center shadow-lg animate-pulse mb-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-brand/10"></div>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6L8 18L12 10L16 18L20 6" stroke="currentColor" className="text-brand" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>

            <div className="w-full text-left bg-bg-secondary/60 backdrop-blur-md p-6 rounded-2xl border border-border-default/50">
              {steps.map((step, i) => (
                i <= animStep && (
                  <div key={i} className={`flex items-center gap-3 mb-4 last:mb-0 animate-[fadeIn_0.4s_ease_forwards] ${i === animStep && !apiDone && animStep < 4 ? 'text-text-primary' : 'text-text-secondary'}`}>
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
                       <span className="text-success text-[14px] font-bold">✓</span>
                    </div>
                    <span className="text-[15px] font-medium">{step}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}
