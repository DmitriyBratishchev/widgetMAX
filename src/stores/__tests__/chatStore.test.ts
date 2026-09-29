import { beforeEach, describe, expect, it } from 'vitest';
import { CHAT_STORAGE_KEY, useChatStore, type ChatMessage } from '@/stores/chatStore';

const chat = { chatId: '10000000', phone: '79991234567' };

const message: ChatMessage = {
  idMessage: 'BAE5F4886F6F2D05',
  chatId: '10000000',
  text: 'Привет',
  direction: 'outgoing',
  timestamp: 1790000000000,
};

function storedState() {
  return JSON.parse(sessionStorage.getItem(CHAT_STORAGE_KEY) ?? '{}').state;
}

beforeEach(() => {
  useChatStore.getState().reset();
  sessionStorage.clear();
});

describe('chatStore', () => {
  it('addChat добавляет чат в начало списка и делает его активным', () => {
    const other = { chatId: '20000000', phone: '79990000000' };
    useChatStore.getState().addChat(chat);
    useChatStore.getState().addChat(other);

    expect(useChatStore.getState().chats).toEqual([other, chat]);
    expect(useChatStore.getState().activeChatId).toBe('20000000');
  });

  it('addChat с известным chatId не дублирует чат, а открывает его', () => {
    useChatStore.getState().addChat(chat);
    useChatStore.getState().addChat({ chatId: '20000000', phone: '79990000000' });
    useChatStore.getState().addChat(chat);

    expect(useChatStore.getState().chats).toHaveLength(2);
    expect(useChatStore.getState().activeChatId).toBe('10000000');
  });

  it('addMessage складывает сообщения по chatId и не дублирует idMessage', () => {
    useChatStore.getState().addMessage(message);
    useChatStore.getState().addMessage(message);
    useChatStore.getState().addMessage({ ...message, idMessage: 'BAE5F4886F6F2D06' });

    expect(useChatStore.getState().messagesByChatId['10000000']).toHaveLength(2);
  });

  it('новое сообщение поднимает свой чат в начало списка, дубль порядок не меняет', () => {
    const other = { chatId: '20000000', phone: '79990000000' };
    useChatStore.getState().addChat(chat);
    useChatStore.getState().addChat(other);
    useChatStore.getState().addMessage(message);

    expect(useChatStore.getState().chats).toEqual([chat, other]);

    useChatStore.getState().addMessage({ ...message, chatId: '20000000' });
    expect(useChatStore.getState().chats).toEqual([other, chat]);

    useChatStore.getState().addMessage(message);
    expect(useChatStore.getState().chats).toEqual([other, chat]);
  });

  it('closeChat закрывает чат, список не трогает', () => {
    useChatStore.getState().addChat(chat);
    useChatStore.getState().closeChat();

    expect(useChatStore.getState().activeChatId).toBeNull();
    expect(useChatStore.getState().chats).toEqual([chat]);
  });

  it('состояние пишется в sessionStorage, reset его стирает', () => {
    useChatStore.getState().addChat(chat);
    useChatStore.getState().addMessage(message);

    expect(storedState()).toEqual({
      chats: [chat],
      messagesByChatId: { '10000000': [message] },
      activeChatId: '10000000',
    });

    useChatStore.getState().reset();

    expect(storedState()).toEqual({ chats: [], messagesByChatId: {}, activeChatId: null });
  });

  it('rehydrate восстанавливает чаты из sessionStorage (F5)', async () => {
    sessionStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        state: { chats: [chat], messagesByChatId: { '10000000': [message] }, activeChatId: null },
        version: 0,
      }),
    );

    await useChatStore.persist.rehydrate();

    expect(useChatStore.getState().chats).toEqual([chat]);
    expect(useChatStore.getState().messagesByChatId['10000000']).toEqual([message]);
  });
});
