import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { ChatPage } from '@/pages/ChatPage/ChatPage';
import { checkAccount, sendMessage } from '@/services/chatService';
import { receiveNotification } from '@/services/notificationService';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';

vi.mock('@/services/chatService', () => ({ checkAccount: vi.fn(), sendMessage: vi.fn() }));
vi.mock('@/services/notificationService', () => ({
  receiveNotification: vi.fn(),
  deleteNotification: vi.fn(),
}));

const credentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://1101.api.green-api.com',
};

function openChat() {
  useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
}

// Промис, который тест завершает сам, — чтобы увидеть состояние «идёт запрос».
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.mocked(checkAccount).mockReset();
  vi.mocked(sendMessage).mockReset();
  // Очередь пуста: receive висит, как long-poll. Мгновенный ответ крутил бы цикл без пауз.
  vi.mocked(receiveNotification)
    .mockReset()
    .mockImplementation(() => new Promise(() => {}));
  useChatStore.getState().reset();
  useSessionStore.getState().signIn(credentials);
  sessionStorage.clear();
});

describe('ChatPage: пустые состояния', () => {
  it('нет чатов и чат не выбран', () => {
    renderWithQueryClient(<ChatPage />);

    expect(screen.getByText(/Чатов пока нет/)).toBeInTheDocument();
    expect(
      screen.getByText('Выберите чат или создайте новый по номеру телефона'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Сообщение')).not.toBeInTheDocument();
  });

  it('в открытом чате нет сообщений', () => {
    openChat();
    renderWithQueryClient(<ChatPage />);

    expect(screen.getByRole('heading', { name: '+79991234567' })).toBeInTheDocument();
    expect(screen.getByText('Сообщений пока нет. Напишите первое.')).toBeInTheDocument();
  });
});

describe('ChatPage: новый чат', () => {
  it('неверный номер → ошибка поля, запрос не уходит', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Номер телефона'), '12345');
    await user.click(screen.getByRole('button', { name: 'Создать чат' }));

    expect(screen.getByText(/11–12 цифр с кодом страны/)).toBeInTheDocument();
    expect(screen.getByLabelText('Номер телефона')).toHaveAttribute('aria-invalid', 'true');
    expect(checkAccount).not.toHaveBeenCalled();
  });

  it('номер без MAX → «нет аккаунта в MAX», чат не создан', async () => {
    vi.mocked(checkAccount).mockResolvedValue({ exist: false, chatId: '' });
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Номер телефона'), '+7 (999) 123-45-67');
    await user.click(screen.getByRole('button', { name: 'Создать чат' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('У этого номера нет аккаунта в MAX');
    expect(screen.getByText(/Чатов пока нет/)).toBeInTheDocument();
  });

  it('номер с MAX → чат в списке и открыт, поле очищено; во время проверки кнопка недоступна', async () => {
    const check = deferred<{ exist: boolean; chatId: string }>();
    vi.mocked(checkAccount).mockReturnValue(check.promise);
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Номер телефона'), '8 999 123 45 67');
    await user.click(screen.getByRole('button', { name: 'Создать чат' }));

    expect(screen.getByRole('button', { name: 'Проверяем номер…' })).toBeDisabled();
    expect(checkAccount).toHaveBeenCalledWith(credentials, 79991234567);

    check.resolve({ exist: true, chatId: '10000000' });

    const chatList = await screen.findByRole('list', { name: 'Чаты' });
    expect(within(chatList).getByRole('button', { current: true })).toHaveTextContent(
      '+79991234567',
    );
    expect(screen.getByRole('heading', { name: '+79991234567' })).toBeInTheDocument();
    expect(screen.getByLabelText('Номер телефона')).toHaveValue('');
  });

  it('номер из списка → кнопка «Перейти в чат», чат открывается без CheckAccount', async () => {
    useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
    useChatStore.getState().addChat({ chatId: '20000000', phone: '79990000000' });
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);
    const phoneInput = screen.getByLabelText('Номер телефона');

    await user.type(phoneInput, '8 (999) 123-45-6');
    expect(screen.getByRole('button', { name: 'Создать чат' })).toBeInTheDocument();

    await user.type(phoneInput, '7');
    await user.click(screen.getByRole('button', { name: 'Перейти в чат' }));

    expect(await screen.findByRole('heading', { name: '+79991234567' })).toBeInTheDocument();
    expect(checkAccount).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Создать чат' })).toBeInTheDocument();
  });

  it('клик по чату в списке открывает его', async () => {
    useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
    useChatStore.getState().addChat({ chatId: '20000000', phone: '79990000000' });
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.click(screen.getByRole('button', { name: /\+79991234567/ }));

    expect(screen.getByRole('heading', { name: '+79991234567' })).toBeInTheDocument();
  });
});

describe('ChatPage: отправка', () => {
  it('пустой и пробельный текст — «Отправить» недоступна', async () => {
    openChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();

    await user.type(screen.getByLabelText('Сообщение'), '   ');
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();

    await user.type(screen.getByLabelText('Сообщение'), '{Enter}');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('Enter отправляет: во время отправки кнопка недоступна, после — сообщение в ленте, поле пусто', async () => {
    const send = deferred<{ idMessage: string }>();
    vi.mocked(sendMessage).mockReturnValue(send.promise);
    openChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Сообщение'), 'Привет{Enter}');

    expect(sendMessage).toHaveBeenCalledWith(credentials, {
      chatId: '10000000',
      message: 'Привет',
    });
    expect(screen.getByRole('button', { name: 'Отправляем…' })).toBeDisabled();

    send.resolve({ idMessage: 'BAE5F4886F6F2D05' });

    const feed = await screen.findByRole('list', { name: 'Сообщения' });
    expect(within(feed).getByText('Привет')).toBeInTheDocument();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('');
  });

  it('Shift+Enter — перенос строки, а не отправка', async () => {
    openChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Сообщение'), 'Строка 1{Shift>}{Enter}{/Shift}Строка 2');

    expect(sendMessage).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Строка 1\nСтрока 2');
  });

  it('ошибка отправки → текст в role=alert, набранный текст не потерян', async () => {
    vi.mocked(sendMessage).mockRejectedValue(new GreenApiError('sendMessage', 'network'));
    openChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Сообщение'), 'Привет');
    await user.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи с GREEN-API');
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Привет');
    expect(screen.getByText('Сообщений пока нет. Напишите первое.')).toBeInTheDocument();
  });

  it('текст сообщения выводится как текст, HTML не исполняется', async () => {
    useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
    useChatStore.getState().addMessage({
      idMessage: 'BAE5F4886F6F2D05',
      chatId: '10000000',
      text: '<b>x</b><img src=x onerror=alert(1)>',
      direction: 'incoming',
      timestamp: 1790000000000,
    });
    renderWithQueryClient(<ChatPage />);

    const feed = screen.getByRole('list', { name: 'Сообщения' });
    expect(within(feed).getByText('<b>x</b><img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(feed.querySelector('b, img')).toBeNull();
  });
});

describe('ChatPage: приём', () => {
  it('ответ собеседника появляется в открытом чате без перезагрузки', async () => {
    openChat();
    vi.mocked(receiveNotification).mockResolvedValueOnce({
      receiptId: 1234567,
      body: {
        typeWebhook: 'incomingMessageReceived',
        timestamp: 1763115112,
        idMessage: '1763115112345',
        senderData: { chatId: '10000000' },
        messageData: {
          typeMessage: 'textMessage',
          textMessageData: { textMessage: 'Привет из MAX' },
        },
      },
    });
    renderWithQueryClient(<ChatPage />);

    const messages = await screen.findByRole('list', { name: 'Сообщения' });
    expect(within(messages).getByText('Привет из MAX')).toBeInTheDocument();
  });
});
