import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-white text-slate-900`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
