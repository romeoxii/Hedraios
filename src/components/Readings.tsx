import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { ConfirmDialog } from "./ConfirmDialog";
import { DatePicker } from "./DatePicker";
import { Preview } from "./Preview";
import { useReadings } from "../hooks/useReadings";
import { toast } from "../lib/toast";

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
    const { readings, loading, syncing, syncError, addReading, updateReading, deleteReading } =
        useReadings(userId);

    const [date, setDate] = useState(todayIso());
    const [reference, setReference] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDate, setEditDate] = useState("");
    const [editReference, setEditReference] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [pendingDelete, setPendingDelete] = useState<number | null>(null);

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
        toast("Reading logged");
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
        toast("Reading updated");
    }

    async function handleDelete(id: number) {
        setPendingDelete(id);
    }

    async function confirmDelete() {
        if (pendingDelete == null) return;
        setPendingDelete(null);
        await deleteReading(pendingDelete);
        toast("Reading deleted");
    }

    return (
        <div className="flex flex-col gap-5 py-6">
            <div className="flex items-baseline justify-between">
                <h1 className="section-title text-2xl">Readings</h1>
                <span className="meta">{syncing ? "Syncing…" : `${readings.length} logged`}</span>
            </div>

            {syncError && (
                <p className="alert-error">Sync failed: {syncError} (see console for details)</p>
            )}

            <form onSubmit={handleSubmit} className="card flex flex-col gap-2">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <DatePicker value={date} onChange={setDate} label="Reading date" />
                    <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Reference — e.g. John 1:1-5"
                        aria-label="Scripture reference"
                        className="field min-w-0 flex-1"
                    />
                </div>
                <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    aria-label="Reading notes"
                    className="field"
                />
                <button
                    type="submit"
                    disabled={!reference.trim() || !date || saving}
                    className="btn btn-primary self-start"
                >
                    {saving ? "Saving…" : "Log reading"}
                </button>
            </form>

            {loading ? (
                <p className="meta py-8 text-center">Loading readings…</p>
            ) : groups.length === 0 ? (
                <p className="meta py-8 text-center">No readings yet — log your first one above.</p>
            ) : (
                <div className="flex flex-col gap-5">
                    {groups.map(([groupDate, items]) => (
                        <section key={groupDate}>
                            <h2
                                className="meta font-medium uppercase"
                                style={{
                                    letterSpacing: "0.06em",
                                    fontSize: "0.75rem",
                                    color: "var(--hue-reading)",
                                }}
                            >
                                {formatGroup(groupDate)}
                            </h2>
                            <div className="mt-2 flex flex-col gap-3">
                                {items.map((reading) => (
                                    <motion.article
                                        key={reading.id}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="card"
                                    >
                                        {editingId === reading.id ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex gap-2">
                                                    <DatePicker
                                                        value={editDate}
                                                        onChange={setEditDate}
                                                        label="Reading date"
                                                    />
                                                    <input
                                                        value={editReference}
                                                        onChange={(e) =>
                                                            setEditReference(e.target.value)
                                                        }
                                                        placeholder="Reference"
                                                        aria-label="Scripture reference"
                                                        className="field flex-1"
                                                        style={{ fontSize: "0.875rem" }}
                                                    />
                                                </div>
                                                <textarea
                                                    rows={2}
                                                    value={editNotes}
                                                    onChange={(e) => setEditNotes(e.target.value)}
                                                    placeholder="Notes"
                                                    aria-label="Reading notes"
                                                    className="field"
                                                    style={{ fontSize: "0.875rem" }}
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditSave(reading.id!)}
                                                        className="btn btn-sm btn-primary"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingId(null)}
                                                        className="btn btn-sm btn-ghost"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="meta flex items-center justify-between gap-2">
                                                    <span>
                                                        {reading.dirty === 1
                                                            ? "unsynced"
                                                            : "synced"}
                                                    </span>
                                                    <span className="flex gap-3">
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
                                                            className="link-btn link-btn--edit"
                                                            style={{ fontSize: "inherit" }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleDelete(reading.id!)
                                                            }
                                                            className="link-btn link-btn--delete"
                                                            style={{ fontSize: "inherit" }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </span>
                                                </div>
                                                <p
                                                    className="mt-1 leading-relaxed"
                                                    style={{
                                                        fontSize: "0.9375rem",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {reading.reference}
                                                </p>
                                                {reading.notes && (
                                                    <div className="mt-1">
                                                        <Preview
                                                            text={reading.notes}
                                                            to={`/read/reading/${reading.id}`}
                                                        />
                                                    </div>
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
            <ConfirmDialog
                open={pendingDelete !== null}
                title="Delete this reading?"
                message="The reading will be removed here and in Supabase on next sync. This can't be undone."
                onCancel={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
            />
        </div>
    );
}
