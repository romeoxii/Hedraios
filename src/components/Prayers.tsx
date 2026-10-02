import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ConfirmDialog } from "./ConfirmDialog";
import { Preview } from "./Preview";
import { AutoTextarea } from "./AutoTextarea";
import { usePrayers } from "../hooks/usePrayers";
import { useAutosave, useManualDrafts } from "../hooks/useComposerDraft";
import { toast } from "../lib/toast";
import type { Prayer } from "../lib/db";

type Filter = "active" | "answered";

export function Prayers({ userId }: { userId: string }) {
    const { prayers, loading, syncing, syncError, addPrayer, setPrayerStatus, deletePrayer } =
        usePrayers(userId);

    const [title, setTitle] = useState("");
    const [detail, setDetail] = useState("");
    const [filter, setFilter] = useState<Filter>("active");
    const [saving, setSaving] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<number | null>(null);

    const isPrayerEmpty = useCallback(
        (p: { title: string; detail: string }) => !p.title.trim() && !p.detail.trim(),
        [],
    );
    const restorePrayer = useCallback((p: { title: string; detail: string }) => {
        setTitle(p.title);
        setDetail(p.detail);
    }, []);
    const { clearAutosave } = useAutosave("prayers", userId, { title, detail }, isPrayerEmpty, restorePrayer);
    const { drafts, saveDraft, deleteDraft } = useManualDrafts<{
        title: string;
        detail: string;
    }>("prayers", userId);

    function handleSaveDraft() {
        if (!title.trim() && !detail.trim()) {
            toast("Nothing to draft yet");
            return;
        }
        saveDraft({ title, detail });
        setTitle("");
        setDetail("");
        clearAutosave();
        toast("Draft saved");
    }

    const counts = useMemo(
        () => ({
            active: prayers.filter((p) => p.status === "active").length,
            answered: prayers.filter((p) => p.status === "answered").length,
        }),
        [prayers],
    );
    const visible = prayers.filter((p) => p.status === filter);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed || saving) return;
        setSaving(true);
        await addPrayer(trimmed, detail.trim());
        setTitle("");
        setDetail("");
        clearAutosave();
        setSaving(false);
        toast("Prayer added");
    }

    async function handleDelete(id: number) {
        setPendingDelete(id);
    }

    async function confirmDelete() {
        if (pendingDelete == null) return;
        setPendingDelete(null);
        await deletePrayer(pendingDelete);
        toast("Prayer deleted");
    }

    async function toggleStatus(prayer: Prayer) {
        if (prayer.id == null) return;
        const next = prayer.status === "active" ? "answered" : "active";
        await setPrayerStatus(prayer, next);
        toast(next === "answered" ? "Prayer marked answered" : "Prayer reopened");
    }

    return (
        <div className="flex flex-col gap-5 py-6">
            <div className="flex items-baseline justify-between">
                <h1 className="section-title text-2xl">Prayers</h1>
                <span className="meta">{syncing ? "Syncing…" : `${counts.active} open`}</span>
            </div>

            {syncError && (
                <p className="alert-error">Sync failed: {syncError} (see console for details)</p>
            )}

            <form onSubmit={handleSubmit} className="card flex flex-col gap-2">
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Prayer request — e.g. healing for mum"
                    aria-label="Prayer request"
                    className="field"
                />
                <AutoTextarea
                    rows={5}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="Detail (optional)"
                    aria-label="Detail"
                    className="field field--medium"
                />
                <button
                    type="submit"
                    disabled={!title.trim() || saving}
                    className="btn btn-primary self-start"
                >
                    {saving ? "Saving…" : "Add"}
                </button>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={!title.trim() && !detail.trim()}
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
                                {(d.payload.title || "Untitled draft").slice(0, 80)}
                                <span className="meta">
                                    {" "}
                                    · {format(new Date(d.savedAt), "MMM d, h:mm a")}
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    restorePrayer(d.payload);
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

            <div className="flex gap-2 text-sm">
                {(["active", "answered"] as Filter[]).map((f) => {
                    const isActive = filter === f;
                    return (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            aria-pressed={isActive}
                            className="rounded-full px-4 py-1.5 capitalize"
                            style={{
                                border: "1px solid transparent",
                                background: isActive ? "var(--hue-prayer-soft)" : "var(--surface)",
                                color: isActive ? "var(--hue-prayer)" : "var(--muted)",
                                fontWeight: isActive ? 600 : 400,
                                borderColor: isActive ? "transparent" : "var(--border)",
                            }}
                        >
                            {f === "active" ? "open" : f} ({f === "active" ? counts.active : counts.answered})
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <p className="meta py-8 text-center">Loading prayers…</p>
            ) : visible.length === 0 ? (
                <p className="meta py-8 text-center">
                    {filter === "active"
                        ? "No open prayers — add one above."
                        : "No answered prayers yet."}
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {visible.map((prayer) => (
                        <motion.article
                            key={prayer.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="card"
                        >
                            <div className="meta flex items-center justify-between gap-2">
                                <span>
                                    {format(new Date(prayer.created_at), "MMM d, h:mm a")}
                                    {prayer.dirty === 1 ? " · unsynced" : ""}
                                </span>
                                <span className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => toggleStatus(prayer)}
                                        className="link-btn"
                                        style={{ fontSize: "inherit" }}
                                    >
                                        {prayer.status === "active" ? "Mark answered" : "Reopen"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(prayer.id!)}
                                        className="link-btn link-btn--delete"
                                        style={{ fontSize: "inherit" }}
                                    >
                                        Delete
                                    </button>
                                </span>
                            </div>
                            <p
                                className="mt-1 leading-relaxed"
                                style={{ fontSize: "0.9375rem", fontWeight: 600 }}
                            >
                                {prayer.title}
                            </p>
                            {prayer.detail && (
                                <div className="mt-1">
                                    <Link
                                        to={`/read/prayer/${prayer.id}`}
                                        aria-label="Open full prayer"
                                        style={{ textDecoration: "none", display: "block" }}
                                    >
                                        <Preview text={prayer.detail} />
                                    </Link>
                                </div>
                            )}
                            {prayer.status === "answered" && prayer.answered_at && (
                                <p className="meta mt-2">
                                    Answered {format(new Date(prayer.answered_at), "MMM d, yyyy")}
                                </p>
                            )}
                        </motion.article>
                    ))}
                </div>
            )}
            <ConfirmDialog
                open={pendingDelete !== null}
                title="Delete this prayer?"
                message="Prayer will be permanently deleted. This can't be undone."
                onCancel={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
            />
        </div>
    );
}
