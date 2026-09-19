import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Reading } from "../lib/db";
import { syncReadings } from "../lib/sync";
import { supabase } from "../lib/supabaseClient";

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

  async function runSync() {
    if (!userId) return;
    const { ok, error } = await syncReadings(userId);
    setSyncError(ok ? null : error);
    if (ok) await reloadLocal();
  }

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

  async function deleteReading(id: number, remoteId: string | undefined) {
    if (!userId) return;
    if (remoteId) {
      // Best effort: remove remotely when online; local delete always happens.
      await supabase
        .from("readings")
        .delete()
        .eq("id", remoteId)
        .then(() => {});
    }
    await db.readings.delete(id);
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
