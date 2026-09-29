import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
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
        <Button type="submit" disabled={!canSend}>
          {send.isPending ? 'Отправляем…' : 'Отправить'}
        </Button>
      </div>
    </form>
  );
}
