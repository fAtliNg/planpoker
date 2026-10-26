import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, RoomState, ServerMessage } from '../../shared/protocol'
import { clientId, savedName, savedSpectator } from './identity'

export type Status = 'connecting' | 'online' | 'offline'

export interface RoomConnection {
  room: RoomState | null
  you: string | null
  myVote: string | null
  status: Status
  error: string | null
  /** Разница часов сервера и браузера, мс */
  skew: number
  send: (message: ClientMessage) => void
}

function socketUrl() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${location.host}/ws`
}

/** Подключение к комнате с автоматическим переподключением. */
export function useRoom(roomId: string, name: string, spectator: boolean): RoomConnection {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [you, setYou] = useState<string | null>(null)
  const [myVote, setMyVote] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [skew, setSkew] = useState(0)
  const socket = useRef<WebSocket | null>(null)
  // Профиль при переподключении берём актуальный, не пересоздавая соединение
  const profile = useRef({ name, spectator })
  profile.current = { name, spectator }

  useEffect(() => {
    let closed = false
    let retry = 0
    let timer: number | undefined

    function connect() {
      setStatus('connecting')
      const ws = new WebSocket(socketUrl())
      socket.current = ws

      ws.onopen = () => {
        retry = 0
        setStatus('online')
        setError(null)
        ws.send(
          JSON.stringify({
            type: 'join',
            roomId,
            clientId: clientId(),
            // Имя и роль могли смениться в комнате — берём сохранённые
            name: savedName() || profile.current.name,
            spectator: savedName() ? savedSpectator() : profile.current.spectator,
          } satisfies ClientMessage),
        )
      }

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as ServerMessage
        if (message.type === 'error') {
          setError(message.message)
          return
        }
        setRoom(message.room)
        setYou(message.you)
        setMyVote(message.myVote)
        setSkew(message.room.now - Date.now())
      }

      ws.onclose = () => {
        if (closed) return
        setStatus('offline')
        // Переподключение с нарастающей паузой: 1, 2, 4… до 15 секунд
        timer = window.setTimeout(connect, Math.min(15_000, 1000 * 2 ** retry++))
      }
    }

    connect()
    return () => {
      closed = true
      window.clearTimeout(timer)
      socket.current?.close()
    }
  }, [roomId])

  const send = useCallback((message: ClientMessage) => {
    const ws = socket.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
  }, [])

  return { room, you, myVote, status, error, skew, send }
}
