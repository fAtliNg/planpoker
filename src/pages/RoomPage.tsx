import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { DECKS, LIMITS, ROOM_ID, voteStats, type DeckId, type Participant, type RoomState } from '../../shared/protocol'
import { saveProfile, savedName, savedSpectator } from '../lib/identity'
import { plural } from '../lib/plural'
import { useRoom, type RoomConnection } from '../lib/useRoom'
import NotFoundPage from './NotFoundPage'
import styles from './RoomPage.module.css'

export default function RoomPage() {
  const { roomId = '' } = useParams()
  const [name, setName] = useState(savedName)
  const [spectator, setSpectator] = useState(savedSpectator)

  if (!ROOM_ID.test(roomId)) return <NotFoundPage />
  if (!name)
    return (
      <NameGate
        onSubmit={(n, s) => {
          saveProfile(n, s)
          setName(n)
          setSpectator(s)
        }}
      />
    )
  return <Room key={roomId} roomId={roomId} name={name} spectator={spectator} />
}

function NameGate({ onSubmit }: { onSubmit: (name: string, spectator: boolean) => void }) {
  const [name, setName] = useState('')
  const [spectator, setSpectator] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim()) onSubmit(name.trim(), spectator)
  }

  return (
    <section className={`container ${styles.gate}`}>
      <form onSubmit={submit} className={styles.gateForm}>
        <h1>Вас пригласили оценить задачи</h1>
        <p>Представьтесь, чтобы команда видела, чья это карта.</p>
        <input
          className="input"
          value={name}
          maxLength={LIMITS.name}
          placeholder="Ваше имя"
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
        <label className={styles.check}>
          <input type="checkbox" checked={spectator} onChange={(e) => setSpectator(e.target.checked)} />
          <span>Я только наблюдаю, без голосования</span>
        </label>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          Войти в комнату
        </button>
      </form>
    </section>
  )
}

function Room({ roomId, name, spectator }: { roomId: string; name: string; spectator: boolean }) {
  const connection = useRoom(roomId, name, spectator)
  const { room, you, status, error, send } = connection
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    document.title = `Комната ${roomId} — PlanPoker`
  }, [roomId])

  // Колоду, выбранную при создании, ставит ведущий после входа
  const wantedDeck = params.get('deck')
  useEffect(() => {
    if (!room || !wantedDeck || room.hostId !== you) return
    if (wantedDeck in DECKS && room.deckId !== wantedDeck && !room.history.length) {
      send({ type: 'setDeck', deckId: wantedDeck as DeckId })
    }
    setParams({}, { replace: true })
  }, [room, wantedDeck, you, send, setParams])

  if (error) {
    return (
      <section className={`container ${styles.gate}`}>
        <div className={styles.gateForm}>
          <h1>Не получилось</h1>
          <p>{error}</p>
        </div>
      </section>
    )
  }

  if (!room || !you) {
    return (
      <section className={`container ${styles.loading}`}>
        <span className={styles.spinner} />
        <p>{status === 'offline' ? 'Нет связи с сервером, переподключаемся…' : 'Подключаемся к комнате…'}</p>
      </section>
    )
  }

  return <RoomView room={room} you={you} connection={connection} />
}

function RoomView({ room, you, connection }: { room: RoomState; you: string; connection: RoomConnection }) {
  const { send, myVote, status, skew } = connection
  const me = room.participants.find((p) => p.id === you)
  const isHost = room.hostId === you
  const voters = room.participants.filter((p) => !p.spectator)
  const votedCount = voters.filter((p) => p.voted).length
  const revealedVotes = room.participants.filter((p) => p.vote != null).map((p) => p.vote!)

  return (
    <div className={`container ${styles.room}`}>
      <TopBar room={room} isHost={isHost} status={status} send={send} />

      <div className={styles.layout}>
        <div className={styles.main}>
          <StoryInput key={room.story} story={room.story} onSave={(story) => send({ type: 'setStory', story })} />

          <section className={styles.table}>
            <div className={styles.players}>
              {voters.map((p) => (
                <PlayerCard key={p.id} player={p} revealed={room.revealed} isYou={p.id === you} />
              ))}
              {!voters.length && <p className={styles.empty}>Пока никто не голосует. Пригласите команду по ссылке.</p>}
            </div>

            <div className={styles.center}>
              {room.revealed ? (
                <>
                  <Results votes={revealedVotes} />
                  <button type="button" className="btn btn-primary" onClick={() => send({ type: 'newRound' })}>
                    Новый раунд
                  </button>
                </>
              ) : (
                <>
                  <p className={styles.progress}>
                    Проголосовали <strong>{votedCount}</strong> из {voters.length}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => send({ type: 'reveal' })}
                    disabled={!votedCount}
                  >
                    Вскрыть карты
                  </button>
                </>
              )}
              <Timer room={room} skew={skew} send={send} />
            </div>
          </section>

          {me && !me.spectator ? (
            <Hand
              cards={room.cards}
              selected={myVote}
              disabled={room.revealed}
              onPick={(card) => send({ type: 'vote', value: card === myVote ? null : card })}
            />
          ) : (
            <p className={styles.spectatorNote}>Вы наблюдатель: видите голосование, но не участвуете в нём.</p>
          )}
        </div>

        <aside className={styles.side}>
          <Participants room={room} you={you} isHost={isHost} send={send} me={me} />
          <History room={room} />
        </aside>
      </div>
    </div>
  )
}

