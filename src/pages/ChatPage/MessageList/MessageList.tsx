import { useEffect, useRef } from 'react';
import { formatMessageTime } from '@/helpers/formatTime';
import { useChatStore, type ChatMessage } from '@/stores/chatStore';
import styles from './MessageList.module.scss';

// Постоянная ссылка: селектор с `?? []` возвращал бы новый массив на каждый вызов,
// и Zustand перерисовывал бы компонент бесконечно.
const NO_MESSAGES: ChatMessage[] = [];

// Направление видно по цвету и стороне пузыря; скринридеру его говорит скрытый текст.
const DIRECTION_LABELS: Record<ChatMessage['direction'], string> = {
  incoming: 'Собеседник:',
  outgoing: 'Вы:',
};

interface MessageListProps {
  chatId: string;
}

// Лента — live-регион role="log": скринридер вежливо объявляет новые сообщения. Регион — обёртка,
// которая есть и в пустом чате (иначе первое сообщение появится вместе с регионом и не объявится).
// Историю при открытии чата он не зачитывает: ChatPage монтирует ленту заново на каждый чат (key).
export function MessageList({ chatId }: MessageListProps) {
  const messages = useChatStore((s) => s.messagesByChatId[chatId] ?? NO_MESSAGES);
  const listRef = useRef<HTMLOListElement>(null);

  // Новое сообщение — прокрутить ленту вниз, как в любом мессенджере.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    // messages — триггер прокрутки, а не читаемое в эффекте значение.
    // eslint-disable-next-line react/exhaustive-effect-dependencies -- см. выше
  }, [messages]);

  return (
    <div className={styles.feed} role="log" aria-live="polite">
      {messages.length === 0 ? (
        <p className={styles.empty}>Сообщений пока нет. Напишите первое.</p>
      ) : (
        <ol ref={listRef} className={styles.list} aria-label="Сообщения">
          {messages.map((message) => (
            <li
              key={message.idMessage}
              className={`${styles.message} ${styles[message.direction]}`}
            >
              <span className={styles.direction}>{DIRECTION_LABELS[message.direction]} </span>
              {/* Только текст: React экранирует его, HTML из сообщения не исполняется (rules.md §7). */}
              <p className={styles.text}>{message.text}</p>
              <time className={styles.time} dateTime={new Date(message.timestamp).toISOString()}>
                {formatMessageTime(message.timestamp)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
