import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "FlowForge – پلتفرم اتوماسیون هوشمند",
  description: "اکوسیستم کامل اتوماسیون کاری: Workflow، AI Agent، RAG، یکپارچه‌سازی‌ها و IoT – متن‌باز و لوکال",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
