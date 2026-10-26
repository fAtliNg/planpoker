import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p>
          Комнаты не требуют регистрации и удаляются через пару часов после того, как все вышли. Оценки не сохраняются
          на сервере дольше жизни комнаты.
        </p>
        <p className={styles.meta}>
          © {new Date().getFullYear()} PlanPoker ·{' '}
          <a href="https://denisenkosergey.ru" target="_blank" rel="noreferrer">
            Сергей Денисенко
          </a>
        </p>
      </div>
    </footer>
  )
}
