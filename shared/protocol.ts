/** Общие типы и правила для клиента и сервера комнат. */

export const DECKS = {
  fibonacci: { title: 'Фибоначчи', cards: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'] },
  modified: { title: 'Фибоначчи+', cards: ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'] },
  tshirt: { title: 'Футболки', cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'] },
  powers: { title: 'Степени двойки', cards: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'] },
} as const

export type DeckId = keyof typeof DECKS | 'custom'

export const LIMITS = {
  name: 32,
  story: 200,
  card: 4,
  customCards: 16,
  history: 50,
  /** Участник без соединения убирается из комнаты через это время */
  offlineMs: 5 * 60_000,
  /** Пустая комната удаляется через это время */
  emptyRoomMs: 2 * 60 * 60_000,
}

export const ROOM_ID = /^[a-z0-9]{6,12}$/

export interface Participant {
  id: string
  name: string
  spectator: boolean
  online: boolean
  voted: boolean
  /** Видна всем только после вскрытия карт */
  vote: string | null
}

export interface RoundResult {
  story: string
  votes: { name: string; value: string }[]
  summary: string
  finishedAt: number
}

export interface RoomState {
  id: string
  deckId: DeckId
  cards: string[]
  story: string
  revealed: boolean
  hostId: string | null
  participants: Participant[]
  history: RoundResult[]
  timerEndsAt: number | null
  /** Время сервера, чтобы клиент поправил таймер на расхождение часов */
  now: number
}

export type ClientMessage =
  | { type: 'join'; roomId: string; clientId: string; name: string; spectator: boolean }
  | { type: 'vote'; value: string | null }
  | { type: 'reveal' }
  | { type: 'newRound' }
  | { type: 'setStory'; story: string }
  | { type: 'setDeck'; deckId: DeckId; cards?: string[] }
  | { type: 'setProfile'; name: string; spectator: boolean }
  | { type: 'timer'; seconds: number | null }
  | { type: 'makeHost'; id: string }

export type ServerMessage =
  | { type: 'state'; room: RoomState; you: string; myVote: string | null }
  | { type: 'error'; message: string }

const numeric: Record<string, number> = { '½': 0.5 }

export function cardValue(card: string): number | null {
  if (card in numeric) return numeric[card]
  const n = Number(card)
  return card.trim() !== '' && Number.isFinite(n) ? n : null
}

export interface VoteStats {
  count: number
  /** Среднее только по числовым картам */
  average: number | null
  min: number | null
  max: number | null
  /** Все проголосовавшие выбрали одно и то же */
  consensus: boolean
  /** Карты по убыванию популярности */
  distribution: { card: string; count: number }[]
}

export function voteStats(votes: string[]): VoteStats {
  const counts = new Map<string, number>()
  votes.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1))
  const numbers = votes.map(cardValue).filter((n): n is number => n != null)
  const average = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null
  return {
    count: votes.length,
    average: average == null ? null : Math.round(average * 10) / 10,
    min: numbers.length ? Math.min(...numbers) : null,
    max: numbers.length ? Math.max(...numbers) : null,
    consensus: votes.length > 1 && counts.size === 1,
    distribution: [...counts].map(([card, count]) => ({ card, count })).sort((a, b) => b.count - a.count),
  }
}

/** Короткая строка итога раунда для истории */
export function summarize(votes: string[]): string {
  const stats = voteStats(votes)
  if (!stats.count) return 'без оценок'
  if (stats.consensus) return `единогласно ${stats.distribution[0].card}`
  if (stats.average != null) return `среднее ${String(stats.average).replace('.', ',')}`
  return `чаще всего ${stats.distribution[0].card}`
}
