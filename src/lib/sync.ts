import { db } from "./db";
import type { JournalEntry, Prayer, Reading } from "./db";
import { supabase } from "./supabaseClient";

interface EntryRow {
  id: string;
  user_id: string;
  body: string;
  mood: string | null;
  tags: string[];
  created_at: string;
}

function nowIso() {
  return new Date().toISOString();
}

async function insertEntryRemote(
  userId: string,
  entry: JournalEntry,
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await supabase
    .from("entries")
    .insert({
      user_id: userId,
      body: entry.body,
      mood: entry.mood ?? null,
      tags: entry.tags,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    created_at: (data.created_at as string) ?? entry.created_at,
  };
}

/** Push local dirty entries to Supabase. Throws on network/auth errors. */
export async function pushEntries(userId: string): Promise<void> {
  // Tombstones first: rows deleted locally. Never-synced rows need no
  // network call; synced rows are purged remotely, then dropped locally.
  const tombstones = await db.entries
    .where("user_id")
    .equals(userId)
    .and((e) => e.dirty === 1 && e.deleted === 1)
    .toArray();

  for (const tomb of tombstones) {
    if (tomb.remote_id) {
      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("id", tomb.remote_id);
      if (error) throw error;
    }
    await db.entries.delete(tomb.id!);
  }

  const pending = await db.entries
    .where("user_id")
    .equals(userId)
    .and((e) => e.dirty === 1 && e.deleted !== 1)
    .toArray();

  for (const entry of pending) {
    if (entry.remote_id) {
      const { data, error } = await supabase
        .from("entries")
        .update({
          body: entry.body,
          mood: entry.mood ?? null,
          tags: entry.tags,
        })
        .eq("id", entry.remote_id)
        .select("id");
      if (error) throw error;
      const touched = ((data ?? []) as { id: string }[]).length;
      if (touched === 0) {
        // Remote row is gone (deleted elsewhere) — resurrect it with local
        // content so the offline edit survives (local-wins).
        const fresh = await insertEntryRemote(userId, entry);
        await db.entries.update(entry.id!, {
          remote_id: fresh.id,
          created_at: fresh.created_at,
          dirty: 0,
          updated_at: nowIso(),
        });
      } else {
        await db.entries.update(entry.id!, {
          dirty: 0,
          updated_at: nowIso(),
        });
      }
    } else {
      const fresh = await insertEntryRemote(userId, entry);
      await db.entries.update(entry.id!, {
        remote_id: fresh.id,
        created_at: fresh.created_at,
        dirty: 0,
        updated_at: nowIso(),
      });
    }
  }
}

/** Pull remote entries into Dexie. Local dirty rows win and are left for push. */
export async function pullEntries(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, user_id, body, mood, tags, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const rows = (data ?? []) as EntryRow[];
  for (const row of rows) {
    const local = await db.entries.where("remote_id").equals(row.id).first();
    if (local) {
      // Local dirty rows (incl. tombstones) win; pushEntries uploads them.
      if (local.dirty === 1 || local.deleted === 1) continue;
      await db.entries.update(local.id!, {
        body: row.body,
        mood: row.mood ?? undefined,
        tags: row.tags ?? [],
        created_at: row.created_at,
        updated_at: nowIso(),
      });
    } else {
      await db.entries.add({
        remote_id: row.id,
        user_id: row.user_id,
        body: row.body,
        mood: row.mood ?? undefined,
        tags: row.tags ?? [],
        created_at: row.created_at,
        updated_at: nowIso(),
        dirty: 0,
        deleted: 0,
      });
    }
  }

  // Delete propagation: rows deleted remotely (another device) vanish
  // locally too — unless they have unsynced local changes (local wins).
  // Only runs when the full remote set was fetched (below the page limit).
  if (rows.length < 500) {
    const remoteIds = new Set(rows.map((r) => r.id));
    const stale = await db.entries
      .where("user_id")
      .equals(userId)
      .and(
        (e) =>
          e.remote_id != null &&
          !remoteIds.has(e.remote_id) &&
          e.dirty !== 1 &&
          e.deleted !== 1,
      )
      .primaryKeys();
    if (stale.length > 0) {
      await db.entries.bulkDelete(stale);
    }
  }
}

export interface SyncResult {
  ok: boolean
  error: string | null
}

function toMessage(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message
  }
  return String(err)
}

/** Full sync: push local changes first, then pull remote. Never throws. */
export async function syncEntries(userId: string): Promise<SyncResult> {
  try {
    await pushEntries(userId);
    await pullEntries(userId);
    return { ok: true, error: null };
  } catch (err) {
    const message = toMessage(err);
    console.warn("[hedraios] entries sync failed:", message, err);
    return { ok: false, error: message };
  }
}

