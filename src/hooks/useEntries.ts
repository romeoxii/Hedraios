import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib/db'
import type { JournalEntry } from '../lib/db'
import { syncEntries } from '../lib/sync'

function nowIso() {
  return new Date().toISOString()
}

export function useEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  // Derived during render: a new userId means we haven't loaded for them yet.
  const loading = userId != null && loadedFor !== userId

  const reloadLocal = useCallback(async () => {
    if (!userId) {
      setEntries([])
      return
    }
    const rows = await db.entries
      .where('user_id')
      .equals(userId)
      .and((e) => e.deleted !== 1)
      .reverse()
      .sortBy('created_at')
    setEntries(rows)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      return
    }
    let cancelled = false
    // Legitimate external sync (Dexie + network fetch on user change).
    // oxlint-disable-next-line react/set-state-in-effect
    reloadLocal().then(() => {
      if (cancelled) return
      setLoadedFor(userId)
      setSyncing(true)
      syncEntries(userId).then(async ({ ok, error }) => {
        if (cancelled) return
        setSyncError(ok ? null : error)
        if (ok) await reloadLocal()
        setSyncing(false)
      })
    })
    return () => {
      cancelled = true
    }
  }, [userId, reloadLocal])

  const runSync = useCallback(async () => {
    if (!userId) return
    const { ok, error } = await syncEntries(userId)
    setSyncError(ok ? null : error)
    if (ok) await reloadLocal()
  }, [userId, reloadLocal])

  // Resync when the browser comes back online: catches up anything that
  // changed (locally or remotely) while offline, without waiting for the
  // user's next action.
  useEffect(() => {
    if (!userId) return
    window.addEventListener('online', runSync)
    return () => window.removeEventListener('online', runSync)
  }, [userId, runSync])

  async function addEntry(body: string, mood: string | undefined, tags: string[]) {
    if (!userId) return
    const stamp = nowIso()
    await db.entries.add({
      user_id: userId,
      body,
      mood,
      tags,
      created_at: stamp,
      updated_at: stamp,
      dirty: 1,
      deleted: 0,
    })
    await reloadLocal()
    await runSync()
  }

  async function updateEntry(
    id: number,
    patch: { body: string; mood: string | undefined; tags: string[] },
  ) {
    if (!userId) return
    await db.entries.update(id, {
      ...patch,
      updated_at: nowIso(),
      dirty: 1,
    })
    await reloadLocal()
    await runSync()
  }

  async function deleteEntry(id: number) {
    if (!userId) return
    // Tombstone: hidden immediately, purged remotely on next sync.
    // Works fully offline — no more orphaned remote rows.
    await db.entries.update(id, {
      deleted: 1,
      dirty: 1,
      updated_at: nowIso(),
    })
    await reloadLocal()
    await runSync()
  }

  return { entries, loading: userId ? loading : false, syncing, syncError, addEntry, updateEntry, deleteEntry }
}
