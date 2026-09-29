import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { CHAT_STORAGE_KEY, useChatStore } from '@/stores/chatStore';
import { SESSION_STORAGE_KEY, useSessionStore } from '@/stores/sessionStore';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';

vi.mock('@/services/instanceService', () => ({ getStateInstance: vi.fn() }));
vi.mock('@/services/chatService', () => ({ checkAccount: vi.fn(), sendMessage: vi.fn() }));

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
    expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? '{}').state).toEqual({
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

    expect(JSON.parse(sessionStorage.getItem(CHAT_STORAGE_KEY) ?? '{}').state).toEqual({
      chats: [],
      messagesByChatId: {},
      activeChatId: null,
    });

    act(() => useSessionStore.getState().signIn(credentials));

    expect(screen.getByText(/Чатов пока нет/)).toBeInTheDocument();
  });
});
