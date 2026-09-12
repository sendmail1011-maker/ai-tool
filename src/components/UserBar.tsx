"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Session = {
  userId: string;
  name: string;
  role: "admin" | "member";
};

export default function UserBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Session | null>(null);

  useEffect(() => {
    if (pathname === "/login") return;

    let cancelled = false;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (!cancelled) setUser(data.user);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (pathname === "/login" || !user) {
    return null;
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="text-xs font-medium text-foreground">
          {user.name}
        </span>
        {user.role === "admin" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            管理員
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="text-xs font-medium text-muted-foreground hover:text-primary"
      >
        登出
      </button>
    </div>
  );
}
