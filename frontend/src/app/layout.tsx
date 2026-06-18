import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";

export const metadata = {
  title: "LazyRiver | Automate Your Customer Support",
  description: "LazyRiver is an advanced AI platform that lets you train custom ChatGPT-like bots on your own knowledge base and deploy them to your website or WhatsApp in minutes.",
  keywords: "AI, chatbot, customer support, RAG, custom AI, whatsapp bot, widget",
};

import Providers from "@/providers"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body suppressHydrationWarning className="min-h-screen bg-bg-primary text-text-primary antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
