import * as React from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { ChatMessage } from "@/types/onboarding";

interface Props {
  botSlug: string | null;
  ownerName: string;
  testMessages: ChatMessage[];
  setTestMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  hasTestedBot: boolean;
  setHasTestedBot: (v: boolean) => void;
  onNext: () => void;
}

const ChatBubble = ({ msg }: { msg: ChatMessage }) => {
  const isBot = msg.role === 'bot';
  return (
    <div className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] px-4 py-2.5 text-sm ${isBot ? 'bg-bg-tertiary rounded-2xl rounded-tl-sm text-text-primary' : 'bg-brand rounded-2xl rounded-tr-sm text-white'}`}>
        {msg.text}
      </div>
    </div>
  );
};

export function StepTest({ botSlug, ownerName, testMessages, setTestMessages, hasTestedBot, setHasTestedBot, onNext }: Props) {
  const [testInput, setTestInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const testMessagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (testMessages.length === 0) {
      const t = setTimeout(() => {
        setTestMessages([{ role: 'bot', text: `Hi! I'm ${ownerName}'s assistant. I'm processing your knowledge base. Ask me anything!` }]);
      }, 600);
      return () => clearTimeout(t);
    }
  }, []);

  React.useEffect(() => {
    testMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [testMessages, isTyping]);

  const handleTestSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testInput.trim() || !botSlug) return;

    const msg = testInput;
    setTestMessages(prev => [...prev, { role: 'user', text: msg }]);
    setTestInput("");
    setIsTyping(true);

    try {
      const data = await fetchApi(`/api/v1/chat/${botSlug}`, {
        method: 'POST',
        body: JSON.stringify({
          message: msg,
          session_id: 'onboarding-test',
          channel: 'web'
        })
      });
      setTestMessages(prev => [...prev, { role: 'bot', text: data.response || "I didn't get that." }]);
      setHasTestedBot(true);
    } catch (err) {
      setTestMessages(prev => [...prev, { role: 'bot', text: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full flex-1">
      <div className="text-xs text-text-tertiary mb-2 font-medium uppercase tracking-wider">Step 6 of 7</div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Now test your bot</h1>
      <p className="text-sm text-text-secondary mb-4">Ask it something a customer would ask based on what you uploaded</p>
      
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
      
      {hasTestedBot && <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-xs text-success animate-in slide-in-from-bottom-2 flex items-center gap-2 mb-4"><span>🎉</span> Great job testing!</div>}
      
      <div className="mt-auto">
        <form onSubmit={handleTestSubmit} className="relative flex items-center mb-4">
          <input 
            value={testInput} 
            onChange={e => setTestInput(e.target.value)} 
            placeholder="Type a message..." 
            className="w-full text-[16px] pl-4 pr-12 py-2.5 bg-bg-tertiary border border-border-default rounded-full text-text-primary outline-none focus:border-brand transition-colors" 
          />
          <button type="submit" disabled={!testInput.trim() || isTyping} className="absolute right-1 w-9 h-9 bg-brand rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed">
            <ArrowUp className="w-5 h-5" />
          </button>
        </form>
        {hasTestedBot ? (
          <Button onClick={onNext} className="w-full h-[52px] bg-brand hover:bg-brand-hover text-white rounded-xl font-medium border-none">Deploy my bot →</Button>
        ) : (
          <div onClick={onNext} className="text-xs text-text-tertiary text-center cursor-pointer hover:text-text-primary transition-colors mt-2">Skip — I'll test later →</div>
        )}
      </div>
    </div>
  );
}
