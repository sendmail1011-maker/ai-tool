"use client";

import { useRouter } from "next/navigation";

export default function FitnessBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/fitness")}
      aria-label="返回健身首頁"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      ‹
    </button>
  );
}