interface PrayerRow {
  id: string;
  user_id: string;
  title: string;
  detail: string;
  status: "active" | "answered";
  created_at: string;
  answered_at: string | null;
}

async function insertPrayerRemote(
  userId: string,
  prayer: Prayer,
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await supabase
    .from("prayers")
    .insert({
      user_id: userId,
      title: prayer.title,
      detail: prayer.detail,
      status: prayer.status,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    created_at: (data.created_at as string) ?? prayer.created_at,
  };
}

/** Push local dirty prayers to Supabase. Throws on network/auth errors. */
export async function pushPrayers(userId: string): Promise<void> {
  // Tombstones first: rows deleted locally. Never-synced rows need no
  // network call; synced rows are purged remotely, then dropped locally.
  const tombstones = await db.prayers
    .where("user_id")
    .equals(userId)
    .and((p) => p.dirty === 1 && p.deleted === 1)
    .toArray();

  for (const tomb of tombstones) {
    if (tomb.remote_id) {
      const { error } = await supabase
        .from("prayers")
        .delete()
        .eq("id", tomb.remote_id);
      if (error) throw error;
    }
    await db.prayers.delete(tomb.id!);
  }

  const pending = await db.prayers
    .where("user_id")
    .equals(userId)
    .and((p) => p.dirty === 1 && p.deleted !== 1)
    .toArray();

  for (const prayer of pending) {
    if (prayer.remote_id) {
      const { data, error } = await supabase
        .from("prayers")
        .update({
          title: prayer.title,
          detail: prayer.detail,
          status: prayer.status,
          answered_at: prayer.answered_at ?? null,
        })
        .eq("id", prayer.remote_id)
        .select("id");
      if (error) throw error;
      const touched = ((data ?? []) as { id: string }[]).length;
      if (touched === 0) {
        // Remote row is gone (deleted elsewhere) — resurrect it with local
        // content so the offline edit survives (local-wins).
        const fresh = await insertPrayerRemote(userId, prayer);
        await db.prayers.update(prayer.id!, {
          remote_id: fresh.id,
          created_at: fresh.created_at,
          dirty: 0,
          updated_at: nowIso(),
        });
      } else {
        await db.prayers.update(prayer.id!, {
          dirty: 0,
          updated_at: nowIso(),
        });
      }
    } else {
      const fresh = await insertPrayerRemote(userId, prayer);
      await db.prayers.update(prayer.id!, {
        remote_id: fresh.id,
        created_at: fresh.created_at,
        dirty: 0,
        updated_at: nowIso(),
      });
    }
  }
}

/** Pull remote prayers into Dexie. Local dirty rows win and are left for push. */
export async function pullPrayers(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("prayers")
    .select("id, user_id, title, detail, status, created_at, answered_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const rows = (data ?? []) as PrayerRow[];
  for (const row of rows) {
    const local = await db.prayers.where("remote_id").equals(row.id).first();
    if (local) {
      // Local dirty rows (incl. tombstones) win; pushPrayers uploads them.
      if (local.dirty === 1 || local.deleted === 1) continue;
      await db.prayers.update(local.id!, {
        title: row.title,
        detail: row.detail,
        status: row.status,
        created_at: row.created_at,
        answered_at: row.answered_at ?? undefined,
        updated_at: nowIso(),
      });
    } else {
      await db.prayers.add({
        remote_id: row.id,
        user_id: row.user_id,
        title: row.title,
        detail: row.detail,
        status: row.status,
        created_at: row.created_at,
        answered_at: row.answered_at ?? undefined,
        updated_at: nowIso(),
        dirty: 0,
        deleted: 0,
      });
    }
  }

  // Delete propagation: rows deleted remotely (another device) vanish
  // locally too — unless they have unsynced local changes (local wins).
  // Only runs when the full remote set was fetched (below the page limit).
  if (rows.length < 500) {
    const remoteIds = new Set(rows.map((r) => r.id));
    const stale = await db.prayers
      .where("user_id")
      .equals(userId)
      .and(
        (p) =>
          p.remote_id != null &&
          !remoteIds.has(p.remote_id) &&
          p.dirty !== 1 &&
          p.deleted !== 1,
      )
      .primaryKeys();
    if (stale.length > 0) {
      await db.prayers.bulkDelete(stale);
    }
  }
}

/** Full prayers sync: push local changes first, then pull remote. Never throws. */
export async function syncPrayers(userId: string): Promise<SyncResult> {
  try {
    await pushPrayers(userId);
    await pullPrayers(userId);
    return { ok: true, error: null };
  } catch (err) {
    const message = toMessage(err);
    console.warn("[hedraios] prayers sync failed:", message, err);
    return { ok: false, error: message };
  }
}

interface ReadingRow {
  id: string;
  user_id: string;
  date: string;
  reference: string;
  notes: string;
  created_at: string;
}

async function insertReadingRemote(
  userId: string,
  reading: Reading,
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await supabase
    .from("readings")
    .insert({
      user_id: userId,
      date: reading.date,
      reference: reading.reference,
      notes: reading.notes,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    created_at: (data.created_at as string) ?? reading.created_at,
  };
}

/** Push local dirty readings to Supabase. Throws on network/auth errors. */
export async function pushReadings(userId: string): Promise<void> {
  // Tombstones first: rows deleted locally. Never-synced rows need no
  // network call; synced rows are purged remotely, then dropped locally.
  const tombstones = await db.readings
    .where("user_id")
    .equals(userId)
    .and((r) => r.dirty === 1 && r.deleted === 1)
    .toArray();

  for (const tomb of tombstones) {
    if (tomb.remote_id) {
      const { error } = await supabase
        .from("readings")
        .delete()
        .eq("id", tomb.remote_id);
      if (error) throw error;
    }
    await db.readings.delete(tomb.id!);
  }

  const pending = await db.readings
    .where("user_id")
    .equals(userId)
    .and((r) => r.dirty === 1 && r.deleted !== 1)
    .toArray();

  for (const reading of pending) {
    if (reading.remote_id) {
      const { data, error } = await supabase
        .from("readings")
        .update({
          date: reading.date,
          reference: reading.reference,
          notes: reading.notes,
        })
        .eq("id", reading.remote_id)
        .select("id");
      if (error) throw error;
      const touched = ((data ?? []) as { id: string }[]).length;
      if (touched === 0) {
        // Remote row is gone (deleted elsewhere) — resurrect it with local
        // content so the offline edit survives (local-wins).
        const fresh = await insertReadingRemote(userId, reading);
        await db.readings.update(reading.id!, {
          remote_id: fresh.id,
          created_at: fresh.created_at,
          dirty: 0,
          updated_at: nowIso(),
        });
      } else {
        await db.readings.update(reading.id!, {
          dirty: 0,
          updated_at: nowIso(),
        });
      }
    } else {
      const fresh = await insertReadingRemote(userId, reading);
      await db.readings.update(reading.id!, {
        remote_id: fresh.id,
        created_at: fresh.created_at,
        dirty: 0,
        updated_at: nowIso(),
      });
    }
  }
}

/** Pull remote readings into Dexie. Local dirty rows win and are left for push. */
export async function pullReadings(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("readings")
    .select("id, user_id, date, reference, notes, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const rows = (data ?? []) as ReadingRow[];
  for (const row of rows) {
    const local = await db.readings.where("remote_id").equals(row.id).first();
    if (local) {
      // Local dirty rows (incl. tombstones) win; pushReadings uploads them.
      if (local.dirty === 1 || local.deleted === 1) continue;
      await db.readings.update(local.id!, {
        date: row.date,
        reference: row.reference,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: nowIso(),
      });
    } else {
      await db.readings.add({
        remote_id: row.id,
        user_id: row.user_id,
        date: row.date,
        reference: row.reference,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: nowIso(),
        dirty: 0,
        deleted: 0,
      });
    }
  }

  // Delete propagation: rows deleted remotely (another device) vanish
  // locally too — unless they have unsynced local changes (local wins).
  // Only runs when the full remote set was fetched (below the page limit).
  if (rows.length < 500) {
    const remoteIds = new Set(rows.map((r) => r.id));
    const stale = await db.readings
      .where("user_id")
      .equals(userId)
      .and(
        (r) =>
          r.remote_id != null &&
          !remoteIds.has(r.remote_id) &&
          r.dirty !== 1 &&
          r.deleted !== 1,
      )
      .primaryKeys();
    if (stale.length > 0) {
      await db.readings.bulkDelete(stale);
    }
  }
}

/** Full readings sync: push local changes first, then pull remote. Never throws. */
export async function syncReadings(userId: string): Promise<SyncResult> {
  try {
    await pushReadings(userId);
    await pullReadings(userId);
    return { ok: true, error: null };
  } catch (err) {
    const message = toMessage(err);
    console.warn("[hedraios] readings sync failed:", message, err);
    return { ok: false, error: message };
  }
}
