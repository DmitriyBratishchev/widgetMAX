import { useState, type ChangeEvent, type KeyboardEvent, type SubmitEvent } from 'react';
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
  const canSend = text.trim() !== '' && !send.isPending;

  const submit = () => {
    if (!canSend) return;
    // Поле очищаем только после успеха: при ошибке набранный текст не теряется.
    send.mutate({ chatId, text }, { onSuccess: () => setText('') });
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
          className={styles.input}
          aria-label="Сообщение"
          placeholder="Сообщение"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
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
