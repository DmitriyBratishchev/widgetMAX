import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface Chat {
  // Ключ чата — числовой chatId из CheckAccount, а не телефон: ответ из MAX приходит с числовым
  // senderData.chatId (skill green-api §5). Телефон — только подпись в списке.
  chatId: string;
  phone: string;
}

export interface ChatMessage {
  idMessage: string;
  chatId: string;
  text: string;
  direction: 'incoming' | 'outgoing';
  // Unix-время в миллисекундах.
  timestamp: number;
}

interface ChatData {
  chats: Chat[];
  messagesByChatId: Record<string, ChatMessage[]>;
  activeChatId: string | null;
}

interface ChatState extends ChatData {
  addChat: (chat: Chat) => void;
  selectChat: (chatId: string) => void;
  closeChat: () => void;
  addMessage: (message: ChatMessage) => void;
  reset: () => void;
}

export const CHAT_STORAGE_KEY = 'widgetmax-chat';

const EMPTY_CHAT_DATA: ChatData = { chats: [], messagesByChatId: {}, activeChatId: null };

// Журнал чатов собирается на клиенте — перечитать его с сервера нечем. В sessionStorage рядом с
// сессией: переживает F5 и стирается вместе с вкладкой (ресёрч max-chat §5.2).
export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      ...EMPTY_CHAT_DATA,
      // Новый чат — в начало списка; уже известный chatId не дублируется, а открывается.
      addChat: (chat) =>
        set((state) => ({
          chats: state.chats.some((c) => c.chatId === chat.chatId)
            ? state.chats
            : [chat, ...state.chats],
          activeChatId: chat.chatId,
        })),
      selectChat: (chatId) => set({ activeChatId: chatId }),
      // «Назад» на узком экране: к списку чатов.
      closeChat: () => set({ activeChatId: null }),
      // Дедуп по idMessage: WM-03 получит эхо своей же отправки (outgoingAPIMessageReceived).
      // Новое сообщение поднимает свой чат в начало списка — сортировка по последней активности.
      addMessage: (message) =>
        set((state) => {
          const messages = state.messagesByChatId[message.chatId] ?? [];
          if (messages.some((m) => m.idMessage === message.idMessage)) return state;
          const chat = state.chats.find((c) => c.chatId === message.chatId);
          return {
            chats: chat ? [chat, ...state.chats.filter((c) => c !== chat)] : state.chats,
            messagesByChatId: {
              ...state.messagesByChatId,
              [message.chatId]: [...messages, message],
            },
          };
        }),
      reset: () => set(EMPTY_CHAT_DATA),
    }),
    {
      name: CHAT_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state): ChatData => ({
        chats: state.chats,
        messagesByChatId: state.messagesByChatId,
        activeChatId: state.activeChatId,
      }),
    },
  ),
);
