"use client";

import { useCallback, useEffect, useState } from "react";
import DateStrip from "./DateStrip";

type Category = {
  _id: string;
  name: string;
  icon: string;
  isDefault: boolean;
};

type Entry = {
  _id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  note: string;
  minutes: number;
  date: string;
};

type StatsCategory = {
  categoryId: string;
  name: string;
  icon: string;
  minutes: number;
  hours: number;
};

type Stats = {
  categories: StatsCategory[];
  totalMinutes: number;
  totalHours: number;
};

type StatsMode = "day" | "month" | "year";

function todayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
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

function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

export default function LifeLogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [dayEntries, setDayEntries] = useState<Entry[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const [statsMode, setStatsMode] = useState<StatsMode>("day");
  const [statsMonth, setStatsMonth] = useState(todayKey().slice(0, 7));
  const [statsYear, setStatsYear] = useState(String(new Date().getFullYear()));
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [minutes, setMinutes] = useState("30");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await fetch("/api/life-log/categories");
      const data = await res.json();
      setCategories(res.ok ? data.categories : []);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const loadDay = useCallback(async (dateKey: string) => {
    setDayLoading(true);
    try {
      const res = await fetch(`/api/life-log/entries?date=${dateKey}`);
      const data = await res.json();
      setDayEntries(res.ok ? data.entries : []);
    } finally {
      setDayLoading(false);
    }
  }, []);

  const loadStats = useCallback(
    async (mode: StatsMode, dateKey: string, monthKey: string, yearKey: string) => {
      setStatsLoading(true);
      try {
        const period =
          mode === "day"
            ? `range=day&date=${dateKey}`
            : mode === "month"
              ? `range=month&month=${monthKey}`
              : `range=year&year=${yearKey}`;
        const res = await fetch(`/api/life-log/stats?${period}`);
        const data = await res.json();
        setStats(res.ok ? data : null);
      } finally {
        setStatsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  useEffect(() => {
    loadStats(statsMode, selectedDate, statsMonth, statsYear);
  }, [statsMode, selectedDate, statsMonth, statsYear, loadStats]);

  function handleStatsPrev() {
    if (statsMode === "month") setStatsMonth((m) => shiftMonth(m, -1));
    if (statsMode === "year") setStatsYear((y) => String(Number(y) - 1));
  }

  function handleStatsNext() {
    if (statsMode === "month") setStatsMonth((m) => shiftMonth(m, 1));
    if (statsMode === "year") setStatsYear((y) => String(Number(y) + 1));
  }

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;

    setAddingCategory(true);
    setCategoryError(null);
    try {
      const res = await fetch("/api/life-log/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCategoryError(data.error ?? "發生錯誤");
        return;
      }

      setNewCategoryName("");
      setShowAddCategory(false);
      await loadCategories();
      setSelectedCategoryIds((prev) => [...prev, data.category._id]);
    } catch {
      setCategoryError("連線失敗，請稍後再試");
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const minutesValue = Number(minutes);
    if (selectedCategoryIds.length === 0) {
      setFormError("請至少選擇一個分類");
      return;
    }
    if (!Number.isInteger(minutesValue) || minutesValue <= 0) {
      setFormError("請輸入正確的分鐘數");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/life-log/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formDate,
          minutes: minutesValue,
          categoryIds: selectedCategoryIds,
          note: note.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? "發生錯誤");
        return;
      }

      setShowForm(false);
      setSelectedCategoryIds([]);
      setMinutes("30");
      setNote("");
      setSelectedDate(formDate);
      await loadDay(formDate);
      await loadStats(statsMode, formDate, statsMonth, statsYear);
    } catch {
      setFormError("連線失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    setDayEntries((prev) => prev.filter((e) => e._id !== id));
    try {
      await fetch(`/api/life-log/entries/${id}`, { method: "DELETE" });
    } finally {
      await loadStats(statsMode, selectedDate, statsMonth, statsYear);
    }
  }

  const dayTotalMinutes = dayEntries.reduce((sum, e) => sum + e.minutes, 0);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-5 pt-5">
          <h1 className="text-xl font-bold tracking-tight">生活紀錄</h1>
          <button
            type="button"
            onClick={() => {
              setFormDate(selectedDate);
              setSelectedCategoryIds([]);
              setNote("");
              setFormError(null);
              setShowForm(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-lg leading-none text-primary-foreground shadow-md shadow-primary/30 transition-transform active:scale-95"
            aria-label="新增紀錄"
          >
            +
          </button>
        </div>
        <DateStrip selected={selectedDate} onSelect={setSelectedDate} />
      </div>

      <div className="flex flex-1 flex-col gap-7 px-5 py-5">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-semibold">{dateLabel(selectedDate)}</p>
            <p className="text-xs text-muted-foreground">
              合計 <span className="font-medium text-foreground">{minutesToHours(dayTotalMinutes)}</span> 小時
            </p>
          </div>

          {dayLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">載入中...</p>
          ) : dayEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              這天還沒有生活紀錄
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {dayEntries.map((entry) => (
                <li
                  key={entry._id}
                  className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm shadow-black/[0.03] ring-1 ring-border"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                    {entry.categoryIcon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.note || entry.categoryName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.categoryName} · {entry.minutes} 分鐘
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(entry._id)}
                    aria-label="刪除這筆紀錄"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {statsMode !== "day" && (
                <button
                  type="button"
                  onClick={handleStatsPrev}
                  aria-label="上一個週期"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  ‹
                </button>
              )}
              <h2 className="min-w-24 text-center text-sm font-semibold">
                {statsMode === "day"
                  ? "今日統計"
                  : statsMode === "month"
                    ? monthLabel(statsMonth)
                    : `${statsYear} 年`}
              </h2>
              {statsMode !== "day" && (
                <button
                  type="button"
                  onClick={handleStatsNext}
                  aria-label="下一個週期"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  ›
                </button>
              )}
            </div>

            <div className="flex rounded-full bg-muted p-0.5 text-xs">
              {(["day", "month", "year"] as StatsMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStatsMode(mode)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    statsMode === mode
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {mode === "day" ? "日" : mode === "month" ? "月" : "年"}
                </button>
              ))}
            </div>
          </div>

          {statsLoading ? (
            <p className="py-4 text-center text-xs text-muted-foreground">載入中...</p>
          ) : (
            <div className="rounded-2xl bg-card p-4 shadow-sm shadow-black/[0.03] ring-1 ring-border">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-xs font-semibold text-muted-foreground">分類時數</p>
                <p className="text-base font-bold">{stats?.totalHours ?? 0} 小時</p>
              </div>

              {!stats || stats.categories.length === 0 ? (
                <p className="text-xs text-muted-foreground">尚無資料</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {stats.categories.map((c) => (
                    <li key={c.categoryId} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {c.icon} {c.name}
                      </span>
                      <span className="font-medium">{c.hours} 小時</span>
                    </li>
                  ))}
                </ul>
              )}
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
              <p className="text-base font-semibold">新增生活紀錄</p>
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
                <label className="mb-1.5 block text-sm font-medium">日期</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">內容</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例如：陪小孩玩電動"
                  maxLength={100}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">分鐘</label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium">分類（可複選）</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCategory((v) => !v)}
                    className="text-xs font-medium text-primary"
                  >
                    {showAddCategory ? "取消新增" : "+ 新增分類"}
                  </button>
                </div>

                {showAddCategory && (
                  <div className="mb-2.5 flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="分類名稱"
                      maxLength={20}
                      className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={addingCategory || !newCategoryName.trim()}
                      className="rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {addingCategory ? "新增中..." : "新增"}
                    </button>
                  </div>
                )}
                {categoryError && (
                  <p className="mb-2 text-xs text-red-500">{categoryError}</p>
                )}

                {categoriesLoading ? (
                  <p className="py-2 text-xs text-muted-foreground">載入分類中...</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((c) => {
                      const selected = selectedCategoryIds.includes(c._id);
                      return (
                        <label
                          key={c._id}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleCategory(c._id)}
                            className="h-4 w-4 shrink-0 accent-primary"
                          />
                          <span>{c.icon}</span>
                          <span className="truncate">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {formError && <p className="text-sm text-red-500">{formError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 transition-opacity disabled:opacity-50"
              >
                {submitting ? "儲存中..." : "儲存"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
