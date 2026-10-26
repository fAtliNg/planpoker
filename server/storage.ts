import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { DeckId, RoundResult } from '../shared/protocol.ts'

/**
 * Комнаты сохраняются в SQLite, чтобы голоса и история переживали перезапуск сервера
 * и к комнате можно было вернуться по ссылке через несколько дней.
 * Комната хранится одной JSON-строкой: читаем и пишем её целиком.
 */
export interface StoredMember {
  id: string
  name: string
  spectator: boolean
  vote: string | null
  joinedAt: number
}

export interface StoredRoom {
  id: string
  deckId: DeckId
  cards: string[]
  story: string
  revealed: boolean
  hostKey: string | null
  /** clientId → участник */
  members: Record<string, StoredMember>
  history: RoundResult[]
  timerEndsAt: number | null
}

const dir = process.env.DATA_DIR ?? join(process.cwd(), 'data')
mkdirSync(dir, { recursive: true })

const db = new DatabaseSync(join(dir, 'planpoker.db'))
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS rooms_updated ON rooms (updated_at);
`)

const selectRoom = db.prepare('SELECT data FROM rooms WHERE id = ?')
const upsertRoom = db.prepare(`
  INSERT INTO rooms (id, data, updated_at) VALUES (?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
`)
const deleteOld = db.prepare('DELETE FROM rooms WHERE updated_at < ?')
const countRooms = db.prepare('SELECT COUNT(*) AS count FROM rooms')

export function loadRoom(id: string): StoredRoom | null {
  const row = selectRoom.get(id) as { data: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.data) as StoredRoom
  } catch {
    return null
  }
}

export function saveRoom(room: StoredRoom) {
  upsertRoom.run(room.id, JSON.stringify(room), Date.now())
}

/** Удаляет комнаты, в которых ничего не происходило дольше maxAgeMs */
export function deleteStaleRooms(maxAgeMs: number): number {
  return Number(deleteOld.run(Date.now() - maxAgeMs).changes)
}

export function storedRoomsCount(): number {
  return Number((countRooms.get() as { count: number }).count)
}

export function closeStorage() {
  db.close()
}
