import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { attach, flushAll, startSweeper, stats } from './rooms.ts'
import { closeStorage, storedRoomsCount } from './storage.ts'

/**
 * Сервер комнат: только WebSocket на /ws и /health для проверки.
 * Статику клиента отдаёт nginx, в разработке — Vite (он же проксирует /ws сюда).
 */
const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '127.0.0.1'

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, ...stats(), stored: storedRoomsCount() }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 })

wss.on('connection', (socket) => {
  attach(socket)
  // Пинг держит соединение живым за прокси и вычищает зависшие клиенты
  let alive = true
  socket.on('pong', () => (alive = true))
  const ping = setInterval(() => {
    if (!alive) return socket.terminate()
    alive = false
    socket.ping()
  }, 30_000)
  socket.on('close', () => clearInterval(ping))
})

startSweeper()

// systemd останавливает сервис SIGTERM: дописываем несохранённые комнаты в базу
function shutdown() {
  flushAll()
  closeStorage()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

server.listen(PORT, HOST, () => console.log(`planpoker: ws://${HOST}:${PORT}/ws`))
