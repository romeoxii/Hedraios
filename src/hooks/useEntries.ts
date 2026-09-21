import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db";
import type { JournalEntry } from "../lib/db";
import { syncEntries } from "../lib/sync";

function nowIso() {
    return new Date().toISOString();
}

export function useEntries(userId: string | undefined) {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    // Still loading when the account switched and nothing loaded for it yet.
    const loading = userId != null && loadedFor !== userId;

    const reloadLocal = useCallback(async () => {
        if (!userId) {
            setEntries([]);
            return;
        }
        const rows = await db.entries
            .where("user_id")
            .equals(userId)
            .and((e) => e.deleted !== 1)
            .reverse()
            .sortBy("created_at");
        setEntries(rows);
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            return;
        }
        let cancelled = false;
        // Loads saved notes, then catches up online. Lint rule silenced below on purpose.
        // oxlint-disable-next-line react/set-state-in-effect
        reloadLocal().then(() => {
            if (cancelled) return;
            setLoadedFor(userId);
            setSyncing(true);
            syncEntries(userId).then(async ({ ok, error }) => {
                if (cancelled) return;
                setSyncError(ok ? null : error);
                if (ok) await reloadLocal();
                setSyncing(false);
            });
        });
        return () => {
            cancelled = true;
        };
    }, [userId, reloadLocal]);

    const runSync = useCallback(
        async (force = false) => {
            if (!userId) return;
            const { ok, error } = await syncEntries(userId, { force });
            setSyncError(ok ? null : error);
            if (ok) await reloadLocal();
        },
        [userId, reloadLocal],
    );

    // Back online means catch up right away, no waiting for the next tap.
    useEffect(() => {
        if (!userId) return;
        const handleOnline = () => runSync(true);
        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, [userId, runSync]);

    async function addEntry(body: string, mood: string | undefined, tags: string[]) {
        if (!userId) return;
        const stamp = nowIso();
        await db.entries.add({
            user_id: userId,
            body,
            mood,
            tags,
            created_at: stamp,
            updated_at: stamp,
            dirty: 1,
            deleted: 0,
        });
        await reloadLocal();
        await runSync(true);
    }

    async function updateEntry(
        id: number,
        patch: { body: string; mood: string | undefined; tags: string[] },
    ) {
        if (!userId) return;
        await db.entries.update(id, {
            ...patch,
            updated_at: nowIso(),
            dirty: 1,
        });
        await reloadLocal();
        await runSync(true);
    }

    async function deleteEntry(id: number) {
        if (!userId) return;
        // Delete hides it now, removes it online later. Works with no internet.
        await db.entries.update(id, {
            deleted: 1,
            dirty: 1,
            updated_at: nowIso(),
        });
        await reloadLocal();
        await runSync(true);
    }

    return {
        entries,
        loading: userId ? loading : false,
        syncing,
        syncError,
        addEntry,
        updateEntry,
        deleteEntry,
    };
}
