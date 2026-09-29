import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import type { checkAccount, sendMessage } from '@/services/chatService';
import type { getStateInstance } from '@/services/instanceService';
import type { deleteNotification, receiveNotification } from '@/services/notificationService';
import { CHAT_STORAGE_KEY, useChatStore } from '@/stores/chatStore';
import { SESSION_STORAGE_KEY, useSessionStore } from '@/stores/sessionStore';
import { readPersistedState } from '@/test/persistedState';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';

vi.mock('@/services/instanceService', () => ({
  getStateInstance: vi.fn<typeof getStateInstance>(),
}));
vi.mock('@/services/chatService', () => ({
  checkAccount: vi.fn<typeof checkAccount>(),
  sendMessage: vi.fn<typeof sendMessage>(),
}));
// Очередь пуста: receive висит, как long-poll, — экран чатов не уходит в сеть и не крутит цикл.
vi.mock('@/services/notificationService', () => ({
  receiveNotification: vi.fn<typeof receiveNotification>(() => new Promise(() => {})),
  deleteNotification: vi.fn<typeof deleteNotification>(),
}));

const credentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com',
};

beforeEach(() => {
  useSessionStore.getState().signOut();
  useChatStore.getState().reset();
  sessionStorage.clear();
});

describe('App', () => {
  it('без сессии показывает форму входа', () => {
    renderWithQueryClient(<App />);

    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });

  it('с сессией показывает экран чата, «Выйти» возвращает на вход и стирает сессию', async () => {
    useSessionStore.getState().signIn(credentials);
    const user = userEvent.setup();
    renderWithQueryClient(<App />);

    expect(screen.getByText('Инстанс 1101000000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Выйти' }));

    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(readPersistedState(SESSION_STORAGE_KEY)).toEqual({
      credentials: null,
    });
  });

  it('«Выйти» стирает и чаты: после повторного входа список пуст', async () => {
    useSessionStore.getState().signIn(credentials);
    useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
    const user = userEvent.setup();
    renderWithQueryClient(<App />);

    expect(screen.getByRole('button', { name: /\+79991234567/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Выйти' }));

    expect(readPersistedState(CHAT_STORAGE_KEY)).toEqual({
      chats: [],
      messagesByChatId: {},
      activeChatId: null,
    });

    act(() => useSessionStore.getState().signIn(credentials));

    expect(screen.getByText(/Чатов пока нет/)).toBeInTheDocument();
  });
});
