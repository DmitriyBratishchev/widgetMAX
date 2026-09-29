import { useRef, useState, type ChangeEvent, type SubmitEvent } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { getCreateChatErrorMessage } from '@/helpers/chatError';
import { normalizePhone, PHONE_MAX_DIGITS, PHONE_MIN_DIGITS } from '@/helpers/phone';
import { useCreateChat } from '@/hooks/useCreateChat';
import { useChatStore } from '@/stores/chatStore';
import styles from './NewChatForm.module.scss';

export function NewChatForm() {
  const createChat = useCreateChat();
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string>();
  const phoneRef = useRef<HTMLInputElement>(null);
  // Номер уже в списке — кнопка честно говорит, что проверки не будет, а чат откроется.
  const isKnownPhone = useChatStore((s) => {
    const normalized = normalizePhone(phone);
    return normalized !== null && s.chats.some((c) => c.phone === normalized);
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value);
    setPhoneError(undefined);
    // Новый номер — старая ошибка API к нему уже не относится.
    if (createChat.isError) createChat.reset();
  };

  const focusPhone = () => phoneRef.current?.focus();

  // Ошибка — в DOM до фокуса: скринридер прочтёт поле вместе с aria-invalid и текстом ошибки.
  const showPhoneError = (error: string) => {
    flushSync(() => setPhoneError(error));
    focusPhone();
  };

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!phone.trim()) {
      showPhoneError('Введите номер телефона');
      return;
    }
    // Неверный формат ловим до запроса: у CheckAccount лимит проверок (skill green-api §6).
    const normalized = normalizePhone(phone);
    if (!normalized) {
      // Неразрывные пробелы: пример номера не разрывается переносом строки.
      showPhoneError(
        `Номер — ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} цифр с кодом страны, например +7\u00a0999\u00a0123-45-67`,
      );
      return;
    }
    // Успех открывает чат — фокус заберёт поле сообщения. Отказ объявляет role="alert", а
    // заблокированная на время проверки кнопка теряет фокус — возвращаем его в поле номера.
    createChat.mutate(normalized, { onSuccess: () => setPhone(''), onError: focusPhone });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <Input
        ref={phoneRef}
        label="Номер телефона"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="+7 999 123-45-67"
        value={phone}
        onChange={handleChange}
        error={phoneError}
      />
      {createChat.isError && (
        <p className={styles.error} role="alert">
          {getCreateChatErrorMessage(createChat.error)}
        </p>
      )}
      <Button type="submit" disabled={createChat.isPending}>
        {createChat.isPending ? 'Проверяем номер…' : isKnownPhone ? 'Перейти в чат' : 'Создать чат'}
      </Button>
    </form>
  );
}
