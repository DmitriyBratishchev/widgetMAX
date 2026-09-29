import { Avatar } from '@/components/ui/Avatar/Avatar';
import { formatMessageTime } from '@/helpers/formatTime';
import { formatPhone, getPhoneAvatarLabel } from '@/helpers/phone';
import { useChatStore } from '@/stores/chatStore';
import styles from './ChatList.module.scss';

export function ChatList() {
  // Порядок — из стора: чат с новым сообщением уже поднят наверх (chatStore.addMessage).
  const chats = useChatStore((s) => s.chats);
  const messagesByChatId = useChatStore((s) => s.messagesByChatId);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const selectChat = useChatStore((s) => s.selectChat);

  if (chats.length === 0) {
    return (
      <p className={styles.empty}>
        Чатов пока нет. Введите номер телефона получателя, чтобы начать переписку.
      </p>
    );
  }

  return (
    <ul className={styles.list} aria-label="Чаты">
      {chats.map((chat) => {
        const isActive = chat.chatId === activeChatId;
        const lastMessage = messagesByChatId[chat.chatId]?.at(-1);
        return (
          <li key={chat.chatId}>
            <button
              type="button"
              className={[styles.item, isActive && styles.active].filter(Boolean).join(' ')}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => selectChat(chat.chatId)}
            >
              <Avatar label={getPhoneAvatarLabel(chat.phone)} />
              <span className={styles.body}>
                <span className={styles.row}>
                  <span className={styles.name}>{formatPhone(chat.phone)}</span>
                  {lastMessage && (
                    <time
                      className={styles.time}
                      dateTime={new Date(lastMessage.timestamp).toISOString()}
                    >
                      {formatMessageTime(lastMessage.timestamp)}
                    </time>
                  )}
                </span>
                <span className={styles.preview}>{lastMessage?.text ?? 'Нет сообщений'}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
