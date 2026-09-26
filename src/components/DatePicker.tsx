import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface DatePickerProps {
    /** Picked day, like 2026-09-21. */
    value: string;
    onChange: (dateKey: string) => void;
    label: string;
    /** Sizing hook for the trigger wrapper, e.g. "min-w-0 flex-1". */
    className?: string;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function parseKey(key: string): Date {
    const parsed = new Date(`${key}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** Home-made calendar. The built-in date box breaks out of cards on iPhones. */
export function DatePicker({ value, onChange, label, className = "" }: DatePickerProps) {
    const [shown, setShown] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [month, setMonth] = useState(() => parseKey(value));
    const timer = useRef<number | null>(null);
    const today = new Date();

    const close = useCallback(() => {
        if (!shown || leaving) return;
        setLeaving(true);
        timer.current = window.setTimeout(() => {
            setShown(false);
            setLeaving(false);
            timer.current = null;
        }, 150);
    }, [shown, leaving]);

    useEffect(() => {
        if (!shown) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [shown, close]);

    // Kills a hanging close timer when this goes away.
    useEffect(
        () => () => {
            if (timer.current != null) window.clearTimeout(timer.current);
        },
        [],
    );

    function open() {
        if (timer.current != null) {
            window.clearTimeout(timer.current);
            timer.current = null;
        }
        // Opens on the picked month.
        setMonth(parseKey(value));
        setLeaving(false);
        setShown(true);
    }

    function toggle() {
        if (shown && !leaving) close();
        else open();
    }

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [month]);

    function pick(day: Date) {
        onChange(format(day, "yyyy-MM-dd"));
        close();
    }

    return (
        <div className={className} style={{ position: "relative" }}>
            <button
                type="button"
                onClick={toggle}
                aria-label={label}
                aria-expanded={shown}
                aria-haspopup="dialog"
                className="field flex items-center justify-between gap-2"
                style={{ fontSize: "0.875rem", textAlign: "left" }}
            >
                <span>{format(parseKey(value), "EEE, MMM d")}</span>
                <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flexShrink: 0, opacity: 0.6 }}
                >
                    <rect x="3" y="4" width="18" height="18" rx="3" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
            </button>

            {shown && (
                <>
                    <div
                        role="presentation"
                        onMouseDown={close}
                        className={leaving ? "overlay overlay-leave" : "overlay"}
                        style={{ background: "transparent", backdropFilter: "none" }}
                    />
                    <div
                        role="dialog"
                        aria-label={label}
                        className={`card popover${leaving ? " popover-leave" : ""}`}
                        style={{
                            position: "absolute",
                            top: "calc(100% + 0.4rem)",
                            left: 0,
                            width: "min(19rem, calc(100vw - 3rem))",
                            maxWidth: "100%",
                            zIndex: 50,
                            padding: "0.75rem",
                        }}
                    >
                        <div className="flex items-center justify-between text-sm">
                            <button
                                type="button"
                                onClick={() => setMonth((m) => subMonths(m, 1))}
                                aria-label="Previous month"
                                className="btn btn-sm btn-ghost"
                            >
                                ‹
                            </button>
                            <span className="section-title" style={{ fontSize: "0.9375rem" }}>
                                {format(month, "MMMM yyyy")}
                            </span>
                            <button
                                type="button"
                                onClick={() => setMonth((m) => addMonths(m, 1))}
                                aria-label="Next month"
                                className="btn btn-sm btn-ghost"
                            >
                                ›
                            </button>
                        </div>
                        <div
                            className="meta mt-1 grid grid-cols-7 text-center"
                            style={{ fontSize: "0.6875rem" }}
                        >
                            {WEEKDAYS.map((d, i) => (
                                <span key={i}>{d}</span>
                            ))}
                        </div>
                        <div
                            className="grid grid-cols-7 text-center"
                            style={{ fontSize: "0.8125rem" }}
                        >
                            {days.map((day) => {
                                const key = format(day, "yyyy-MM-dd");
                                const inMonth = isSameMonth(day, month);
                                const selected = key === value;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => pick(day)}
                                        aria-label={format(day, "EEEE, MMM d")}
                                        aria-pressed={selected}
                                        className="flex flex-col items-center rounded-lg py-1"
                                        style={{
                                            opacity: inMonth ? 1 : 0.3,
                                            background: selected
                                                ? "var(--accent-soft)"
                                                : "transparent",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontWeight:
                                                    selected || isSameDay(day, today) ? 700 : 400,
                                                color: selected ? "var(--accent)" : undefined,
                                            }}
                                        >
                                            {format(day, "d")}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                onChange(format(new Date(), "yyyy-MM-dd"));
                                close();
                            }}
                            className="link-btn mt-2 w-full text-center"
                            style={{ fontSize: "0.75rem" }}
                        >
                            Back to today
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
