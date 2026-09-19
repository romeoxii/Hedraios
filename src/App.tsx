import { useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { Journal } from './components/Journal'
import { Prayers } from './components/Prayers'
import { Readings } from './components/Readings'
import { useAuth } from './hooks/useAuth'
import { useOnline } from './hooks/useOnline'
import { AuthProvider } from './lib/auth'
import { supabase } from './lib/supabaseClient'

type Tab = 'today' | 'prayers' | 'readings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'prayers', label: 'Prayers' },
  { id: 'readings', label: 'Readings' },
]

function Shell() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState<Tab>('today')
  const online = useOnline()

  if (loading) {
    return (
      <section className="mx-auto flex min-h-[70svh] w-full max-w-sm flex-col justify-center px-6 text-center">
        <p className="text-sm opacity-70">Loading…</p>
      </section>
    )
  }

  if (!user) {
    return <AuthGate />
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-6">
      <header className="flex items-center justify-between border-b py-4">
        <span className="text-lg font-medium tracking-tight">Hedraios</span>
        <span className="flex items-center gap-3 text-sm">
          <span
            title={online ? 'Online' : 'Offline — changes save locally'}
            className={`inline-block h-2 w-2 rounded-full ${
              online ? 'bg-green-500' : 'bg-amber-500'
            }`}
          />
          {!online && <span className="opacity-70">Offline</span>}
          <span className="opacity-70">{user.email}</span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="rounded-lg border px-3 py-1.5"
          >
            Sign out
          </button>
        </span>
      </header>
      <nav className="flex gap-1 border-b py-2 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-1.5 ${
              tab === t.id ? 'font-medium underline underline-offset-4' : 'opacity-60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className="flex flex-1 flex-col">
        {tab === 'today' && <Journal userId={user.id} />}
        {tab === 'prayers' && <Prayers userId={user.id} />}
        {tab === 'readings' && <Readings userId={user.id} />}
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}

export default App
