import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Prayer } from "../lib/db";
import { syncPrayers } from "../lib/sync";
import { supabase } from "../lib/supabaseClient";

function nowIso() {
  return new Date().toISOString();
}

export function usePrayers(userId: string | undefined) {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Derived during render: a new userId means we haven't loaded for them yet.
  const loading = userId != null && loadedFor !== userId;

  const reloadLocal = useCallback(async () => {
    if (!userId) {
      setPrayers([]);
      return;
    }
    const rows = await db.prayers
      .where("user_id")
      .equals(userId)
      .reverse()
      .sortBy("created_at");
    setPrayers(rows);
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
      syncPrayers(userId).then(async ({ ok, error }) => {
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
    const { ok, error } = await syncPrayers(userId);
    setSyncError(ok ? null : error);
    if (ok) await reloadLocal();
  }

  async function addPrayer(title: string, detail: string) {
    if (!userId) return;
    const stamp = nowIso();
    await db.prayers.add({
      user_id: userId,
      title,
      detail,
      status: "active",
      created_at: stamp,
      updated_at: stamp,
      dirty: 1,
    });
    await reloadLocal();
    await runSync();
  }

  async function setPrayerStatus(prayer: Prayer, status: "active" | "answered") {
    if (!userId || prayer.id == null) return;
    await db.prayers.update(prayer.id, {
      status,
      answered_at: status === "answered" ? nowIso() : undefined,
      updated_at: nowIso(),
      dirty: 1,
    });
    await reloadLocal();
    await runSync();
  }

  async function deletePrayer(id: number, remoteId: string | undefined) {
    if (!userId) return;
    if (remoteId) {
      // Best effort: remove remotely when online; local delete always happens.
      await supabase.from("prayers").delete().eq("id", remoteId).then(() => {});
    }
    await db.prayers.delete(id);
    await reloadLocal();
    await runSync();
  }

  return {
    prayers,
    loading: userId ? loading : false,
    syncing,
    syncError,
    addPrayer,
    setPrayerStatus,
    deletePrayer,
  };
}
