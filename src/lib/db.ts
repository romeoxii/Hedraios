import Dexie, { type EntityTable } from "dexie";

export interface JournalEntry {
    id?: number;
    remote_id?: string;
    user_id: string;
    body: string;
    mood?: string;
    tags: string[];
    image_urls: string[];
    created_at: string;
    updated_at: string;
    dirty: number;
    /** 1 = deleted on this phone, still needs deleting online. Hidden everywhere. */
    deleted: number;
}

export interface Prayer {
    id?: number;
    remote_id?: string;
    user_id: string;
    title: string;
    detail: string;
    status: "active" | "answered";
    created_at: string;
    answered_at?: string;
    updated_at: string;
    dirty: number;
    /** 1 = deleted on this phone, still needs deleting online. Hidden everywhere. */
    deleted: number;
}

export interface Reading {
    id?: number;
    remote_id?: string;
    user_id: string;
    date: string;
    reference: string;
    notes: string;
    image_urls: string[];
    created_at: string;
    updated_at: string;
    dirty: number;
    /** 1 = deleted on this phone, still needs deleting online. Hidden everywhere. */
    deleted: number;
}

class HedraiosDB extends Dexie {
    entries!: EntityTable<JournalEntry, "id">;
    prayers!: EntityTable<Prayer, "id">;
    readings!: EntityTable<Reading, "id">;

    constructor() {
        super("hedraios");
        this.version(1).stores({
            entries: "++id, user_id, created_at, updated_at, dirty",
            prayers: "++id, user_id, status, created_at, dirty",
            readings: "++id, user_id, date, dirty",
        });
        // v2 links phone rows to online rows.
        this.version(2).stores({
            entries: "++id, remote_id, user_id, created_at, updated_at, dirty",
            prayers: "++id, remote_id, user_id, status, created_at, dirty",
            readings: "++id, remote_id, user_id, date, dirty",
        });
        // v3 remembers deletes on the phone so they get removed online later.
        // Old rows without the flag count as not deleted.
        this.version(3).stores({
            entries: "++id, remote_id, user_id, created_at, updated_at, dirty, deleted",
            prayers: "++id, remote_id, user_id, status, created_at, dirty, deleted",
            readings: "++id, remote_id, user_id, date, dirty, deleted",
        });
        // v4 adds image attachments to notes + readings. Old rows backfill to [].
        this.version(4)
            .stores({
                entries: "++id, remote_id, user_id, created_at, updated_at, dirty, deleted",
                prayers: "++id, remote_id, user_id, status, created_at, dirty, deleted",
                readings: "++id, remote_id, user_id, date, dirty, deleted",
            })
            .upgrade((tx) => {
                return Promise.all([
                    tx.table("entries").toCollection().modify((e) => {
                        if (!Array.isArray((e as { image_urls?: unknown }).image_urls)) {
                            (e as { image_urls: string[] }).image_urls = [];
                        }
                    }),
                    tx.table("readings").toCollection().modify((r) => {
                        if (!Array.isArray((r as { image_urls?: unknown }).image_urls)) {
                            (r as { image_urls: string[] }).image_urls = [];
                        }
                    }),
                ]).then(() => undefined);
            });
    }
}

export const db = new HedraiosDB();
