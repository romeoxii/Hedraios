import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ConfirmDialog } from "./ConfirmDialog";
import { DatePicker } from "./DatePicker";
import { Preview } from "./Preview";
import { AutoTextarea } from "./AutoTextarea";
import { ImageAttachments } from "./ImageAttachments";
import { useReadings } from "../hooks/useReadings";
import { useAutosave, useManualDrafts } from "../hooks/useComposerDraft";
import { toast } from "../lib/toast";
import { deleteEntryImage, MAX_IMAGES_PER_ENTRY, uploadEntryImage } from "../lib/images";

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
    const [images, setImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDate, setEditDate] = useState("");
    const [editReference, setEditReference] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [editImages, setEditImages] = useState<string[]>([]);
    const [pendingDelete, setPendingDelete] = useState<number | null>(null);

    const isReadingEmpty = useCallback(
        (p: { date: string; reference: string; notes: string }) =>
            !p.reference.trim() && !p.notes.trim(),
        [],
    );
    const restoreReading = useCallback((p: { date: string; reference: string; notes: string }) => {
        if (p.date) setDate(p.date);
        setReference(p.reference);
        setNotes(p.notes);
    }, []);
    const { clearAutosave } = useAutosave(
        "readings",
        userId,
        { date, reference, notes },
        isReadingEmpty,
        restoreReading,
    );
    const { drafts, saveDraft, deleteDraft } = useManualDrafts<{
        date: string;
        reference: string;
        notes: string;
    }>("readings", userId);

    function handleSaveDraft() {
        if (!reference.trim() && !notes.trim()) {
            toast("Nothing to draft yet");
            return;
        }
        saveDraft({ date, reference, notes });
        setReference("");
        setNotes("");
        setImages([]);
        clearAutosave();
        toast("Draft saved");
    }

    const groups = useMemo(() => {
        const map = new Map<string, typeof readings>();
        for (const r of readings) {
            const list = map.get(r.date) ?? [];
            list.push(r);
            map.set(r.date, list);
        }
        return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    }, [readings]);

    async function uploadFiles(list: FileList, scope: "new" | "edit", readingId?: number) {
        const files = [...list].filter((f) => f.type.startsWith("image/"));
        const current = scope === "new" ? images : editImages;
        const room = MAX_IMAGES_PER_ENTRY - current.length;
        if (files.length === 0 || room <= 0) {
            if (room <= 0) toast(`Max ${MAX_IMAGES_PER_ENTRY} images per reading`);
            return;
        }
        if (!navigator.onLine) {
            toast("You're offline — images need a connection");
            return;
        }
        const owner =
            scope === "edit"
                ? (readings.find((r) => r.id === readingId)?.remote_id ?? `local-${readingId}`)
                : `pending-${Date.now()}`;
        setUploading(true);
        try {
            const urls: string[] = [];
            for (const file of files.slice(0, room)) {
                urls.push(await uploadEntryImage(userId, "reading", owner, file));
            }
            if (scope === "new") {
                setImages((prev) => [...prev, ...urls]);
            } else if (readingId != null) {
                const next = [...current, ...urls];
                setEditImages(next);
                const fallback = readings.find((r) => r.id === readingId);
                await updateReading(readingId, {
                    date: (editDate || fallback?.date) ?? "",
                    reference: (editReference.trim() || fallback?.reference) ?? "",
                    notes: editNotes.trim(),
                    image_urls: next,
                });
            }
        } catch (err) {
            toast(err instanceof Error ? err.message : "Image upload failed");
        } finally {
            setUploading(false);
        }
    }

    async function removeImage(url: string, scope: "new" | "edit", readingId?: number) {
        if (scope === "new") {
            setImages((prev) => prev.filter((u) => u !== url));
        } else if (readingId != null) {
            const next = editImages.filter((u) => u !== url);
            setEditImages(next);
            const fallback = readings.find((r) => r.id === readingId);
            await updateReading(readingId, {
                date: (editDate || fallback?.date) ?? "",
                reference: (editReference.trim() || fallback?.reference) ?? "",
                notes: editNotes.trim(),
                image_urls: next,
            });
        }
        await deleteEntryImage(url);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const ref = reference.trim();
        if (!ref || !date || saving) return;
        setSaving(true);
        await addReading(date, ref, notes.trim(), images);
        setReference("");
        setNotes("");
        setImages([]);
        clearAutosave();
        setSaving(false);
        toast("Reading logged");
    }

    function startEdit(id: number, d: string, ref: string, n: string, image_urls: string[] = []) {
        setEditingId(id);
        setEditDate(d);
        setEditReference(ref);
        setEditNotes(n);
        setEditImages(image_urls);
    }

    async function handleEditSave(id: number) {
        const ref = editReference.trim();
        if (!ref || !editDate) return;
        await updateReading(id, {
            date: editDate,
            reference: ref,
            notes: editNotes.trim(),
            image_urls: editImages,
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
                    <DatePicker
                        value={date}
                        onChange={setDate}
                        label="Reading date"
                        className="min-w-0 flex-1"
                    />
                    <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Reference — e.g. John 1:1-5"
                        aria-label="Scripture reference"
                        className="field min-w-0 flex-1"
                    />
                </div>
                <AutoTextarea
                    rows={5}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    aria-label="Reading notes"
                    className="field field--medium"
                />
                <ImageAttachments
                    urls={images}
                    uploading={uploading}
                    disabled={!reference.trim() && !notes.trim()}
                    onSelect={(files) => uploadFiles(files, "new")}
                    onRemove={(url) => removeImage(url, "new")}
                />
                <button
                    type="submit"
                    disabled={!reference.trim() || !date || saving}
                    className="btn btn-primary self-start"
                >
                    {saving ? "Saving…" : "Log reading"}
                </button>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={!reference.trim() && !notes.trim()}
                        className="btn btn-sm"
                    >
                        Save draft
                    </button>
                    <span className="meta">Autosaves as you type</span>
                </div>
            </form>

            {drafts.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="meta">
                        {drafts.length} draft{drafts.length === 1 ? "" : "s"}
                    </p>
                    {drafts.map((d) => (
                        <div key={d.id} className="card flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm">
                                {(d.payload.reference || "Untitled draft").slice(0, 80)}
                                <span className="meta">
                                    {" "}
                                    · {format(new Date(d.savedAt), "MMM d, h:mm a")}
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    restoreReading(d.payload);
                                    toast("Draft restored");
                                }}
                                className="link-btn link-btn--edit"
                            >
                                Restore
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    deleteDraft(d.id);
                                    toast("Draft deleted");
                                }}
                                className="link-btn link-btn--delete"
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {loading ? (
                <p className="meta py-8 text-center">Loading readings…</p>
            ) : groups.length === 0 ? (
                <p className="meta py-8 text-center">No readings yet. Log your first one above.</p>
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
                                                <div className="flex min-w-0 gap-2">
                                                    <DatePicker
                                                        value={editDate}
                                                        onChange={setEditDate}
                                                        label="Reading date"
                                                        className="min-w-0 flex-1"
                                                    />
                                                    <input
                                                        value={editReference}
                                                        onChange={(e) =>
                                                            setEditReference(e.target.value)
                                                        }
                                                        placeholder="Reference"
                                                        aria-label="Scripture reference"
                                                        className="field min-w-0 flex-1"
                                                    />
                                                </div>
                                                <AutoTextarea
                                                    rows={5}
                                                    value={editNotes}
                                                    onChange={(e) => setEditNotes(e.target.value)}
                                                    placeholder="Notes"
                                                    aria-label="Reading notes"
                                                    className="field field--medium"
                                                />
                                                <ImageAttachments
                                                    urls={editImages}
                                                    uploading={uploading}
                                                    onSelect={(files) =>
                                                        uploadFiles(files, "edit", reading.id)
                                                    }
                                                    onRemove={(url) =>
                                                        removeImage(url, "edit", reading.id)
                                                    }
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
                                                                    reading.image_urls ?? [],
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
                                                        <Link
                                                            to={`/read/reading/${reading.id}`}
                                                            aria-label="Open full reading"
                                                            style={{
                                                                textDecoration: "none",
                                                                display: "block",
                                                            }}
                                                        >
                                                            <Preview text={reading.notes} />
                                                        </Link>
                                                    </div>
                                                )}
                                                {(reading.image_urls ?? []).length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {(reading.image_urls ?? []).map((url) => (
                                                            <img
                                                                key={url}
                                                                src={url}
                                                                alt="Reading attachment"
                                                                loading="lazy"
                                                                className="h-[72px] w-[72px] rounded-xl object-cover"
                                                                style={{
                                                                    border: "1px solid var(--border)",
                                                                }}
                                                            />
                                                        ))}
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
                message="Reading will be permanently deleted. This can't be undone."
                onCancel={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
            />
        </div>
    );
}
