import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DECKS, ROOM_ID, type DeckId } from '../../shared/protocol'
import { newRoomId, saveProfile, savedName, savedSpectator } from '../lib/identity'
import styles from './HomePage.module.css'

const decks = Object.entries(DECKS) as [Exclude<DeckId, 'custom'>, (typeof DECKS)[keyof typeof DECKS]][]

const features = [
  { title: 'Без регистрации', text: 'Создайте комнату и отправьте ссылку. Участникам нужно только ввести имя.' },
  { title: 'Честная оценка', text: 'Карты скрыты, пока все не проголосуют, — никто не подстраивается под мнение лида.' },
  { title: 'Сразу итог', text: 'Среднее, разброс и распределение голосов. Если мнения разошлись — видно, кому слово.' },
  { title: 'Таймер и история', text: 'Ограничьте обсуждение по времени и посмотрите оценки всех задач за сессию.' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [name, setName] = useState(savedName)
  const [deck, setDeck] = useState<Exclude<DeckId, 'custom'>>('fibonacci')
  const [spectator, setSpectator] = useState(savedSpectator)
  const [code, setCode] = useState('')

  function create(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    saveProfile(trimmed, spectator)
    navigate(`/r/${newRoomId()}${deck === 'fibonacci' ? '' : `?deck=${deck}`}`)
  }

  // Принимаем и код, и полную ссылку на комнату
  const joinId = code.trim().toLowerCase().split('/r/').pop()?.split(/[?#]/)[0] ?? ''

  function join(event: FormEvent) {
    event.preventDefault()
    if (ROOM_ID.test(joinId)) navigate(`/r/${joinId}`)
  }

  return (
    <>
      <section className={`container ${styles.hero}`}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Покер планирования · бесплатно</p>
          <h1 className={styles.title}>
            Оценивайте задачи <span className="gradient-text">всей командой</span>
          </h1>
          <p className={styles.lead}>
            Создайте комнату, отправьте ссылку коллегам и выбирайте карты одновременно. Без регистрации, рекламы и
            ограничений на число участников.
          </p>
          <div className={styles.fan} aria-hidden>
            {['3', '5', '8', '13', '?'].map((card, i) => (
              <span key={card} style={{ '--i': i - 2 } as React.CSSProperties}>
                {card}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <form onSubmit={create} className={styles.form}>
            <h2>Новая комната</h2>
            <div>
              <label className="label" htmlFor="name">
                Ваше имя
              </label>
              <input
                id="name"
                className="input"
                value={name}
                maxLength={32}
                placeholder="Например, Сергей"
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
                required
              />
            </div>
            <div>
              <span className="label">Колода</span>
              <div className={styles.decks} role="radiogroup" aria-label="Колода">
                {decks.map(([id, d]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={deck === id}
                    className={deck === id ? styles.deckActive : styles.deck}
                    onClick={() => setDeck(id)}
                  >
                    <strong>{d.title}</strong>
                    <small>{d.cards.slice(0, 6).join(' ')}…</small>
                  </button>
                ))}
              </div>
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={spectator} onChange={(e) => setSpectator(e.target.checked)} />
              <span>Я только наблюдаю, без голосования</span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              Создать комнату
            </button>
          </form>

          <form onSubmit={join} className={styles.join}>
            <input
              className="input"
              value={code}
              placeholder="Код или ссылка на комнату"
              onChange={(e) => setCode(e.target.value)}
              aria-label="Код комнаты"
            />
            <button type="submit" className="btn btn-ghost" disabled={!ROOM_ID.test(joinId)}>
              Войти
            </button>
          </form>
        </div>
      </section>

      <section className={`container ${styles.features}`}>
        {features.map((feature, i) => (
          <article key={feature.title}>
            <span className={styles.num}>0{i + 1}</span>
            <h3>{feature.title}</h3>
            <p>{feature.text}</p>
          </article>
        ))}
      </section>
    </>
  )
}
