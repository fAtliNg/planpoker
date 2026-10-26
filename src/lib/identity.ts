/** Профиль участника живёт в браузере: регистрации нет. */

const CLIENT_KEY = 'planpoker:client'
const NAME_KEY = 'planpoker:name'
const SPECTATOR_KEY = 'planpoker:spectator'

function get(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Без хранилища профиль просто не запомнится
  }
}

let memoryClientId: string | null = null

/** Секретный ключ участника: по нему сервер узнаёт его после переподключения */
export function clientId(): string {
  const saved = get(CLIENT_KEY) ?? memoryClientId
  if (saved) return saved
  const id = crypto.randomUUID()
  memoryClientId = id
  set(CLIENT_KEY, id)
  return id
}

export function savedName(): string {
  return get(NAME_KEY) ?? ''
}

export function savedSpectator(): boolean {
  return get(SPECTATOR_KEY) === '1'
}

export function saveProfile(name: string, spectator: boolean) {
  set(NAME_KEY, name)
  set(SPECTATOR_KEY, spectator ? '1' : '0')
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/** Код комнаты без похожих символов (l/1, o/0): его удобно продиктовать */
export function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}
