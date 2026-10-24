import { useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useEntries } from "../hooks/useEntries";
import { usePrayers } from "../hooks/usePrayers";
import { useReadings } from "../hooks/useReadings";
import { useStats } from "../hooks/useStats";
import { localDayKey } from "../lib/dates";
import { calcStreak } from "../lib/streak";
import type { JournalEntry, Prayer, Reading } from "../lib/db";

function greeting(now: Date = new Date()): string {
    const hour = now.getHours();
    if (hour < 5) return "Up late";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

function Stat({
    value,
    label,
    hue,
    suffix,
}: {
    value: number;
    label: string;
    hue: string;
    suffix?: string;
}) {
    return (
        <div className="flex flex-col items-center">
            <span className="section-title" style={{ fontSize: "1.35rem", color: hue }}>
                {value}
            </span>
            <span className="meta">
                {label}
                {suffix ? ` ${suffix}` : ""}
            </span>
        </div>
    );
}

type TimelineItem =
    | { kind: "entry"; sortKey: string; entry: JournalEntry }
    | { kind: "prayer"; sortKey: string; prayer: Prayer }
    | { kind: "reading"; sortKey: string; reading: Reading };

function itemTitle(item: TimelineItem): string {
    if (item.kind === "entry") {
        return item.entry.body.split("\n")[0].trim().slice(0, 80) || "Untitled entry";
    }
    if (item.kind === "prayer") return item.prayer.title;
    return item.reading.reference;
}

function itemTime(item: TimelineItem): string {
    const stamp =
        item.kind === "entry"
            ? item.entry.created_at
            : item.kind === "prayer"
              ? item.prayer.created_at
              : item.reading.created_at;
    return format(new Date(stamp), "h:mm a");
}

function itemKindLabel(item: TimelineItem): string {
    if (item.kind === "entry") return item.entry.mood ?? "Note";
    if (item.kind === "prayer")
        return item.prayer.status === "answered" ? "Prayer · answered" : "Prayer · open";
    return "Reading";
}

function itemHue(item: TimelineItem): string {
    if (item.kind === "prayer") return "var(--hue-prayer)";
    if (item.kind === "reading") return "var(--hue-reading)";
    return "var(--accent)";
}

function groupHeading(dateKey: string): string {
    const date = new Date(`${dateKey}T12:00:00`);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEEE, MMM d");
}

export function Timeline({ userId }: { userId: string }) {
    const { entries, loading: entriesLoading, syncing, syncError } = useEntries(userId);
    const { prayers, loading: prayersLoading } = usePrayers(userId);
    const { readings, loading: readingsLoading } = useReadings(userId);
    const { stats } = useStats(userId);

    const loading = entriesLoading || prayersLoading || readingsLoading;

    const streak = useMemo(
        () => calcStreak(entries.map((e) => localDayKey(e.created_at))),
        [entries],
    );

    const groups = useMemo(() => {
        const items: TimelineItem[] = [
            ...entries.map((entry): TimelineItem => ({
                kind: "entry",
                sortKey: entry.created_at,
                entry,
            })),
            ...prayers.map((prayer): TimelineItem => ({
                kind: "prayer",
                sortKey: prayer.created_at,
                prayer,
            })),
            ...readings.map((reading): TimelineItem => ({
                kind: "reading",
                sortKey: reading.created_at,
                reading,
            })),
        ];
        items.sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));
        const map = new Map<string, TimelineItem[]>();
        for (const item of items) {
            // Group by phone day, never server day.
            const key = item.kind === "reading" ? item.reading.date : localDayKey(item.sortKey);
            const list = map.get(key) ?? [];
            list.push(item);
            map.set(key, list);
        }
        return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    }, [entries, prayers, readings]);

    const empty = groups.length === 0;

    return (
        <div className="flex flex-col gap-5 py-6">
            <div>
                <p className="meta">{greeting()}, here&apos;s your day</p>
                <div className="mt-1 flex items-baseline justify-between">
                    <h1 className="section-title text-2xl">{format(new Date(), "EEEE, MMM d")}</h1>
                    <span className="meta">
                        {syncing ? (
                            "Syncing…"
                        ) : (
                            <>
                                {entries.length} entries ·{" "}
                                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                                    {streak}-day streak
                                </span>
                            </>
                        )}
                    </span>
                </div>
            </div>
            {syncError && (
                <p className="alert-error">Sync failed: {syncError} (see console for details)</p>
            )}

            <div
                className="card grid grid-cols-4 gap-2 text-center"
                style={{ padding: "0.8rem 0.5rem" }}
                aria-label="Overview"
            >
                <Stat
                    value={stats.streak}
                    label="Streak"
                    hue="var(--accent)"
                    suffix={stats.streak === 1 ? "day" : "days"}
                />
                <Stat value={stats.entries} label="Notes" hue="var(--accent)" />
                <Stat value={stats.prayers} label="Prayers" hue="var(--hue-prayer)" />
                <Stat value={stats.readings} label="Readings" hue="var(--hue-reading)" />
            </div>

            {loading ? (
                <p className="meta py-8 text-center">Loading timeline…</p>
            ) : empty ? (
                <p className="meta py-8 text-center">
                    Nothing yet — write a note, log a prayer, or add a reading.
                </p>
            ) : (
                <div className="flex flex-col gap-6">
                    {groups.map(([dateKey, items]) => (
                        <section key={dateKey} aria-label={groupHeading(dateKey)}>
                            <h2
                                className="meta font-medium uppercase"
                                style={{ letterSpacing: "0.06em", fontSize: "0.75rem" }}
                            >
                                {groupHeading(dateKey)}
                            </h2>
                            <div className="mt-2 flex flex-col gap-2">
                                {items.map((item) => {
                                    const id =
                                        item.kind === "entry"
                                            ? item.entry.id
                                            : item.kind === "prayer"
                                              ? item.prayer.id
                                              : item.reading.id;
                                    return (
                                        <motion.div
                                            key={`${item.kind}-${id}`}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="min-w-0"
                                        >
                                            <Link
                                                to={`/read/${item.kind}/${id}`}
                                                className="card flex min-w-0 items-center gap-3"
                                                style={{ textDecoration: "none" }}
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    style={{
                                                        width: "0.6rem",
                                                        height: "0.6rem",
                                                        borderRadius: "50%",
                                                        background: itemHue(item),
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span
                                                        className="block truncate break-words"
                                                        style={{
                                                            fontSize: "0.9375rem",
                                                            fontWeight: 600,
                                                            color: "var(--text)",
                                                        }}
                                                    >
                                                        {itemTitle(item)}
                                                    </span>
                                                    <span className="meta">
                                                        {itemKindLabel(item)} · {itemTime(item)}
                                                    </span>
                                                </span>
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
