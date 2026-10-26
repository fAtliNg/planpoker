import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p>
          Комнаты не требуют регистрации. Голоса и история сохраняются: к комнате можно вернуться по той же ссылке.
          Комната удаляется через 30 дней без активности.
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
