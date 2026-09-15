"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(!pathname.startsWith("/login"));

  useEffect(() => {
    if (pathname.startsWith("/login")) { setChecking(false); return; }
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((result) => { if (!result.authenticated) router.replace("/login"); else setChecking(false); })
      .catch(() => router.replace("/login"));
  }, [pathname, router]);

  if (checking) return <div className="min-h-screen bg-[#070b16]" />;
  return <>{children}</>;
}
