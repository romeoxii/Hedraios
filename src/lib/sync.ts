import { db } from "./db";
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

/** Push local dirty entries to Supabase. Throws on network/auth errors. */
export async function pushEntries(userId: string): Promise<void> {
  const pending = await db.entries
    .where("user_id")
    .equals(userId)
    .and((e) => e.dirty === 1)
    .toArray();

  for (const entry of pending) {
    if (entry.remote_id) {
      const { error } = await supabase
        .from("entries")
        .update({
          body: entry.body,
          mood: entry.mood ?? null,
          tags: entry.tags,
        })
        .eq("id", entry.remote_id);
      if (error) throw error;
      await db.entries.update(entry.id!, {
        dirty: 0,
        updated_at: nowIso(),
      });
    } else {
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
      await db.entries.update(entry.id!, {
        remote_id: data.id as string,
        created_at: (data.created_at as string) ?? entry.created_at,
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
      if (local.dirty === 1) continue; // local wins; pushEntries will upload
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
      });
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

/** Push local dirty prayers to Supabase. Throws on network/auth errors. */
export async function pushPrayers(userId: string): Promise<void> {
  const pending = await db.prayers
    .where("user_id")
    .equals(userId)
    .and((p) => p.dirty === 1)
    .toArray();

  for (const prayer of pending) {
    if (prayer.remote_id) {
      const { error } = await supabase
        .from("prayers")
        .update({
          title: prayer.title,
          detail: prayer.detail,
          status: prayer.status,
          answered_at: prayer.answered_at ?? null,
        })
        .eq("id", prayer.remote_id);
      if (error) throw error;
      await db.prayers.update(prayer.id!, {
        dirty: 0,
        updated_at: nowIso(),
      });
    } else {
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
      await db.prayers.update(prayer.id!, {
        remote_id: data.id as string,
        created_at: (data.created_at as string) ?? prayer.created_at,
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
      if (local.dirty === 1) continue; // local wins; pushPrayers will upload
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
      });
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

/** Push local dirty readings to Supabase. Throws on network/auth errors. */
export async function pushReadings(userId: string): Promise<void> {
  const pending = await db.readings
    .where("user_id")
    .equals(userId)
    .and((r) => r.dirty === 1)
    .toArray();

  for (const reading of pending) {
    if (reading.remote_id) {
      const { error } = await supabase
        .from("readings")
        .update({
          date: reading.date,
          reference: reading.reference,
          notes: reading.notes,
        })
        .eq("id", reading.remote_id);
      if (error) throw error;
      await db.readings.update(reading.id!, {
        dirty: 0,
        updated_at: nowIso(),
      });
    } else {
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
      await db.readings.update(reading.id!, {
        remote_id: data.id as string,
        created_at: (data.created_at as string) ?? reading.created_at,
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
      if (local.dirty === 1) continue; // local wins; pushReadings will upload
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
      });
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
