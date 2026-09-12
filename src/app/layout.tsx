import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import UserBar from "@/components/UserBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI-Tool",
  description: "五個 AI 生活工具：記帳、健身、信仰、投資、生活紀錄",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-TW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh justify-center bg-[#eeedf7] dark:bg-black">
        <div className="flex min-h-dvh w-full max-w-md flex-col border-x border-border bg-background shadow-xl shadow-black/5">
          <UserBar />
          <main className="flex flex-1 flex-col">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
