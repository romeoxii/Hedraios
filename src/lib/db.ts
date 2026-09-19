import Dexie, { type EntityTable } from 'dexie'

export interface JournalEntry {
  id?: number
  remote_id?: string
  user_id: string
  body: string
  mood?: string
  tags: string[]
  created_at: string
  updated_at: string
  dirty: number
}

export interface Prayer {
  id?: number
  remote_id?: string
  user_id: string
  title: string
  detail: string
  status: 'active' | 'answered'
  created_at: string
  answered_at?: string
  updated_at: string
  dirty: number
}

export interface Reading {
  id?: number
  remote_id?: string
  user_id: string
  date: string
  reference: string
  notes: string
  created_at: string
  updated_at: string
  dirty: number
}

class HedraiosDB extends Dexie {
  entries!: EntityTable<JournalEntry, 'id'>
  prayers!: EntityTable<Prayer, 'id'>
  readings!: EntityTable<Reading, 'id'>

  constructor() {
    super('hedraios')
    this.version(1).stores({
      entries: '++id, user_id, created_at, updated_at, dirty',
      prayers: '++id, user_id, status, created_at, dirty',
      readings: '++id, user_id, date, dirty',
    })
    // v2 adds remote_id indexes so sync can look up rows by Supabase id.
    this.version(2).stores({
      entries: '++id, remote_id, user_id, created_at, updated_at, dirty',
      prayers: '++id, remote_id, user_id, status, created_at, dirty',
      readings: '++id, remote_id, user_id, date, dirty',
    })
  }
}

export const db = new HedraiosDB()