function TopBar({
  room,
  isHost,
  status,
  send,
}: {
  room: RoomState
  isHost: boolean
  status: RoomConnection['status']
  send: RoomConnection['send']
}) {
  const [copied, setCopied] = useState(false)
  const [custom, setCustom] = useState(room.deckId === 'custom' ? room.cards.join(', ') : '')

  async function copy() {
    const url = `${location.origin}/r/${room.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Скопируйте ссылку на комнату', url)
    }
  }

  function changeDeck(deckId: DeckId) {
    if (deckId === 'custom') {
      const cards = custom.split(',').map((c) => c.trim())
      send({ type: 'setDeck', deckId, cards })
    } else send({ type: 'setDeck', deckId })
  }

  return (
    <div className={styles.topbar}>
      <div className={styles.roomTitle}>
        <span className={styles.status} data-status={status} title={status === 'online' ? 'Онлайн' : 'Нет связи'} />
        <h1>
          Комната <code>{room.id}</code>
        </h1>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
          {copied ? 'Ссылка скопирована' : 'Пригласить'}
        </button>
      </div>
      {isHost && (
        <div className={styles.deckPicker}>
          <select
            className={styles.select}
            value={room.deckId}
            onChange={(e) => changeDeck(e.target.value as DeckId)}
            aria-label="Колода"
          >
            {Object.entries(DECKS).map(([id, deck]) => (
              <option key={id} value={id}>
                {deck.title}
              </option>
            ))}
            <option value="custom">Своя колода</option>
          </select>
          {room.deckId === 'custom' && (
            <form
              className={styles.customDeck}
              onSubmit={(e) => {
                e.preventDefault()
                changeDeck('custom')
              }}
            >
              <input
                className="input"
                value={custom}
                placeholder="1, 2, 3, 5, ?"
                onChange={(e) => setCustom(e.target.value)}
                aria-label="Карты через запятую"
              />
              <button type="submit" className="btn btn-ghost btn-sm">
                Применить
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function StoryInput({ story, onSave }: { story: string; onSave: (story: string) => void }) {
  const [value, setValue] = useState(story)
  return (
    <form
      className={styles.story}
      onSubmit={(e) => {
        e.preventDefault()
        onSave(value)
        ;(document.activeElement as HTMLElement | null)?.blur()
      }}
    >
      <input
        className={styles.storyInput}
        value={value}
        maxLength={LIMITS.story}
        placeholder="Какую задачу оцениваем? Например, PROJ-142 Фильтры в каталоге"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== story && onSave(value)}
        aria-label="Задача"
      />
    </form>
  )
}

function PlayerCard({ player, revealed, isYou }: { player: Participant; revealed: boolean; isYou: boolean }) {
  const flipped = revealed && player.vote != null
  return (
    <div className={styles.player} data-offline={!player.online || undefined}>
      <div className={styles.cardSlot} data-voted={player.voted || undefined} data-flipped={flipped || undefined}>
        <div className={styles.cardInner}>
          <div className={styles.cardBack} />
          <div className={styles.cardFace}>{player.vote}</div>
        </div>
      </div>
      <span className={styles.playerName}>
        {player.name}
        {isYou && <em> (вы)</em>}
      </span>
    </div>
  )
}

function Hand({
  cards,
  selected,
  disabled,
  onPick,
}: {
  cards: string[]
  selected: string | null
  disabled: boolean
  onPick: (card: string) => void
}) {
  return (
    <section className={styles.hand} aria-label="Ваши карты">
      {cards.map((card) => (
        <button
          key={card}
          type="button"
          className={card === selected ? styles.handCardActive : styles.handCard}
          onClick={() => onPick(card)}
          disabled={disabled}
          aria-pressed={card === selected}
        >
          {card}
        </button>
      ))}
    </section>
  )
}

function Results({ votes }: { votes: string[] }) {
  const stats = voteStats(votes)
  const max = stats.distribution[0]?.count ?? 1
  const spread = stats.min != null && stats.max != null && stats.max > stats.min ? `${stats.min}–${stats.max}` : null

  return (
    <div className={styles.results}>
      {stats.consensus ? (
        <p className={styles.consensus}>🎉 Единогласно: {stats.distribution[0].card}</p>
      ) : (
        <div className={styles.metrics}>
          {stats.average != null && (
            <div>
              <span>{String(stats.average).replace('.', ',')}</span>
              <small>среднее</small>
            </div>
          )}
          {spread && (
            <div>
              <span>{spread}</span>
              <small>разброс</small>
            </div>
          )}
          <div>
            <span>{stats.count}</span>
            <small>{plural(stats.count, ['голос', 'голоса', 'голосов'])}</small>
          </div>
        </div>
      )}
      <ul className={styles.distribution}>
        {stats.distribution.map((d) => (
          <li key={d.card}>
            <span className={styles.distCard}>{d.card}</span>
            <span className={styles.distBar}>
              <i style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className={styles.distCount}>{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Timer({ room, skew, send }: { room: RoomState; skew: number; send: RoomConnection['send'] }) {
  const [now, setNow] = useState(() => Date.now() + skew)

  useEffect(() => {
    if (!room.timerEndsAt) return
    const id = window.setInterval(() => setNow(Date.now() + skew), 250)
    return () => window.clearInterval(id)
  }, [room.timerEndsAt, skew])

  if (room.revealed) return null

  if (room.timerEndsAt) {
    const left = Math.max(0, Math.ceil((room.timerEndsAt - now) / 1000))
    const label = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
    return (
      <div className={styles.timer} data-urgent={left <= 10 || undefined}>
        <span className={styles.timerValue}>{label}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => send({ type: 'timer', seconds: null })}>
          Остановить
        </button>
      </div>
    )
  }

  return (
    <div className={styles.timer}>
      <span className={styles.timerLabel}>Таймер:</span>
      {[30, 60, 120, 300].map((s) => (
        <button key={s} type="button" className="btn btn-ghost btn-sm" onClick={() => send({ type: 'timer', seconds: s })}>
          {s < 60 ? `${s} с` : `${s / 60} мин`}
        </button>
      ))}
    </div>
  )
}

function Participants({
  room,
  you,
  me,
  isHost,
  send,
}: {
  room: RoomState
  you: string
  me: Participant | undefined
  isHost: boolean
  send: RoomConnection['send']
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(me?.name ?? '')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) input.current?.focus()
  }, [editing])

  function saveName(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !me) return
    saveProfile(trimmed, me.spectator)
    send({ type: 'setProfile', name: trimmed, spectator: me.spectator })
    setEditing(false)
  }

  function toggleSpectator() {
    if (!me) return
    saveProfile(me.name, !me.spectator)
    send({ type: 'setProfile', name: me.name, spectator: !me.spectator })
  }

  return (
    <section className={styles.sideBlock}>
      <h2>Участники · {room.participants.filter((p) => p.online).length}</h2>
      <ul className={styles.people}>
        {room.participants.map((p) => (
          <li key={p.id} data-offline={!p.online || undefined}>
            <span className={styles.avatar}>{p.name.slice(0, 1).toUpperCase()}</span>
            {p.id === you && editing ? (
              <form onSubmit={saveName} className={styles.rename}>
                <input
                  ref={input}
                  className="input"
                  value={name}
                  maxLength={LIMITS.name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={saveName}
                />
              </form>
            ) : (
              <span className={styles.personName}>
                {p.name}
                {p.id === room.hostId && <span className={styles.badge}>ведущий</span>}
                {p.spectator && <span className={styles.badgeMuted}>наблюдает</span>}
              </span>
            )}
            <span className={styles.voteMark} data-voted={p.voted || undefined}>
              {p.spectator ? '' : p.voted ? '✓' : '…'}
            </span>
            {isHost && p.id !== you && p.online && (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => send({ type: 'makeHost', id: p.id })}
                title="Передать роль ведущего"
              >
                сделать ведущим
              </button>
            )}
          </li>
        ))}
      </ul>
      {me && (
        <div className={styles.meActions}>
          <button type="button" className={styles.linkBtn} onClick={() => setEditing(true)}>
            Сменить имя
          </button>
          <button type="button" className={styles.linkBtn} onClick={toggleSpectator}>
            {me.spectator ? 'Голосовать' : 'Только наблюдать'}
          </button>
        </div>
      )}
    </section>
  )
}

function History({ room }: { room: RoomState }) {
  if (!room.history.length) return null
  return (
    <section className={styles.sideBlock}>
      <h2>Оценённые задачи · {room.history.length}</h2>
      <ol className={styles.history}>
        {room.history.map((round) => (
          <li key={round.finishedAt}>
            <span className={styles.historyStory}>{round.story || 'Без названия'}</span>
            <span className={styles.historySummary}>{round.summary}</span>
            <span className={styles.historyVotes}>
              {round.votes.map((v) => `${v.name}: ${v.value}`).join(' · ')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
