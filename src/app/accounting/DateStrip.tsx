"use client";

import { useEffect, useMemo, useRef } from "react";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function toDateKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function DateStrip({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (dateKey: string) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const todayKey = useMemo(() => toDateKey(startOfToday()), []);

  const days = useMemo(() => {
    const today = startOfToday();
    const list: Date[] = [];
    for (let i = -59; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    return list;
  }, []);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selected]);

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
      {days.map((d) => {
        const key = toDateKey(d);
        const isSelected = key === selected;
        const isToday = key === todayKey;

        return (
          <button
            key={key}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            onClick={() => onSelect(key)}
            className={`flex w-12 shrink-0 flex-col items-center rounded-2xl py-2 text-xs transition-colors ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>{WEEKDAYS[d.getDay()]}</span>
            <span className="mt-1 text-base font-semibold">{d.getDate()}</span>
            {isToday && !isSelected && (
              <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
