import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Prayer } from "../lib/db";
import { syncPrayers } from "../lib/sync";

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
      .and((p) => p.deleted !== 1)
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

  const runSync = useCallback(async () => {
    if (!userId) return;
    const { ok, error } = await syncPrayers(userId);
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
      deleted: 0,
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

  async function deletePrayer(id: number) {
    if (!userId) return;
    // Tombstone: hidden immediately, purged remotely on next sync.
    await db.prayers.update(id, {
      deleted: 1,
      dirty: 1,
      updated_at: nowIso(),
    });
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
