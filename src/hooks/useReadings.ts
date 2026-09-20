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
  // Derived during render: a new userId means we haven't loaded for them yet.
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
    // Legitimate external sync (Dexie + network fetch on user change).
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

  const runSync = useCallback(async () => {
    if (!userId) return;
    const { ok, error } = await syncReadings(userId);
    setSyncError(ok ? null : error);
    if (ok) await reloadLocal();
  }, [userId, reloadLocal]);

  // Resync when the browser comes back online: catches up anything that
  // changed (locally or remotely) while offline, without waiting for the
  // user's next action.
  useEffect(() => {
    if (!userId) return;
    window.addEventListener("online", runSync);
    return () => window.removeEventListener("online", runSync);
  }, [userId, runSync]);

  async function addReading(date: string, reference: string, notes: string) {
    if (!userId) return;
    const stamp = nowIso();
    await db.readings.add({
      user_id: userId,
      date,
      reference,
      notes,
      created_at: stamp,
      updated_at: stamp,
      dirty: 1,
      deleted: 0,
    });
    await reloadLocal();
    await runSync();
  }

  async function updateReading(
    id: number,
    patch: { date: string; reference: string; notes: string },
  ) {
    if (!userId) return;
    await db.readings.update(id, {
      ...patch,
      updated_at: nowIso(),
      dirty: 1,
    });
    await reloadLocal();
    await runSync();
  }

  async function deleteReading(id: number) {
    if (!userId) return;
    // Tombstone: hidden immediately, purged remotely on next sync.
    await db.readings.update(id, {
      deleted: 1,
      dirty: 1,
      updated_at: nowIso(),
    });
    await reloadLocal();
    await runSync();
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
