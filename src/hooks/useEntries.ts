import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib/db'
import type { JournalEntry } from '../lib/db'
import { syncEntries } from '../lib/sync'
import { supabase } from '../lib/supabaseClient'

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
    })
    await reloadLocal()
    const { ok, error } = await syncEntries(userId)
    setSyncError(ok ? null : error)
    if (ok) await reloadLocal()
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
    const { ok: updateOk, error: updateError } = await syncEntries(userId)
    setSyncError(updateOk ? null : updateError)
    if (updateOk) await reloadLocal()
  }

  async function deleteEntry(id: number, remoteId: string | undefined) {
    if (!userId) return
    if (remoteId) {
      // Best effort: remove remotely when online; local delete always happens.
      await supabase.from('entries').delete().eq('id', remoteId).then(() => {})
    }
    await db.entries.delete(id)
    await reloadLocal()
    const { ok: deleteOk, error: deleteError } = await syncEntries(userId)
    setSyncError(deleteOk ? null : deleteError)
    if (deleteOk) await reloadLocal()
  }

  return { entries, loading: userId ? loading : false, syncing, syncError, addEntry, updateEntry, deleteEntry }
}
