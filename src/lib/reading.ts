import { format } from "date-fns";
import type { JournalEntry, Prayer, Reading } from "./db";

export interface ReadingModel {
    eyebrow?: string;
    title: string;
    dateLabel: string;
    body: string;
    tags: string[];
    images?: string[];
}

/** Finds the open note, prayer, or reading. Null when gone (deleted elsewhere). */
export function resolveReading(
    kind: string | undefined,
    id: number,
    data: { entries: JournalEntry[]; prayers: Prayer[]; readings: Reading[] },
): ReadingModel | null {
    if (kind === "entry") {
        const entry = data.entries.find((e) => e.id === id);
        if (!entry) return null;
        const firstLine = entry.body.split("\n")[0].trim().slice(0, 80) || "Untitled entry";
        return {
            eyebrow: entry.mood,
            title: firstLine,
            dateLabel: format(new Date(entry.created_at), "EEEE, MMM d · h:mm a"),
            body: entry.body,
            tags: entry.tags,
            images: entry.image_urls ?? [],
        };
    }
    if (kind === "prayer") {
        const prayer = data.prayers.find((p) => p.id === id);
        if (!prayer) return null;
        return {
            eyebrow: prayer.status === "answered" ? "Answered prayer" : "Open prayer",
            title: prayer.title,
            dateLabel: format(new Date(prayer.created_at), "EEEE, MMM d · h:mm a"),
            body: prayer.detail || "(No details written.)",
            tags: [],
        };
    }
    if (kind === "reading") {
        const item = data.readings.find((r) => r.id === id);
        if (!item) return null;
        return {
            title: item.reference,
            dateLabel: format(new Date(`${item.date}T12:00:00`), "EEEE, MMM d"),
            body: item.notes || "(No notes written.)",
            tags: [],
            images: item.image_urls ?? [],
        };
    }
    return null;
}
