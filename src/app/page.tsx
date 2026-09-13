import Link from "next/link";
import { cookies } from "next/headers";
import { tools } from "@/lib/tools";
import { verifySessionToken, isRestrictedAnonymous, SESSION_COOKIE } from "@/lib/auth";

export default async function Home() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const visibleTools =
    session && isRestrictedAnonymous(session)
      ? tools.filter((tool) => tool.href === "/accounting")
      : tools;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/30">
          A
        </span>
        <h1 className="text-2xl font-bold tracking-tight">AI-Tool</h1>
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">
        五個 AI 生活工具，選一個開始使用。
      </p>
      <ul className="grid w-full grid-cols-3 gap-3">
        {visibleTools.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-card text-xs font-medium shadow-sm shadow-black/[0.03] ring-1 ring-border transition-transform active:scale-95"
            >
              <span className="text-xl">{tool.icon}</span>
              {tool.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
