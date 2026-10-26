import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'
import {
  DECKS,
  LIMITS,
  summarize,
  type ClientMessage,
  type DeckId,
  type RoomState,
  type RoundResult,
  type ServerMessage,
} from '../shared/protocol.ts'

interface Member {
  /** Публичный id: его видят остальные. clientId знает только сам участник */
  id: string
  name: string
  spectator: boolean
  vote: string | null
  sockets: Set<WebSocket>
  offlineSince: number | null
  joinedAt: number
}

interface Room {
  id: string
  deckId: DeckId
  cards: string[]
  story: string
  revealed: boolean
  hostKey: string | null
  members: Map<string, Member>
  history: RoundResult[]
  timerEndsAt: number | null
  timer: NodeJS.Timeout | null
  emptySince: number | null
}

const MAX_ROOMS = 2000
const rooms = new Map<string, Room>()

function clean(text: unknown, max: number): string {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function createRoom(id: string): Room {
  return {
    id,
    deckId: 'fibonacci',
    cards: [...DECKS.fibonacci.cards],
    story: '',
    revealed: false,
    hostKey: null,
    members: new Map(),
    history: [],
    timerEndsAt: null,
    timer: null,
    emptySince: null,
  }
}

function online(member: Member) {
  return member.sockets.size > 0
}

/** Ведущий ушёл — роль переходит к тому, кто дольше всех в комнате и онлайн */
function ensureHost(room: Room) {
  const host = room.hostKey ? room.members.get(room.hostKey) : undefined
  if (host && online(host)) return
  const next = [...room.members.entries()].filter(([, m]) => online(m)).sort(([, a], [, b]) => a.joinedAt - b.joinedAt)[0]
  room.hostKey = next ? next[0] : host ? room.hostKey : null
}

function snapshot(room: Room): RoomState {
  const host = room.hostKey ? room.members.get(room.hostKey) : undefined
  return {
    id: room.id,
    deckId: room.deckId,
    cards: room.cards,
    story: room.story,
    revealed: room.revealed,
    hostId: host?.id ?? null,
    participants: [...room.members.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((m) => ({
        id: m.id,
        name: m.name,
        spectator: m.spectator,
        online: online(m),
        voted: m.vote != null,
        vote: room.revealed ? m.vote : null,
      })),
    history: room.history,
    timerEndsAt: room.timerEndsAt,
    now: Date.now(),
  }
}

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
}

function broadcast(room: Room) {
  const state = snapshot(room)
  for (const member of room.members.values()) {
    for (const socket of member.sockets) send(socket, { type: 'state', room: state, you: member.id, myVote: member.vote })
  }
}

function clearTimer(room: Room) {
  if (room.timer) clearTimeout(room.timer)
  room.timer = null
  room.timerEndsAt = null
}

function reveal(room: Room) {
  room.revealed = true
  clearTimer(room)
}

function newRound(room: Room) {
  if (room.revealed) {
    const votes = [...room.members.values()]
      .filter((m) => m.vote != null)
      .map((m) => ({ name: m.name, value: m.vote! }))
    if (votes.length) {
      room.history.unshift({
        story: room.story,
        votes,
        summary: summarize(votes.map((v) => v.value)),
        finishedAt: Date.now(),
      })
      room.history.length = Math.min(room.history.length, LIMITS.history)
    }
    room.story = ''
  }
  room.revealed = false
  room.members.forEach((m) => (m.vote = null))
  clearTimer(room)
}

/** Соединение одного вкладки браузера. Сообщения до join игнорируются. */
export function attach(socket: WebSocket) {
  let room: Room | null = null
  let key: string | null = null
  let budget = 40
  const refill = setInterval(() => (budget = 40), 5000)

  socket.on('message', (raw) => {
    // Простейшая защита от флуда: не больше 40 сообщений за 5 секунд
    if (--budget < 0) return
    let message: ClientMessage
    try {
      message = JSON.parse(String(raw))
    } catch {
      return
    }

    if (message.type === 'join') {
      if (room) return
      const roomId = clean(message.roomId, 12)
      const clientId = clean(message.clientId, 64)
      const name = clean(message.name, LIMITS.name)
      if (!/^[a-z0-9]{6,12}$/.test(roomId) || clientId.length < 16 || !name) {
        send(socket, { type: 'error', message: 'Не удалось войти в комнату' })
        return
      }
      let target = rooms.get(roomId)
      if (!target) {
        if (rooms.size >= MAX_ROOMS) {
          send(socket, { type: 'error', message: 'Сервер перегружен, попробуйте позже' })
          return
        }
        target = createRoom(roomId)
        rooms.set(roomId, target)
      }
      let member = target.members.get(clientId)
      if (!member) {
        member = {
          id: randomBytes(6).toString('hex'),
          name,
          spectator: Boolean(message.spectator),
          vote: null,
          sockets: new Set(),
          offlineSince: null,
          joinedAt: Date.now(),
        }
        target.members.set(clientId, member)
      } else {
        member.name = name
        member.spectator = Boolean(message.spectator)
      }
      member.sockets.add(socket)
      member.offlineSince = null
      target.emptySince = null
      room = target
      key = clientId
      ensureHost(room)
      broadcast(room)
      return
    }

    if (!room || !key) return
    const me = room.members.get(key)
    if (!me) return
    const isHost = room.hostKey === key

    switch (message.type) {
      case 'vote': {
        if (me.spectator || room.revealed) return
        const value = message.value
        me.vote = value != null && room.cards.includes(value) ? value : null
        break
      }
      case 'reveal':
        reveal(room)
        break
      case 'newRound':
        newRound(room)
        break
      case 'setStory':
        room.story = clean(message.story, LIMITS.story)
        break
      case 'setDeck': {
        if (!isHost) return
        let cards: string[]
        if (message.deckId === 'custom') {
          cards = [...new Set((message.cards ?? []).map((c) => clean(c, LIMITS.card)).filter(Boolean))].slice(
            0,
            LIMITS.customCards,
          )
          if (cards.length < 2) return
        } else if (message.deckId in DECKS) {
          cards = [...DECKS[message.deckId].cards]
        } else return
        room.deckId = message.deckId
        room.cards = cards
        // Старые голоса другой колодой не имеют смысла
        room.revealed = false
        room.members.forEach((m) => (m.vote = null))
        break
      }
      case 'setProfile': {
        const name = clean(message.name, LIMITS.name)
        if (name) me.name = name
        me.spectator = Boolean(message.spectator)
        if (me.spectator) me.vote = null
        break
      }
      case 'timer': {
        clearTimer(room)
        const seconds = message.seconds
        if (seconds != null && Number.isFinite(seconds) && seconds >= 10 && seconds <= 900) {
          const target = room
          room.timerEndsAt = Date.now() + seconds * 1000
          // По истечении времени карты вскрываются сами
          room.timer = setTimeout(() => {
            reveal(target)
            broadcast(target)
          }, seconds * 1000)
        }
        break
      }
      case 'makeHost': {
        if (!isHost) return
        const next = [...room.members.entries()].find(([, m]) => m.id === message.id)
        if (next) room.hostKey = next[0]
        break
      }
      default:
        return
    }
    broadcast(room)
  })

  socket.on('close', () => {
    clearInterval(refill)
    if (!room || !key) return
    const me = room.members.get(key)
    if (me) {
      me.sockets.delete(socket)
      if (!online(me)) me.offlineSince = Date.now()
    }
    ensureHost(room)
    if (![...room.members.values()].some(online)) room.emptySince = Date.now()
    broadcast(room)
  })
}

/** Раз в минуту убираем давно ушедших участников и пустые комнаты */
export function startSweeper() {
  return setInterval(() => {
    const now = Date.now()
    for (const room of rooms.values()) {
      let changed = false
      for (const [clientId, member] of room.members) {
        if (member.offlineSince && now - member.offlineSince > LIMITS.offlineMs) {
          room.members.delete(clientId)
          changed = true
        }
      }
      if (room.emptySince && now - room.emptySince > LIMITS.emptyRoomMs) {
        clearTimer(room)
        rooms.delete(room.id)
        continue
      }
      if (changed) {
        ensureHost(room)
        broadcast(room)
      }
    }
  }, 60_000)
}

export function stats() {
  let people = 0
  rooms.forEach((room) => room.members.forEach((m) => (people += online(m) ? 1 : 0)))
  return { rooms: rooms.size, online: people }
}
