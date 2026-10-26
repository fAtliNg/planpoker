import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  return (
    <section className={`container ${styles.page}`}>
      <p className={`gradient-text ${styles.code}`}>404</p>
      <h1>Такой страницы нет</h1>
      <p className={styles.text}>Возможно, ссылка устарела. Создайте новую комнату — это пара секунд.</p>
      <Link to="/" className="btn btn-primary">
        На главную
      </Link>
    </section>
  )
}
