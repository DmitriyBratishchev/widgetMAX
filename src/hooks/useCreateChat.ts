import { useMutation } from '@tanstack/react-query';
import { AccountNotFoundError, SessionEndedError } from '@/helpers/chatError';
import { checkAccount } from '@/services/chatService';
import { useChatStore, type Chat } from '@/stores/chatStore';
import { isCurrentSession, useSessionStore } from '@/stores/sessionStore';

// Принимает номер, уже нормализованный normalizePhone (11–12 цифр).
export function useCreateChat() {
  const credentials = useSessionStore((s) => s.credentials);
  const addChat = useChatStore((s) => s.addChat);

  return useMutation({
    mutationFn: async (phone: string): Promise<Chat> => {
      // Номер уже в списке — открываем его чат без CheckAccount: на тарифе Developer всего
      // 100 проверок, а превышение (469) закрывает их на 2 часа.
      const existing = useChatStore.getState().chats.find((c) => c.phone === phone);
      if (existing) return existing;

      if (!credentials) throw new Error('Нет сессии GREEN-API');
      const { exist, chatId } = await checkAccount(credentials, Number(phone));
      // Пока шла проверка, нажали «Выйти»: чат старой сессии не должен пережить выход.
      if (!isCurrentSession(credentials)) throw new SessionEndedError();
      if (!exist || !chatId) throw new AccountNotFoundError();
      return { chatId, phone };
    },
    onSuccess: (chat) => addChat(chat),
  });
}
