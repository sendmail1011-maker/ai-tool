"use client";

import { useCallback, useEffect, useState } from "react";
import DateStrip from "./DateStrip";
import {
  ACCOUNTING_GROUPS,
  ACCOUNTING_TAXONOMY,
  groupsForType,
  subCategoryIcon,
  type AccountingGroup,
} from "@/lib/accountingCategories";

type TransactionResult = {
  _id: string;
  userName: string;
  type: "expense" | "income";
  group: AccountingGroup;
  subCategory: string;
  amount: number;
  item: string;
  date: string;
};

type GroupStats = {
  total: number;
  subCategories: Record<string, number>;
};

type Stats = {
  groups: Record<AccountingGroup, GroupStats>;
};

function todayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-");
  return `${y} 年 ${Number(m)} 月`;
}

function shiftMonth(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function compressImage(file: File, maxDim = 1440, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

function dateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

type MemberOption = { id: string; name: string; role: "admin" | "member" };

function scopeQuery(viewTarget: string) {
  if (viewTarget === "all") return "scope=all";
  if (viewTarget === "self") return "";
  return `userId=${viewTarget}`;
}

type Session = { userId: string; name: string; role: "admin" | "member" };

type PreviewItem = {
  id: string;
  type: "expense" | "income";
  group: AccountingGroup;
  subCategory: string;
  amount: number;
  item: string;
  date: string;
};

export default function AccountingPage() {
  const [session, setSession] = useState<Session | null>(null);
  const role = session?.role ?? null;
  const [viewTarget, setViewTarget] = useState("self");
  const [members, setMembers] = useState<MemberOption[]>([]);

  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [dayTransactions, setDayTransactions] = useState<TransactionResult[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsMode, setStatsMode] = useState<"month" | "year">("month");
  const [statsMonth, setStatsMonth] = useState(todayKey().slice(0, 7));
  const [statsYear, setStatsYear] = useState(String(new Date().getFullYear()));

  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(todayKey());
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [previewRawText, setPreviewRawText] = useState("");
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const statsPeriodKey = statsMode === "month" ? statsMonth : statsYear;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setSession(data.user ?? null));
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setMembers(data.users ?? []));
  }, [role]);

  const loadDay = useCallback(async (dateKey: string, target: string) => {
    setDayLoading(true);
    try {
      const query = scopeQuery(target);
      const res = await fetch(
        `/api/accounting/transactions?date=${dateKey}${query ? `&${query}` : ""}`
      );
      const data = await res.json();
      setDayTransactions(res.ok ? data.transactions : []);
    } finally {
      setDayLoading(false);
    }
  }, []);

  const loadStats = useCallback(
    async (mode: "month" | "year", key: string, target: string) => {
      setStatsLoading(true);
      try {
        const period = mode === "month" ? `month=${key}` : `year=${key}`;
        const query = scopeQuery(target);
        const res = await fetch(
          `/api/accounting/stats?${period}${query ? `&${query}` : ""}`
        );
        const data = await res.json();
        setStats(res.ok ? data : null);
      } finally {
        setStatsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDay(selectedDate, viewTarget);
  }, [selectedDate, viewTarget, loadDay]);

  useEffect(() => {
    loadStats(statsMode, statsPeriodKey, viewTarget);
  }, [statsMode, statsPeriodKey, viewTarget, loadStats]);

  function handleStatsPrev() {
    if (statsMode === "month") {
      setStatsMonth((m) => shiftMonth(m, -1));
    } else {
      setStatsYear((y) => String(Number(y) - 1));
    }
  }

  function handleStatsNext() {
    if (statsMode === "month") {
      setStatsMonth((m) => shiftMonth(m, 1));
    } else {
      setStatsYear((y) => String(Number(y) + 1));
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImageProcessing(true);
    setFormError(null);
    try {
      const dataUrl = await compressImage(file);
      setImagePreview(dataUrl);
    } catch {
      setFormError("圖片處理失敗，請重新選擇");
    } finally {
      setImageProcessing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!text.trim() && !imagePreview) {
      setFormError("請輸入文字或附上一張收據照片");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/accounting/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          date: formDate,
          type: formType,
          imageBase64: imagePreview,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? "發生錯誤");
        return;
      }

      if (!data.transactions || data.transactions.length === 0) {
        setFormError("沒有辨識到任何項目，請重新輸入");
        return;
      }

      const items: PreviewItem[] = (
        data.transactions as {
          type: "expense" | "income";
          group: AccountingGroup;
          subCategory: string;
          amount: number;
          item: string;
          date: string;
        }[]
      ).map((t, idx) => ({ id: `${Date.now()}-${idx}`, ...t }));

      setPreview(items);
      setPreviewRawText(text.trim() || "（拍照辨識收據）");
      setConfirmError(null);
      setText("");
      setImagePreview(null);
      setShowForm(false);
    } catch {
      setFormError("連線失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }

  function updatePreviewItem(id: string, patch: Partial<PreviewItem>) {
    setPreview((prev) => prev?.map((p) => (p.id === id ? { ...p, ...patch } : p)) ?? null);
  }

  function removePreviewItem(id: string) {
    setPreview((prev) => prev?.filter((p) => p.id !== id) ?? null);
  }

  function handlePreviewTypeChange(id: string, type: "expense" | "income") {
    const group = groupsForType(type)[0];
    const subCategory = ACCOUNTING_TAXONOMY[group][0];
    updatePreviewItem(id, { type, group, subCategory });
  }

  function handlePreviewGroupChange(id: string, group: AccountingGroup) {
    updatePreviewItem(id, { group, subCategory: ACCOUNTING_TAXONOMY[group][0] });
  }

  async function handleConfirmPreview() {
    if (!preview || preview.length === 0) return;

    setConfirmSubmitting(true);
    setConfirmError(null);

    try {
      const res = await fetch("/api/accounting/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: previewRawText,
          transactions: preview.map((p) => ({
            group: p.group,
            subCategory: p.subCategory,
            amount: p.amount,
            item: p.item,
            date: p.date,
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setConfirmError(data.error ?? "發生錯誤");
        return;
      }

      setPreview(null);
      setSelectedDate(formDate);
      await loadDay(formDate, viewTarget);
      await loadStats(statsMode, statsPeriodKey, viewTarget);
    } catch {
      setConfirmError("連線失敗，請稍後再試");
    } finally {
      setConfirmSubmitting(false);
    }
  }

  const dayExpense = dayTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const dayIncome = dayTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-5 pt-5">
          <h1 className="text-xl font-bold tracking-tight">記帳</h1>
          <button
            type="button"
            onClick={() => {
              setFormDate(selectedDate);
              setShowForm(true);
              setPreview(null);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-lg leading-none text-primary-foreground shadow-md shadow-primary/30 transition-transform active:scale-95"
            aria-label="新增記帳"
          >
            +
          </button>
        </div>
        <DateStrip selected={selectedDate} onSelect={setSelectedDate} />

        {role === "admin" && (
          <div className="flex justify-end px-5 pb-3">
            <select
              value={viewTarget}
              onChange={(e) => setViewTarget(e.target.value)}
              className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium outline-none focus:border-primary"
            >
              <option value="self">我的帳本</option>
              <option value="all">全部使用者</option>
              {members
                .filter((m) => m.id !== session?.userId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-7 px-5 py-5">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-semibold">{dateLabel(selectedDate)}</p>
            <p className="text-xs text-muted-foreground">
              支出{" "}
              <span className="font-medium text-red-500">{dayExpense}</span>
              {" · "}
              收入{" "}
              <span className="font-medium text-emerald-500">
                {dayIncome}
              </span>
            </p>
          </div>

          {dayLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              載入中...
            </p>
          ) : dayTransactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              這天還沒有記帳紀錄
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {dayTransactions.map((t) => (
                <li
                  key={t._id}
                  className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm shadow-black/[0.03] ring-1 ring-border"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                    {subCategoryIcon(t.subCategory)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.item}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.subCategory} · {t.userName}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-semibold ${
                      t.type === "expense"
                        ? "text-red-500"
                        : "text-emerald-500"
                    }`}
                  >
                    {t.type === "expense" ? "-" : "+"}
                    {t.amount}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleStatsPrev}
                aria-label="上一個週期"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                ‹
              </button>
              <h2 className="w-24 text-center text-sm font-semibold">
                {statsMode === "month"
                  ? monthLabel(statsMonth)
                  : `${statsYear} 年`}
              </h2>
              <button
                type="button"
                onClick={handleStatsNext}
                aria-label="下一個週期"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                ›
              </button>
            </div>

            <div className="flex rounded-full bg-muted p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setStatsMode("month")}
                className={`rounded-full px-3 py-1 transition-colors ${
                  statsMode === "month"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                月
              </button>
              <button
                type="button"
                onClick={() => setStatsMode("year")}
                className={`rounded-full px-3 py-1 transition-colors ${
                  statsMode === "year"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                年
              </button>
            </div>
          </div>

          {statsLoading ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              載入中...
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {ACCOUNTING_GROUPS.map((group) => (
                <StatsCard
                  key={group}
                  title={group}
                  data={stats?.groups?.[group]}
                  tone={group === "收入與資產" ? "income" : "expense"}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-7 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="text-base font-semibold">新增記帳</p>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                取消
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  日期
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium">記帳內容</label>
                  <div className="flex rounded-full bg-muted p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setFormType("expense")}
                      className={`rounded-full px-3 py-1 font-medium transition-colors ${
                        formType === "expense"
                          ? "bg-red-500 text-white"
                          : "text-muted-foreground"
                      }`}
                    >
                      支出
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType("income")}
                      className={`rounded-full px-3 py-1 font-medium transition-colors ${
                        formType === "income"
                          ? "bg-emerald-500 text-white"
                          : "text-muted-foreground"
                      }`}
                    >
                      收入
                    </button>
                  </div>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    formType === "expense"
                      ? "例如：豆漿50拉麵200雞排90（也可以只拍收據照片）"
                      : "例如：薪水收入35000，股利配息1200"
                  }
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />

                <div className="mt-2">
                  {imagePreview ? (
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="收據預覽"
                        className="h-24 w-24 rounded-xl object-cover ring-1 ring-border"
                      />
                      <button
                        type="button"
                        onClick={() => setImagePreview(null)}
                        aria-label="移除照片"
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs text-background shadow"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      📷 {imageProcessing ? "處理中..." : "拍照 / 上傳收據"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        disabled={imageProcessing}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-500">{formError}</p>
              )}

              <button
                type="submit"
                disabled={submitting || imageProcessing}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 transition-opacity disabled:opacity-50"
              >
                {submitting ? "分析中..." : "分析"}
              </button>
            </form>
          </div>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-card p-5 pb-7 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold">
                確認記帳內容（{preview.length} 筆）
              </p>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                取消
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {preview.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  沒有項目了，請取消後重新輸入
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {preview.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-col gap-2 rounded-2xl bg-background p-3 ring-1 ring-border"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex rounded-full bg-muted p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => handlePreviewTypeChange(p.id, "expense")}
                            className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                              p.type === "expense"
                                ? "bg-red-500 text-white"
                                : "text-muted-foreground"
                            }`}
                          >
                            支出
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePreviewTypeChange(p.id, "income")}
                            className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                              p.type === "income"
                                ? "bg-emerald-500 text-white"
                                : "text-muted-foreground"
                            }`}
                          >
                            收入
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePreviewItem(p.id)}
                          aria-label="刪除這筆"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                        >
                          ✕
                        </button>
                      </div>

                      <input
                        type="text"
                        value={p.item}
                        onChange={(e) =>
                          updatePreviewItem(p.id, { item: e.target.value })
                        }
                        placeholder="項目描述"
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={p.group}
                          onChange={(e) =>
                            handlePreviewGroupChange(
                              p.id,
                              e.target.value as AccountingGroup
                            )
                          }
                          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                        >
                          {groupsForType(p.type).map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                        <select
                          value={p.subCategory}
                          onChange={(e) =>
                            updatePreviewItem(p.id, { subCategory: e.target.value })
                          }
                          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                        >
                          {ACCOUNTING_TAXONOMY[p.group].map((sc) => (
                            <option key={sc} value={sc}>
                              {subCategoryIcon(sc)} {sc}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={p.date}
                          onChange={(e) =>
                            updatePreviewItem(p.id, { date: e.target.value })
                          }
                          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                        />
                        <input
                          type="number"
                          value={p.amount}
                          onChange={(e) =>
                            updatePreviewItem(p.id, {
                              amount: Number(e.target.value),
                            })
                          }
                          className={`rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm font-semibold outline-none focus:border-primary ${
                            p.type === "expense"
                              ? "text-red-500"
                              : "text-emerald-500"
                          }`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {confirmError && (
              <p className="mt-3 text-sm text-red-500">{confirmError}</p>
            )}

            <button
              type="button"
              onClick={handleConfirmPreview}
              disabled={confirmSubmitting || preview.length === 0}
              className="mt-4 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 transition-opacity disabled:opacity-50"
            >
              {confirmSubmitting ? "存入中..." : `確認存入 ${preview.length} 筆`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsCard({
  title,
  data,
  tone,
}: {
  title: string;
  data: { total: number; subCategories: Record<string, number> } | undefined;
  tone: "expense" | "income";
}) {
  const entries = Object.entries(data?.subCategories ?? {}).sort(
    (a, b) => b[1] - a[1]
  );
  const total = data?.total ?? 0;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm shadow-black/[0.03] ring-1 ring-border">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-xs font-semibold text-muted-foreground">
          {title}
        </p>
        <p
          className={`text-base font-bold ${
            tone === "expense" ? "text-red-500" : "text-emerald-500"
          }`}
        >
          {total}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">尚無資料</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map(([subCategory, amount]) => (
            <li
              key={subCategory}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-muted-foreground">
                {subCategoryIcon(subCategory)} {subCategory}
              </span>
              <span className="font-medium">{amount}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
