import { Link } from 'react-router-dom'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.brand} aria-label="PlanPoker — на главную">
          <Logo />
          <span>PlanPoker</span>
        </Link>
        <nav className={styles.nav}>
          <Link to="/" className={styles.link}>
            Новая комната
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
