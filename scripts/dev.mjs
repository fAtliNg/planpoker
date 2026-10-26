// Запускает клиент (Vite) и сервер комнат одной командой: npm run dev
import { spawn } from 'node:child_process'

const procs = ['dev:server', 'dev:client'].map((script) =>
  spawn('npm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' }),
)

function stop() {
  procs.forEach((p) => p.kill('SIGTERM'))
  process.exit()
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
procs.forEach((p) => p.on('exit', (code) => code && stop()))
