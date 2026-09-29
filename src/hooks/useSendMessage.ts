import { useMutation } from '@tanstack/react-query';
import { SessionEndedError } from '@/helpers/chatError';
import { sendMessage } from '@/services/chatService';
import { useChatStore, type ChatMessage } from '@/stores/chatStore';
import { isCurrentSession, useSessionStore } from '@/stores/sessionStore';

interface SendMessageVariables {
  chatId: string;
  text: string;
}

export function useSendMessage() {
  const credentials = useSessionStore((s) => s.credentials);
  const addMessage = useChatStore((s) => s.addMessage);

  return useMutation({
    mutationFn: async ({ chatId, text }: SendMessageVariables): Promise<ChatMessage> => {
      if (!credentials) throw new Error('Нет сессии GREEN-API');
      const message = text.trim();
      const { idMessage } = await sendMessage(credentials, { chatId, message });
      // Пока шла отправка, нажали «Выйти»: сообщение старой сессии в журнал не пишем.
      if (!isCurrentSession(credentials)) throw new SessionEndedError();
      // В ленту — только после ответа GREEN-API: при ошибке в чате не остаётся «призрака».
      return { idMessage, chatId, text: message, direction: 'outgoing', timestamp: Date.now() };
    },
    onSuccess: (message) => addMessage(message),
  });
}
