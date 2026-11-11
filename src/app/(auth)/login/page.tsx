import Image from 'next/image'
import { LoginForm } from '@/features/auth/components/login-form'
import styles from '@/features/auth/components/login.module.css'

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Image src="/brand/vichente-logo-moderno.png" alt="" width={46} height={46} />
          <span>Vichente</span>
        </div>
      </header>
      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="login-title">
          <div className={styles.intro}>
            <Image src="/brand/vichente-logo-moderno.png" alt="" width={94} height={94} />
            <h1 id="login-title" className={styles.title}>
              Bienvenido
            </h1>
            <p>Inicia sesión para continuar a tu panel.</p>
          </div>
          <LoginForm />
        </section>
      </main>
    </div>
  )
}
