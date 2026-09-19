import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { useEntries } from '../hooks/useEntries'
import { calcStreak } from '../lib/streak'

function parseTags(input: string): string[] {
  const seen = new Set<string>()
  for (const part of input.split(',')) {
    const tag = part.trim().replace(/^#+/, '')
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase())
    }
  }
  return [...seen]
}

export function Journal({ userId }: { userId: string }) {
  const { entries, loading, syncing, syncError, addEntry, updateEntry, deleteEntry } =
    useEntries(userId)

  const [body, setBody] = useState('')
  const [mood, setMood] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editMood, setEditMood] = useState('')
  const [editTags, setEditTags] = useState('')

  const streak = useMemo(
    () => calcStreak(entries.map((e) => e.created_at.slice(0, 10))),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.body.toLowerCase().includes(q) ||
        (e.mood ?? '').toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [entries, search])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await addEntry(
      trimmed,
      mood.trim() ? mood.trim() : undefined,
      parseTags(tagsInput),
    )
    setBody('')
    setMood('')
    setTagsInput('')
    setSaving(false)
  }

  function startEdit(id: number, body: string, mood: string | undefined, tags: string[]) {
    setEditingId(id)
    setEditBody(body)
    setEditMood(mood ?? '')
    setEditTags(tags.join(', '))
  }

  async function handleEditSave(id: number) {
    const trimmed = editBody.trim()
    if (!trimmed) return
    await updateEntry(id, {
      body: trimmed,
      mood: editMood.trim() ? editMood.trim() : undefined,
      tags: parseTags(editTags),
    })
    setEditingId(null)
  }

  async function handleDelete(id: number, remoteId: string | undefined) {
    if (!window.confirm('Delete this entry?')) return
    await deleteEntry(id, remoteId)
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-medium tracking-tight">
          {format(new Date(), 'EEEE, MMM d')}
        </h1>
        <span className="text-xs opacity-60">
          {syncing
            ? 'Syncing…'
            : `${entries.length} entries · ${streak}-day streak`}
        </span>
      </div>
      {syncError && (
        <p className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-500">
          Sync failed: {syncError} (see console for details)
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's on your heart today?"
          className="w-full rounded-xl border bg-transparent px-4 py-3 text-base outline-none focus:ring-2"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="Mood (e.g. grateful)"
            className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
          />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags, comma separated"
            className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
          />
          <button
            type="submit"
            disabled={!body.trim() || saving}
            className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add entry'}
          </button>
        </div>
      </form>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search entries, moods, tags…"
        className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
      />

      {loading ? (
        <p className="py-8 text-center text-sm opacity-60">Loading entries…</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm opacity-60">
          {entries.length === 0
            ? 'No entries yet — write your first one above.'
            : 'No entries match your search.'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((entry) => (
            <motion.article
              key={entry.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border px-4 py-3"
            >
              {editingId === entry.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={3}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
                  />
                  <div className="flex gap-2">
                    <input
                      value={editMood}
                      onChange={(e) => setEditMood(e.target.value)}
                      placeholder="Mood"
                      className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2"
                    />
                    <input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="Tags"
                      className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditSave(entry.id!)}
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
                      {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                      {entry.dirty === 1 ? ' · unsynced' : ''}
                    </span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          startEdit(
                            entry.id!,
                            entry.body,
                            entry.mood,
                            entry.tags,
                          )
                        }
                        className="underline underline-offset-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id!, entry.remote_id)}
                        className="underline underline-offset-2"
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                  {entry.mood && (
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide opacity-70">
                      {entry.mood}
                    </p>
                  )}
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
                    {entry.body}
                  </p>
                  {entry.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border px-2 py-0.5 text-xs opacity-80"
                        >
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
    </div>
  )
}
