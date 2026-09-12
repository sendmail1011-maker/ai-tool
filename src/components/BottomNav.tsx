"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tools } from "@/lib/tools";

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
      <ul className="flex">
        {tools.map((tool) => {
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
