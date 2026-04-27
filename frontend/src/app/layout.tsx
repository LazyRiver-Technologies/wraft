import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";

export const metadata = {
  title: "AI Chatbots App",
  description: "RAG AI Platform",
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
