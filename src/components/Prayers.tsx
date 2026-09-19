import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { usePrayers } from "../hooks/usePrayers";

type Filter = "active" | "answered";

export function Prayers({ userId }: { userId: string }) {
  const {
    prayers,
    loading,
    syncing,
    syncError,
    addPrayer,
    setPrayerStatus,
    deletePrayer,
  } = usePrayers(userId);

  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [saving, setSaving] = useState(false);

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
    setSaving(false);
  }

  async function handleDelete(id: number, remoteId: string | undefined) {
    if (!window.confirm("Delete this prayer?")) return;
    await deletePrayer(id, remoteId);
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Prayers</h1>
        <span className="text-xs opacity-60">
          {syncing ? "Syncing…" : `${counts.active} open`}
        </span>
      </div>

      {syncError && (
        <p className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-500">
          Sync failed: {syncError} (see console for details)
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Prayer request — e.g. healing for mum"
          className="w-full rounded-xl border bg-transparent px-4 py-3 text-base outline-none focus:ring-2"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Detail (optional)"
            className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
          />
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add prayer"}
          </button>
        </div>
      </form>

      <div className="flex gap-2 text-sm">
        {(["active", "answered"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 capitalize ${
              filter === f ? "font-medium" : "opacity-60"
            }`}
          >
            {f} ({f === "active" ? counts.active : counts.answered})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm opacity-60">Loading prayers…</p>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm opacity-60">
          {filter === "active"
            ? "No open prayers — add one above."
            : "No answered prayers yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((prayer) => (
            <motion.article
              key={prayer.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2 text-xs opacity-60">
                <span>
                  {format(new Date(prayer.created_at), "MMM d, h:mm a")}
                  {prayer.dirty === 1 ? " · unsynced" : ""}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPrayerStatus(
                        prayer,
                        prayer.status === "active" ? "answered" : "active",
                      )
                    }
                    className="underline underline-offset-2"
                  >
                    {prayer.status === "active"
                      ? "Mark answered"
                      : "Reopen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(prayer.id!, prayer.remote_id)}
                    className="underline underline-offset-2"
                  >
                    Delete
                  </button>
                </span>
              </div>
              <p className="mt-1 text-[15px] font-medium leading-relaxed">
                {prayer.title}
              </p>
              {prayer.detail && (
                <p className="mt-1 whitespace-pre-wrap text-sm opacity-80">
                  {prayer.detail}
                </p>
              )}
              {prayer.status === "answered" && prayer.answered_at && (
                <p className="mt-2 text-xs opacity-60">
                  Answered {format(new Date(prayer.answered_at), "MMM d, yyyy")}
                </p>
              )}
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
