import { Button } from '@/components/ui/Button/Button';
import { formatPhone } from '@/helpers/phone';
import { useNotificationPolling } from '@/hooks/useNotificationPolling';
import { useSignOut } from '@/hooks/useSignOut';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ChatList } from './ChatList/ChatList';
import { MessageComposer } from './MessageComposer/MessageComposer';
import { MessageList } from './MessageList/MessageList';
import { NewChatForm } from './NewChatForm/NewChatForm';
import styles from './ChatPage.module.scss';

// Раскладка по образцу web.max.ru: слева новый чат и список, справа лента и поле ввода.
export function ChatPage() {
  const idInstance = useSessionStore((s) => s.credentials?.idInstance);
  const signOut = useSignOut();
  const activeChat = useChatStore((s) => s.chats.find((c) => c.chatId === s.activeChatId));
  // Приём ответов из MAX: цикл живёт, пока открыт экран чатов, и останавливается при выходе.
  useNotificationPolling();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>widgetMAX</h1>
        <span className={styles.instance}>Инстанс {idInstance}</span>
        <Button variant="secondary" onClick={signOut}>
          Выйти
        </Button>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <NewChatForm />
          <ChatList />
        </aside>
        <main className={styles.chat}>
          {activeChat ? (
            <>
              <div className={styles.chatHeader}>
                <h2 className={styles.chatTitle}>{formatPhone(activeChat.phone)}</h2>
              </div>
              <MessageList chatId={activeChat.chatId} />
              {/* key: черновик сообщения не переезжает в другой чат. */}
              <MessageComposer key={activeChat.chatId} chatId={activeChat.chatId} />
            </>
          ) : (
            <p className={styles.placeholder}>Выберите чат или создайте новый по номеру телефона</p>
          )}
        </main>
      </div>
    </div>
  );
}
