import { formatPhone } from '@/helpers/phone';
import { useChatStore } from '@/stores/chatStore';
import styles from './ChatList.module.scss';

export function ChatList() {
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
              <span className={styles.name}>{formatPhone(chat.phone)}</span>
              <span className={styles.preview}>{lastMessage?.text ?? 'Нет сообщений'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
