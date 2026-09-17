"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/compressImage";

type MoodTag = {
  _id: string;
  name: string;
  isDefault: boolean;
};

type Entry = {
  _id: string;
  content: string;
  moodTags: string[];
  imageUrl?: string;
  createdAt: string;
};

type OnThisDayGroup = {
  kind: "month" | "year";
  amount: number;
  dateKey: string;
  entries: Entry[];
};

const CHINESE_DIGITS = ["", "一", "二", "三", "四", "五"];

function onThisDayTitle(group: OnThisDayGroup) {
  if (group.kind === "month") return "一個月前的今天";
  const amount = CHINESE_DIGITS[group.amount] ?? String(group.amount);
  return `${amount}年前的今天`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FaithPage() {
  const [tags, setTags] = useState<MoodTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);

  const [onThisDayGroups, setOnThisDayGroups] = useState<OnThisDayGroup[]>([]);
  const [onThisDayLoading, setOnThisDayLoading] = useState(true);

  const [content, setContent] = useState("");
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingImageUrlRef = useRef<string | null>(null);

  const [newTagName, setNewTagName] = useState("");
  const [showAddTag, setShowAddTag] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const res = await fetch("/api/faith/mood-tags");
      const data = await res.json();
      setTags(res.ok ? data.tags : []);
    } finally {
      setTagsLoading(false);
    }
  }, []);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const res = await fetch("/api/faith/entries");
      const data = await res.json();
      setEntries(res.ok ? data.entries : []);
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  const loadOnThisDay = useCallback(async () => {
    setOnThisDayLoading(true);
    try {
      const res = await fetch("/api/faith/on-this-day");
      const data = await res.json();
      setOnThisDayGroups(res.ok ? data.groups : []);
    } finally {
      setOnThisDayLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
    loadEntries();
    loadOnThisDay();
  }, [loadTags, loadEntries, loadOnThisDay]);

  useEffect(() => {
    pendingImageUrlRef.current = imageUrl;
  }, [imageUrl]);

  // An uploaded-but-unsaved image should not linger in Blob storage. Cover
  // both an in-app route change (unmount) and an actual tab close/refresh
  // (beforeunload, where only sendBeacon reliably fires).
  useEffect(() => {
    function discardPendingImage() {
      const url = pendingImageUrlRef.current;
      if (!url) return;
      pendingImageUrlRef.current = null;
      const blob = new Blob([JSON.stringify({ url })], { type: "application/json" });
      navigator.sendBeacon("/api/faith/upload/discard", blob);
    }

    window.addEventListener("beforeunload", discardPendingImage);
    return () => {
      window.removeEventListener("beforeunload", discardPendingImage);
      discardPendingImage();
    };
  }, []);

  function toggleTag(name: string) {
    setSelectedTagNames((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  }

  async function handleAddTag() {
    const name = newTagName.trim();
    if (!name) return;

    setAddingTag(true);
    setTagError(null);
    try {
      const res = await fetch("/api/faith/mood-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (!res.ok) {
        setTagError(data.error ?? "發生錯誤");
        return;
      }

      setNewTagName("");
      setShowAddTag(false);
      await loadTags();
      setSelectedTagNames((prev) => [...prev, data.tag.name]);
    } catch {
      setTagError("連線失敗，請稍後再試");
    } finally {
      setAddingTag(false);
    }
  }

  function discardImage(url: string) {
    fetch("/api/faith/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => {});
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (imageUrl) {
      discardImage(imageUrl);
    }

    setImageError(null);
    setImageUrl(null);
    pendingImageUrlRef.current = null;

    try {
      const dataUrl = await compressImage(file);
      setImagePreview(dataUrl);

      setImageUploading(true);
      const res = await fetch("/api/faith/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        setImageError(data.error ?? "圖片上傳失敗");
        return;
      }

      setImageUrl(data.url);
    } catch {
      setImageError("圖片處理或上傳失敗，請稍後再試");
    } finally {
      setImageUploading(false);
    }
  }

  function resetImageState() {
    setImagePreview(null);
    setImageUrl(null);
    setImageError(null);
    pendingImageUrlRef.current = null;
  }

  function handleRemoveImage() {
    if (imageUrl) {
      discardImage(imageUrl);
    }
    resetImageState();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = content.trim();
    if (!trimmed) {
      setFormError("請寫下這一刻的省思");
      return;
    }
    if (imageUploading) {
      setFormError("圖片上傳中，請稍候");
      return;
    }
    if (imagePreview && !imageUrl) {
      setFormError("圖片尚未上傳成功，請重新選擇或移除圖片");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/faith/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          moodTags: selectedTagNames,
          imageUrl: imageUrl ?? undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? "發生錯誤");
        return;
      }

      setContent("");
      setSelectedTagNames([]);
      resetImageState();
      await loadEntries();
    } catch {
      setFormError("連線失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e._id !== id));
    await fetch(`/api/faith/entries/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-5 backdrop-blur">
        <h1 className="text-xl font-bold tracking-tight">信仰筆記本</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDateTime(new Date().toISOString())}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-6 px-5 py-5">
        <section className="rounded-2xl bg-card p-4 shadow-sm shadow-black/[0.03] ring-1 ring-border">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                此刻的心情、經節與省思
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="寫下現在的心情、感恩或掙扎、讀到的經節與省思..."
                maxLength={2000}
                rows={6}
                className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">心情寫照（選填）</label>

              {imagePreview ? (
                <div className="relative w-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="心情寫照預覽"
                    className="h-32 w-32 rounded-xl object-cover ring-1 ring-border"
                  />
                  {imageUploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-xs text-white">
                      上傳中...
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    aria-label="移除圖片"
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm ring-1 ring-border"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground"
                >
                  <span className="text-xl leading-none">📷</span>
                  <span className="text-xs">上傳圖片</span>
                </button>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              {imageError && <p className="mt-1.5 text-xs text-red-500">{imageError}</p>}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">心情標籤</label>
                <button
                  type="button"
                  onClick={() => setShowAddTag((v) => !v)}
                  className="text-xs font-medium text-primary"
                >
                  {showAddTag ? "取消新增" : "+ 自訂標籤"}
                </button>
              </div>

              {showAddTag && (
                <div className="mb-2.5 flex gap-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="標籤名稱"
                    maxLength={10}
                    className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={addingTag || !newTagName.trim()}
                    className="rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {addingTag ? "新增中..." : "新增"}
                  </button>
                </div>
              )}
              {tagError && <p className="mb-2 text-xs text-red-500">{tagError}</p>}

              {tagsLoading ? (
                <p className="py-2 text-xs text-muted-foreground">載入標籤中...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const selected = selectedTagNames.includes(tag.name);
                    return (
                      <button
                        key={tag._id}
                        type="button"
                        onClick={() => toggleTag(tag.name)}
                        className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {tag.name}
                      </button>
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
              {submitting ? "儲存中..." : "儲存這一刻"}
            </button>
          </form>
        </section>

        {!onThisDayLoading && onThisDayGroups.length > 0 && (
          <section className="flex flex-col gap-4">
            <p className="text-sm font-semibold">歷史回顧</p>
            {onThisDayGroups.map((group) => (
              <div key={`${group.kind}-${group.amount}`}>
                <p className="mb-2 text-xs font-medium text-primary">
                  {onThisDayTitle(group)}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {group.entries.map((entry) => (
                    <li
                      key={entry._id}
                      className="rounded-2xl bg-primary/5 px-4 py-3 ring-1 ring-primary/10"
                    >
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </p>
                      {entry.imageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={entry.imageUrl}
                          alt="心情寫照"
                          className="mb-2 max-h-96 w-full rounded-xl bg-muted object-contain"
                        />
                      )}
                      <p className="whitespace-pre-wrap text-sm">{entry.content}</p>
                      {entry.moodTags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {entry.moodTags.map((name) => (
                            <span
                              key={name}
                              className="rounded-full bg-card px-2.5 py-0.5 text-xs text-muted-foreground"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        <section>
          <p className="mb-3 text-sm font-semibold">過去的省思</p>

          {entriesLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">載入中...</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              還沒有任何紀錄，寫下你的第一篇省思吧
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {entries.map((entry) => (
                <li
                  key={entry._id}
                  className="rounded-2xl bg-card px-4 py-3 shadow-sm shadow-black/[0.03] ring-1 ring-border"
                >
                  <div className="mb-1.5 flex items-start justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry._id)}
                      aria-label="刪除這筆紀錄"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                      ✕
                    </button>
                  </div>
                  {entry.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={entry.imageUrl}
                      alt="心情寫照"
                      className="mb-2 max-h-96 w-full rounded-xl bg-muted object-contain"
                    />
                  )}
                  <p className="whitespace-pre-wrap text-sm">{entry.content}</p>
                  {entry.moodTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entry.moodTags.map((name) => (
                        <span
                          key={name}
                          className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
