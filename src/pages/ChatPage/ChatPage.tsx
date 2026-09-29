import { Button } from '@/components/ui/Button/Button';
import { useSessionStore } from '@/stores/sessionStore';
import styles from './ChatPage.module.scss';

export function ChatPage() {
  const idInstance = useSessionStore((s) => s.credentials?.idInstance);
  const signOut = useSessionStore((s) => s.signOut);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>widgetMAX</h1>
        <span className={styles.instance}>Инстанс {idInstance}</span>
        <Button variant="secondary" onClick={signOut}>
          Выйти
        </Button>
      </header>
      <main className={styles.content}>
        <p className={styles.placeholder}>Здесь появятся чаты</p>
      </main>
    </div>
  );
}
