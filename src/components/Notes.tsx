import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { ConfirmDialog } from "./ConfirmDialog";
import { Preview } from "./Preview";
import { AutoTextarea } from "./AutoTextarea";
import { ImageAttachments } from "./ImageAttachments";
import { useEntries } from "../hooks/useEntries";
import { toast } from "../lib/toast";
import { deleteEntryImage, MAX_IMAGES_PER_ENTRY, uploadEntryImage } from "../lib/images";

function parseTags(input: string): string[] {
    const seen = new Set<string>();
    for (const part of input.split(",")) {
        const tag = part.trim().replace(/^#+/, "");
        if (tag && !seen.has(tag.toLowerCase())) {
            seen.add(tag.toLowerCase());
        }
    }
    return [...seen];
}

/** Picks the tag color. Same tag, same color, every time. */
function tagTint(tag: string): string {
    let hash = 0;
    for (let i = 0; i < tag.length; i += 1) {
        hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
    }
    return `tag-${hash % 6}`;
}

export function Notes({ userId }: { userId: string }) {
    const { entries, loading, syncing, syncError, addEntry, updateEntry, deleteEntry } =
        useEntries(userId);

    const [body, setBody] = useState("");
    const [mood, setMood] = useState("");
    const [tagsInput, setTagsInput] = useState("");
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editBody, setEditBody] = useState("");
    const [editMood, setEditMood] = useState("");
    const [editTags, setEditTags] = useState("");
    const [editImages, setEditImages] = useState<string[]>([]);
    const [pendingDelete, setPendingDelete] = useState<number | null>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter(
            (e) =>
                e.body.toLowerCase().includes(q) ||
                (e.mood ?? "").toLowerCase().includes(q) ||
                e.tags.some((t) => t.toLowerCase().includes(q)),
        );
    }, [entries, search]);

    async function uploadFiles(list: FileList, scope: "new" | "edit", entryId?: number) {
        const files = [...list].filter((f) => f.type.startsWith("image/"));
        const current = scope === "new" ? images : editImages;
        const room = MAX_IMAGES_PER_ENTRY - current.length;
        if (files.length === 0 || room <= 0) {
            if (room <= 0) toast(`Max ${MAX_IMAGES_PER_ENTRY} images per note`);
            return;
        }
        if (!navigator.onLine) {
            toast("You're offline — images need a connection");
            return;
        }
        const owner =
            scope === "edit"
                ? (entries.find((e) => e.id === entryId)?.remote_id ?? `local-${entryId}`)
                : `pending-${Date.now()}`;
        setUploading(true);
        try {
            const urls: string[] = [];
            for (const file of files.slice(0, room)) {
                urls.push(await uploadEntryImage(userId, "entry", owner, file));
            }
            if (scope === "new") {
                setImages((prev) => [...prev, ...urls]);
            } else if (entryId != null) {
                const next = [...current, ...urls];
                setEditImages(next);
                const fallback = entries.find((e) => e.id === entryId);
                await updateEntry(entryId, {
                    body: (editBody.trim() || fallback?.body) ?? "",
                    mood: editMood.trim() ? editMood.trim() : fallback?.mood,
                    tags: parseTags(editTags),
                    image_urls: next,
                });
            }
        } catch (err) {
            toast(err instanceof Error ? err.message : "Image upload failed");
        } finally {
            setUploading(false);
        }
    }

    async function removeImage(url: string, scope: "new" | "edit", entryId?: number) {
        if (scope === "new") {
            setImages((prev) => prev.filter((u) => u !== url));
        } else if (entryId != null) {
            const next = editImages.filter((u) => u !== url);
            setEditImages(next);
            const fallback = entries.find((e) => e.id === entryId);
            await updateEntry(entryId, {
                body: (editBody.trim() || fallback?.body) ?? "",
                mood: editMood.trim() ? editMood.trim() : fallback?.mood,
                tags: parseTags(editTags),
                image_urls: next,
            });
        }
        await deleteEntryImage(url);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = body.trim();
        if (!trimmed || saving) return;
        setSaving(true);
        await addEntry(
            trimmed,
            mood.trim() ? mood.trim() : undefined,
            parseTags(tagsInput),
            images,
        );
        setBody("");
        setMood("");
        setTagsInput("");
        setImages([]);
        setSaving(false);
        toast("Entry saved");
    }

    function startEdit(
        id: number,
        body: string,
        mood: string | undefined,
        tags: string[],
        image_urls: string[] = [],
    ) {
        setEditingId(id);
        setEditBody(body);
        setEditMood(mood ?? "");
        setEditTags(tags.join(", "));
        setEditImages(image_urls);
    }

    async function handleEditSave(id: number) {
        const trimmed = editBody.trim();
        if (!trimmed) return;
        await updateEntry(id, {
            body: trimmed,
            mood: editMood.trim() ? editMood.trim() : undefined,
            tags: parseTags(editTags),
            image_urls: editImages,
        });
        setEditingId(null);
        toast("Entry updated");
    }

    async function handleDelete(id: number) {
        setPendingDelete(id);
    }

    async function confirmDelete() {
        if (pendingDelete == null) return;
        setPendingDelete(null);
        await deleteEntry(pendingDelete);
        toast("Entry deleted");
    }

    return (
        <div className="flex flex-col gap-5 py-6">
            <div className="flex items-baseline justify-between">
                <h1 className="section-title text-2xl">Notes</h1>
                <span className="meta">{syncing ? "Syncing…" : `${entries.length} entries`}</span>
            </div>
            {syncError && (
                <p className="alert-error">Sync failed: {syncError} (see console for details)</p>
            )}

            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries, moods, tags…"
                aria-label="Search entries"
                className="field"
                style={{ fontSize: "0.875rem" }}
            />

            <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
                <AutoTextarea
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="What's on your heart today?"
                    className="field field--large"
                    style={{
                        border: "none",
                        background: "transparent",
                        padding: "0.7rem",
                    }}
                />
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <input
                        value={mood}
                        onChange={(e) => setMood(e.target.value)}
                        placeholder="Mood"
                        aria-label="Mood"
                        className="field min-w-0 flex-1"
                        style={{ fontSize: "0.875rem" }}
                    />
                    <input
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="Tags, comma separated"
                        aria-label="Tags"
                        className="field min-w-0 flex-1"
                        style={{ fontSize: "0.875rem" }}
                    />
                    <button
                        type="submit"
                        disabled={!body.trim() || saving}
                        className="btn btn-primary"
                    >
                        {saving ? "Saving…" : "Add"}
                    </button>
                </div>
                <ImageAttachments
                    urls={images}
                    uploading={uploading}
                    onSelect={(files) => uploadFiles(files, "new")}
                    onRemove={(url) => removeImage(url, "new")}
                />
            </form>

            {loading ? (
                <p className="meta py-8 text-center">Loading entries…</p>
            ) : filtered.length === 0 ? (
                <p className="meta py-8 text-center">
                    {entries.length === 0
                        ? "No entries yet — write your first one above."
                        : "No entries match your search."}
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {filtered.map((entry) => (
                        <motion.article
                            key={entry.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="card"
                        >
                            {editingId === entry.id ? (
                                <div className="flex flex-col gap-2">
                                    <AutoTextarea
                                        rows={6}
                                        value={editBody}
                                        onChange={(e) => setEditBody(e.target.value)}
                                        className="field field--large"
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            value={editMood}
                                            onChange={(e) => setEditMood(e.target.value)}
                                            placeholder="Mood"
                                            aria-label="Mood"
                                            className="field flex-1"
                                            style={{ fontSize: "0.875rem" }}
                                        />
                                        <input
                                            value={editTags}
                                            onChange={(e) => setEditTags(e.target.value)}
                                            placeholder="Tags"
                                            aria-label="Tags"
                                            className="field flex-1"
                                            style={{ fontSize: "0.875rem" }}
                                        />
                                    </div>
                                    <ImageAttachments
                                        urls={editImages}
                                        uploading={uploading}
                                        onSelect={(files) => uploadFiles(files, "edit", entry.id)}
                                        onRemove={(url) => removeImage(url, "edit", entry.id)}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleEditSave(entry.id!)}
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
                                            {format(new Date(entry.created_at), "MMM d, h:mm a")}
                                            {entry.dirty === 1 ? " · unsynced" : ""}
                                        </span>
                                        <span className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    startEdit(
                                                        entry.id!,
                                                        entry.body,
                                                        entry.mood,
                                                        entry.tags,
                                                        entry.image_urls ?? [],
                                                    )
                                                }
                                                className="link-btn link-btn--edit"
                                                style={{ fontSize: "inherit" }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(entry.id!)}
                                                className="link-btn link-btn--delete"
                                                style={{ fontSize: "inherit" }}
                                            >
                                                Delete
                                            </button>
                                        </span>
                                    </div>
                                    {entry.mood && (
                                        <p
                                            className="mt-1.5 font-medium uppercase"
                                            style={{
                                                fontSize: "0.75rem",
                                                letterSpacing: "0.06em",
                                                color: "var(--accent)",
                                            }}
                                        >
                                            {entry.mood}
                                        </p>
                                    )}
                                    <div className="mt-1">
                                        <Preview text={entry.body} to={`/read/entry/${entry.id}`} />
                                    </div>
                                    {(entry.image_urls ?? []).length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {(entry.image_urls ?? []).map((url) => (
                                                <img
                                                    key={url}
                                                    src={url}
                                                    alt="Note attachment"
                                                    loading="lazy"
                                                    className="h-[72px] w-[72px] rounded-xl object-cover"
                                                    style={{
                                                        border: "1px solid var(--border)",
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    {entry.tags.length > 0 && (
                                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                                            {entry.tags.map((tag) => (
                                                <span key={tag} className={`chip ${tagTint(tag)}`}>
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.article>
                    ))}
                </div>
            )}
            <ConfirmDialog
                open={pendingDelete !== null}
                title="Delete this note?"
                message="Note will be permanently deleted. This can't be undone."
                onCancel={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
            />
        </div>
    );
}
