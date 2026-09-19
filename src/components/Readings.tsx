import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useReadings } from "../hooks/useReadings";

function todayIso() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatGroup(dateStr: string) {
  const parsed = new Date(`${dateStr}T12:00:00`);
  return format(parsed, "EEEE, MMM d");
}

export function Readings({ userId }: { userId: string }) {
  const {
    readings,
    loading,
    syncing,
    syncError,
    addReading,
    updateReading,
    deleteReading,
  } = useReadings(userId);

  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, typeof readings>();
    for (const r of readings) {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [readings]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ref = reference.trim();
    if (!ref || !date || saving) return;
    setSaving(true);
    await addReading(date, ref, notes.trim());
    setReference("");
    setNotes("");
    setSaving(false);
  }

  function startEdit(id: number, d: string, ref: string, n: string) {
    setEditingId(id);
    setEditDate(d);
    setEditReference(ref);
    setEditNotes(n);
  }

  async function handleEditSave(id: number) {
    const ref = editReference.trim();
    if (!ref || !editDate) return;
    await updateReading(id, {
      date: editDate,
      reference: ref,
      notes: editNotes.trim(),
    });
    setEditingId(null);
  }

  async function handleDelete(id: number, remoteId: string | undefined) {
    if (!window.confirm("Delete this reading?")) return;
    await deleteReading(id, remoteId);
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Readings</h1>
        <span className="text-xs opacity-60">
          {syncing ? "Syncing…" : `${readings.length} logged`}
        </span>
      </div>

      {syncError && (
        <p className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-500">
          Sync failed: {syncError} (see console for details)
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
          />
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference — e.g. John 1:1-5"
            className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
          />
        </div>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full rounded-xl border bg-transparent px-4 py-3 text-base outline-none focus:ring-2"
        />
        <button
          type="submit"
          disabled={!reference.trim() || !date || saving}
          className="self-start rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Log reading"}
        </button>
      </form>

      {loading ? (
        <p className="py-8 text-center text-sm opacity-60">Loading readings…</p>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-sm opacity-60">
          No readings yet — log your first one above.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([groupDate, items]) => (
            <section key={groupDate}>
              <h2 className="text-sm font-medium uppercase tracking-wide opacity-60">
                {formatGroup(groupDate)}
              </h2>
              <div className="mt-2 flex flex-col gap-3">
                {items.map((reading) => (
                  <motion.article
                    key={reading.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border px-4 py-3"
                  >
                    {editingId === reading.id ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2"
                          />
                          <input
                            value={editReference}
                            onChange={(e) =>
                              setEditReference(e.target.value)
                            }
                            placeholder="Reference"
                            className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Notes"
                          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditSave(reading.id!)}
                            className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg px-3 py-1.5 text-sm opacity-70"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 text-xs opacity-60">
                          <span>
                            {reading.dirty === 1 ? "unsynced" : "synced"}
                          </span>
                          <span className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEdit(
                                  reading.id!,
                                  reading.date,
                                  reading.reference,
                                  reading.notes,
                                )
                              }
                              className="underline underline-offset-2"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(reading.id!, reading.remote_id)
                              }
                              className="underline underline-offset-2"
                            >
                              Delete
                            </button>
                          </span>
                        </div>
                        <p className="mt-1 text-[15px] font-medium leading-relaxed">
                          {reading.reference}
                        </p>
                        {reading.notes && (
                          <p className="mt-1 whitespace-pre-wrap text-sm opacity-80">
                            {reading.notes}
                          </p>
                        )}
                      </>
                    )}
                  </motion.article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
