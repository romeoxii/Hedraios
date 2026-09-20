import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

interface CalendarStripProps {
  /** Entry dates as yyyy-MM-dd. */
  entryDates: string[];
  selected: string | null;
  onSelect: (dateKey: string | null) => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarStrip({
  entryDates,
  selected,
  onSelect,
}: CalendarStripProps) {
  const [month, setMonth] = useState(() => new Date());
  const today = new Date();
  const marked = useMemo(() => new Set(entryDates), [entryDates]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  function toggle(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    onSelect(selected === key ? null : key);
  }

  return (
    <section aria-label="Calendar" className="rounded-xl border px-3 py-2">
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          aria-label="Previous month"
          className="rounded px-2 py-1 opacity-70"
        >
          ‹
        </button>
        <span className="font-medium">{format(month, "MMMM yyyy")}</span>
        <span className="flex gap-1">
          <button
            type="button"
            onClick={() => setMonth(new Date())}
            className="rounded px-2 py-1 text-xs opacity-70 underline underline-offset-2"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
            className="rounded px-2 py-1 opacity-70"
          >
            ›
          </button>
        </span>
      </div>
      <div className="mt-1 grid grid-cols-7 text-center text-[11px] opacity-50">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center text-[13px]">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const isSelected = selected === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(day)}
              aria-label={format(day, "EEEE, MMM d")}
              className={`flex flex-col items-center rounded-lg py-1 ${
                inMonth ? "" : "opacity-30"
              } ${isSelected ? "ring-1" : ""}`}
            >
              <span className={isToday ? "font-bold underline underline-offset-4" : ""}>
                {format(day, "d")}
              </span>
              <span
                className={`mt-0.5 h-1 w-1 rounded-full ${
                  marked.has(key) ? "bg-current" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
