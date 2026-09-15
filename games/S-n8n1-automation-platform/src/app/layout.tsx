import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "FlowForge | پلتفرم اتوماسیون هوشمند",
  description: "اکوسیستم کامل اتوماسیون هوشمند: Workflow Builder، AI Agent، RAG و ۵۰۰+ نود یکپارچه‌سازی.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
