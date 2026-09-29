import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { getCreateChatErrorMessage } from '@/helpers/chatError';
import { normalizePhone } from '@/helpers/phone';
import { useCreateChat } from '@/hooks/useCreateChat';
import { useChatStore } from '@/stores/chatStore';
import styles from './NewChatForm.module.scss';

export function NewChatForm() {
  const createChat = useCreateChat();
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string>();
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!phone.trim()) {
      setPhoneError('Введите номер телефона');
      return;
    }
    // Неверный формат ловим до запроса: у CheckAccount лимит проверок (skill green-api §6).
    const normalized = normalizePhone(phone);
    if (!normalized) {
      // Неразрывные пробелы: пример номера не разрывается переносом строки.
      setPhoneError('Номер — 11–12 цифр с кодом страны, например +7\u00a0999\u00a0123-45-67');
      return;
    }
    createChat.mutate(normalized, { onSuccess: () => setPhone('') });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <Input
        label="Номер телефона"
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
