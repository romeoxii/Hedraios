import { db } from "./db";

export interface ExportData {
    app: string;
    exported_at: string;
    user_id: string;
    entries: {
        id: string;
        created_at: string;
        body: string;
        mood?: string;
        tags: string[];
        image_urls: string[];
    }[];
    prayers: {
        id: string;
        created_at: string;
        title: string;
        detail: string;
        status: "active" | "answered";
        answered_at?: string;
    }[];
    readings: {
        id: string;
        date: string;
        reference: string;
        notes: string;
        image_urls: string[];
        created_at: string;
    }[];
}

/** Full backup: everything except sync bookkeeping. Deleted stuff stays out. */
export async function buildExport(userId: string): Promise<ExportData> {
    const [entries, prayers, readings] = await Promise.all([
        db.entries
            .where("user_id")
            .equals(userId)
            .and((e) => e.deleted !== 1)
            .toArray(),
        db.prayers
            .where("user_id")
            .equals(userId)
            .and((p) => p.deleted !== 1)
            .toArray(),
        db.readings
            .where("user_id")
            .equals(userId)
            .and((r) => r.deleted !== 1)
            .toArray(),
    ]);

    return {
        app: "hedraios",
        exported_at: new Date().toISOString(),
        user_id: userId,
        entries: entries.map((e) => ({
            id: e.remote_id ?? `local-${e.id}`,
            created_at: e.created_at,
            body: e.body,
            mood: e.mood,
            tags: e.tags,
            image_urls: e.image_urls ?? [],
        })),
        prayers: prayers.map((p) => ({
            id: p.remote_id ?? `local-${p.id}`,
            created_at: p.created_at,
            title: p.title,
            detail: p.detail,
            status: p.status,
            answered_at: p.answered_at,
        })),
        readings: readings.map((r) => ({
            id: r.remote_id ?? `local-${r.id}`,
            date: r.date,
            reference: r.reference,
            notes: r.notes,
            image_urls: r.image_urls ?? [],
            created_at: r.created_at,
        })),
    };
}

export function downloadExport(data: ExportData) {
    const stamp = data.exported_at.slice(0, 10);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hedraios-export-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
