"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { tools } from "@/lib/tools";
import { isRestrictedAnonymous } from "@/lib/anonymousAccess";

type Session = { name: string; isAnonymous: boolean };

export default function BottomNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (pathname === "/login") return;

    let cancelled = false;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (!cancelled) setSession(data.user);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (pathname === "/login") {
    return null;
  }

  const visibleTools =
    session && isRestrictedAnonymous(session)
      ? tools.filter((tool) => tool.href === "/accounting")
      : tools;

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
      <ul className="flex">
        {visibleTools.map((tool) => {
          const active = pathname.startsWith(tool.href);
          return (
            <li key={tool.href} className="flex-1">
              <Link
                href={tool.href}
                className="flex flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground"
              >
                <span
                  className={`flex h-7 w-9 items-center justify-center rounded-full text-base leading-none transition-colors ${
                    active ? "bg-primary/10" : ""
                  }`}
                >
                  {tool.icon}
                </span>
                <span className={active ? "font-semibold text-primary" : ""}>
                  {tool.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
