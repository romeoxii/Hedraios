import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db";
import { localDayKey } from "../lib/dates";
import { calcStreak } from "../lib/streak";

export interface Stats {
    entries: number;
    streak: number;
    prayers: number;
    readings: number;
}

const EMPTY: Stats = { entries: 0, streak: 0, prayers: 0, readings: 0 };

/** Counts for the Today overview. Refreshes on open, reconnect, and tab focus. */
export function useStats(userId: string | undefined) {
    const [stats, setStats] = useState<Stats>(EMPTY);

    const reload = useCallback(async () => {
        if (!userId) {
            setStats(EMPTY);
            return;
        }
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
        const keys = entries.map((e) => localDayKey(e.created_at));
        setStats({
            entries: entries.length,
            streak: calcStreak(keys),
            prayers: prayers.length,
            readings: readings.length,
        });
    }, [userId]);

    useEffect(() => {
        // Reads the saved stuff, then stays fresh. Lint rule silenced below on purpose.
        // oxlint-disable-next-line react/set-state-in-effect
        reload();
        window.addEventListener("online", reload);
        window.addEventListener("focus", reload);
        return () => {
            window.removeEventListener("online", reload);
            window.removeEventListener("focus", reload);
        };
    }, [reload]);

    return { stats, reloadStats: reload };
}
