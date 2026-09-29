import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type SubmitEvent,
} from 'react';
import { Button } from '@/components/ui/Button/Button';
import { getSendMessageErrorMessage } from '@/helpers/chatError';
import { useSendMessage } from '@/hooks/useSendMessage';
import styles from './MessageComposer.module.scss';

// Лимит SendMessage: длиннее GREEN-API отвечает 400 (skill green-api §2).
const MAX_MESSAGE_LENGTH = 4000;

interface MessageComposerProps {
  chatId: string;
}

export function MessageComposer({ chatId }: MessageComposerProps) {
  const send = useSendMessage();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSend = text.trim() !== '' && !send.isPending;

  // Композер монтируется заново на каждый открытый чат (key в ChatPage): открыли чат — можно
  // сразу печатать. На узком экране кнопка чата в списке к этому моменту уже скрыта.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!canSend) return;
    // Поле очищаем только после успеха: при ошибке набранный текст не теряется. Пока идёт отправка,
    // поле только для чтения — иначе очистка стёрла бы допечатанное.
    send.mutate({ chatId, text }, { onSuccess: () => setText('') });
    // Нажатая кнопка на время отправки блокируется и теряет фокус — возвращаем его в поле.
    inputRef.current?.focus();
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (send.isError) send.reset();
  };

  // Enter — отправить, Shift+Enter — перенос строки; во время набора через IME Enter не трогаем.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      {send.isError && (
        <p className={styles.error} role="alert">
          {getSendMessageErrorMessage(send.error)}
        </p>
      )}
      <div className={styles.row}>
        <textarea
          ref={inputRef}
          className={styles.input}
          aria-label="Сообщение"
          placeholder="Сообщение"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          // readOnly, а не disabled: фокус остаётся в поле, после ответа можно печатать дальше.
          readOnly={send.isPending}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        {/* Круглая кнопка-иконка, как в web.max.ru; имя для скринридера — в aria-label. */}
        <Button
          type="submit"
          className={styles.send}
          disabled={!canSend}
          aria-label={send.isPending ? 'Отправляем…' : 'Отправить'}
        >
          <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
          </svg>
        </Button>
      </div>
    </form>
  );
}
