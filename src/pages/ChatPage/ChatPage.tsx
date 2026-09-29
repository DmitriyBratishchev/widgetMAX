import { Avatar } from '@/components/ui/Avatar/Avatar';
import { Button } from '@/components/ui/Button/Button';
import { formatPhone, getPhoneAvatarLabel } from '@/helpers/phone';
import { useNotificationPolling } from '@/hooks/useNotificationPolling';
import { useSignOut } from '@/hooks/useSignOut';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ChatList } from './ChatList/ChatList';
import { MessageComposer } from './MessageComposer/MessageComposer';
import { MessageList } from './MessageList/MessageList';
import { NewChatForm } from './NewChatForm/NewChatForm';
import styles from './ChatPage.module.scss';

// Раскладка по образцу web.max.ru: две колонки на всю высоту — слева шапка, новый чат и список,
// справа шапка чата, лента и поле ввода. На узком экране видна одна колонка — по data-view.
export function ChatPage() {
  const idInstance = useSessionStore((s) => s.credentials?.idInstance);
  const signOut = useSignOut();
  const activeChat = useChatStore((s) => s.chats.find((c) => c.chatId === s.activeChatId));
  const closeChat = useChatStore((s) => s.closeChat);
  // Приём ответов из MAX: цикл живёт, пока открыт экран чатов, и останавливается при выходе.
  useNotificationPolling();

  return (
    <div className={styles.page} data-view={activeChat ? 'chat' : 'list'}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <div className={styles.heading}>
            <h1 className={styles.title}>Чаты</h1>
            <span className={styles.instance}>Инстанс {idInstance}</span>
          </div>
          <Button variant="secondary" onClick={signOut}>
            Выйти
          </Button>
        </header>
        <NewChatForm />
        <ChatList />
      </aside>
      <main className={styles.chat}>
        {activeChat ? (
          <>
            <header className={styles.chatHeader}>
              {/* Видна только на узком экране: на широком список и так рядом. */}
              <button
                type="button"
                className={styles.back}
                aria-label="Назад к списку чатов"
                onClick={closeChat}
              >
                <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" />
                </svg>
              </button>
              <Avatar size="sm" label={getPhoneAvatarLabel(activeChat.phone)} />
              <h2 className={styles.chatTitle}>{formatPhone(activeChat.phone)}</h2>
            </header>
            <MessageList chatId={activeChat.chatId} />
            {/* key: черновик сообщения не переезжает в другой чат. */}
            <MessageComposer key={activeChat.chatId} chatId={activeChat.chatId} />
          </>
        ) : (
          <p className={styles.placeholder}>Выберите чат или создайте новый по номеру телефона</p>
        )}
      </main>
    </div>
  );
}
