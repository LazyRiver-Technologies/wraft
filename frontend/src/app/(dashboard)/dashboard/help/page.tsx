"use client"

import * as React from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Book, MessageCircle, ExternalLink, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function HelpPage() {
  const { toast } = useToast()
  
  const faqs = [
    {
      q: "How do I add a new data source?",
      a: "Navigate to the Data Sources tab in your Bot Dashboard. You can upload PDFs, enter raw text, or provide a URL to crawl."
    },
    {
      q: "How does the AI fallback mechanism work?",
      a: "If the AI cannot confidently answer a question using the provided data sources, it will output the configured Fallback Message and optionally alert you via WhatsApp."
    },
    {
      q: "Can I customize the Chat Widget appearance?",
      a: "Yes! Go to Bot Settings > Appearance. You can change the primary brand color, widget position, and welcome message. Changes reflect instantly in the Live Preview."
    },
    {
      q: "How many bots can I create?",
      a: "The Free plan allows 1 bot. The Pro plan allows up to 5 bots. You can upgrade your plan in the Global Settings."
    }
  ]

  return (
    <>
      <PageHeader 
        title="Help & Support" 
        description="Find answers to common questions, read documentation, or contact our team."
      >
        <Button variant="secondary"><Book className="mr-2 h-4 w-4" /> View full docs</Button>
      </PageHeader>

      <div className="flex flex-col gap-10 max-w-5xl">
        
        {/* Search & Hero */}
        <div className="bg-gradient-to-br from-brand/10 to-brand/5 rounded-2xl p-10 border border-brand/20 flex flex-col items-center justify-center text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-2">How can we help you today?</h2>
          <p className="text-text-secondary mb-8 max-w-lg">Search our knowledge base or browse the frequently asked questions below.</p>
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" />
            <Input 
              placeholder="Search for articles, tutorials, or troubleshooting..." 
              className="pl-12 py-6 text-base bg-white shadow-sm border-transparent focus-visible:ring-brand rounded-xl"
            />
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* FAQs */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <h3 className="text-xl font-semibold text-text-primary">Frequently Asked Questions</h3>
            <div className="flex flex-col gap-4">
              {faqs.map((faq, i) => (
                <div key={i} className="p-6 rounded-xl border border-border-default bg-white shadow-sm transition-all hover:border-border-hover">
                  <h4 className="font-semibold text-text-primary text-base mb-2">{faq.q}</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Support */}
          <div className="flex flex-col gap-6">
            <h3 className="text-xl font-semibold text-text-primary">Still need help?</h3>
            
            <div className="p-6 rounded-xl border border-border-default bg-white shadow-sm flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-semibold text-text-primary">Live Chat Support</h4>
                <p className="text-sm text-text-secondary mt-1">Available 9am-5pm EST for Pro customers.</p>
              </div>
              <Button className="w-full mt-2" onClick={() => toast({ title: "Chat Opened", description: "Our support widget will appear in the bottom corner shortly." })}>Start a chat</Button>
            </div>

            <div className="p-6 rounded-xl border border-border-default bg-white shadow-sm flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-bg-tertiary flex items-center justify-center text-text-secondary">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-semibold text-text-primary">Email Support</h4>
                <p className="text-sm text-text-secondary mt-1">We aim to respond within 24 hours.</p>
              </div>
              <Button variant="secondary" className="w-full mt-2" onClick={() => window.location.href = "mailto:support@lazyriver.com"}>Contact Us</Button>
            </div>

            <div 
              className="p-6 rounded-xl border border-border-default bg-white shadow-sm flex flex-col items-center text-center gap-4 hover:border-brand/30 transition-colors cursor-pointer group"
              onClick={() => toast({ title: "API Docs", description: "API documentation is available at api.lazyriver.com/docs" })}
            >
              <div className="h-12 w-12 rounded-full bg-bg-tertiary flex items-center justify-center text-text-secondary group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                <ExternalLink className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-semibold text-text-primary">Developer API Docs</h4>
                <p className="text-sm text-text-secondary mt-1">Learn how to integrate Wraft using REST API.</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}
