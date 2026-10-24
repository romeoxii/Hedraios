import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Reading } from "../lib/db";
import { syncReadings } from "../lib/sync";

function nowIso() {
    return new Date().toISOString();
}

export function useReadings(userId: string | undefined) {
    const [readings, setReadings] = useState<Reading[]>([]);
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    // Still loading when the account switched and nothing loaded for it yet.
    const loading = userId != null && loadedFor !== userId;

    const reloadLocal = useCallback(async () => {
        if (!userId) {
            setReadings([]);
            return;
        }
        const rows = await db.readings
            .where("user_id")
            .equals(userId)
            .and((r) => r.deleted !== 1)
            .reverse()
            .sortBy("created_at");
        rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        setReadings(rows);
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            return;
        }
        let cancelled = false;
        // Loads saved readings, then catches up online. Lint rule silenced below on purpose.
        // oxlint-disable-next-line react/set-state-in-effect
        reloadLocal().then(() => {
            if (cancelled) return;
            setLoadedFor(userId);
            setSyncing(true);
            syncReadings(userId).then(async ({ ok, error }) => {
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
            const { ok, error } = await syncReadings(userId, { force });
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

    async function addReading(
        date: string,
        reference: string,
        notes: string,
        image_urls: string[] = [],
    ) {
        if (!userId) return;
        const stamp = nowIso();
        await db.readings.add({
            user_id: userId,
            date,
            reference,
            notes,
            image_urls,
            created_at: stamp,
            updated_at: stamp,
            dirty: 1,
            deleted: 0,
        });
        await reloadLocal();
        await runSync(true);
    }

    async function updateReading(
        id: number,
        patch: { date: string; reference: string; notes: string; image_urls?: string[] },
    ) {
        if (!userId) return;
        await db.readings.update(id, {
            ...patch,
            updated_at: nowIso(),
            dirty: 1,
        });
        await reloadLocal();
        await runSync(true);
    }

    async function deleteReading(id: number) {
        if (!userId) return;
        // Delete hides it now, removes it online later.
        await db.readings.update(id, {
            deleted: 1,
            dirty: 1,
            updated_at: nowIso(),
        });
        await reloadLocal();
        await runSync(true);
    }

    return {
        readings,
        loading: userId ? loading : false,
        syncing,
        syncError,
        addReading,
        updateReading,
        deleteReading,
    };
}
