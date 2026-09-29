import { Fragment } from 'react';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { Button } from '@/components/ui/Button/Button';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { formatPhone, getPhoneAvatarLabel } from '@/helpers/phone';
import { useNotificationPolling, type PollingStopReason } from '@/hooks/useNotificationPolling';
import { useSignOut } from '@/hooks/useSignOut';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ChatList } from './ChatList/ChatList';
import { MessageComposer } from './MessageComposer/MessageComposer';
import { MessageList } from './MessageList/MessageList';
import { NewChatForm } from './NewChatForm/NewChatForm';
import styles from './ChatPage.module.scss';

const POLLING_STOP_MESSAGES: Record<PollingStopReason, string> = {
  'credentials-rejected':
    'Приём сообщений остановлен: GREEN-API не принял учётные данные. Войдите заново',
  'unexpected-error': 'Приём сообщений остановлен из-за ошибки приложения. Обновите страницу',
};

// Раскладка по образцу web.max.ru: две колонки на всю высоту — слева шапка, новый чат и список,
// справа шапка чата, лента и поле ввода. На узком экране видна одна колонка — по data-view.
export function ChatPage() {
  const idInstance = useSessionStore((s) => s.credentials?.idInstance);
  const signOut = useSignOut();
  const activeChat = useChatStore((s) => s.chats.find((c) => c.chatId === s.activeChatId));
  const closeChat = useChatStore((s) => s.closeChat);
  // Приём ответов из MAX: цикл живёт, пока открыт экран чатов, и останавливается при выходе.
  // Сеть и лимиты цикл переживает молча; встал насовсем — говорим об этом над лентой.
  const pollingStop = useNotificationPolling();
  const pollingStopAlert = pollingStop && (
    <p className={styles.pollingStopped} role="alert">
      {POLLING_STOP_MESSAGES[pollingStop]}
    </p>
  );

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
        {activeChat && (
          <header className={styles.chatHeader}>
            {/* Видна только на узком экране: на широком список и так рядом. Прячет обёртка —
                класс на самой кнопке спорил бы специфичностью с базовым классом кита. */}
            <span className={styles.back}>
              <IconButton variant="ghost" label="Назад к списку чатов" onClick={closeChat}>
                <path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" />
              </IconButton>
            </span>
            <Avatar size="sm" label={getPhoneAvatarLabel(activeChat.phone)} />
            <h2 className={styles.chatTitle}>{formatPhone(activeChat.phone)}</h2>
          </header>
        )}
        {/* Одна позиция для чата и заглушки: при открытии и закрытии чата плашка не
            перемонтируется, и скринридер не объявляет её заново. */}
        {pollingStopAlert}
        {activeChat ? (
          // key: лента и поле ввода монтируются заново на каждый чат — у ленты свой live-регион
          // (история при открытии не зачитывается), черновик не переезжает в другой чат, поле
          // получает фокус при открытии.
          <Fragment key={activeChat.chatId}>
            <MessageList chatId={activeChat.chatId} />
            <MessageComposer chatId={activeChat.chatId} />
          </Fragment>
        ) : (
          <p className={styles.placeholder}>Выберите чат или создайте новый по номеру телефона</p>
        )}
      </main>
    </div>
  );
}
