"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/ui";
import { AuthGate } from "@/components/AuthGate";
import { NodeCatalogProvider } from '@/components/NodeCatalogProvider';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return <AuthGate>{children}</AuthGate>;
  return <AuthGate><NodeCatalogProvider><div className="flex min-h-screen"><Sidebar /><main className="flex-1 min-w-0">{children}</main></div></NodeCatalogProvider></AuthGate>;
}
