import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { ChatPage } from '@/pages/ChatPage/ChatPage';
import { checkAccount, sendMessage } from '@/services/chatService';
import { type deleteNotification, receiveNotification } from '@/services/notificationService';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';
import { TEST_CREDENTIALS } from '@/test/fixtures';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';

vi.mock('@/services/chatService', () => ({
  checkAccount: vi.fn<typeof checkAccount>(),
  sendMessage: vi.fn<typeof sendMessage>(),
}));
vi.mock('@/services/notificationService', () => ({
  receiveNotification: vi.fn<typeof receiveNotification>(),
  deleteNotification: vi.fn<typeof deleteNotification>(),
}));

function openChat() {
  useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
}

// Промис, который тест завершает сам, — чтобы увидеть состояние «идёт запрос».
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  // Очередь пуста: receive висит, как long-poll. Мгновенный ответ крутил бы цикл без пауз.
  vi.mocked(receiveNotification).mockImplementation(() => new Promise(() => {}));
  useChatStore.getState().reset();
  useSessionStore.getState().signIn(TEST_CREDENTIALS);
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

describe('ChatPage: узкий экран', () => {
  // Колонки прячет CSS (@include narrow), jsdom его не применяет — проверяем data-view и поведение.
  it('«Назад» закрывает чат и возвращает к списку', async () => {
    openChat();
    const user = userEvent.setup();
    const { container } = renderWithQueryClient(<ChatPage />);
    const page = container.firstElementChild;

    expect(page).toHaveAttribute('data-view', 'chat');

    await user.click(screen.getByRole('button', { name: 'Назад к списку чатов' }));

    expect(page).toHaveAttribute('data-view', 'list');
    expect(screen.queryByLabelText('Сообщение')).not.toBeInTheDocument();
    expect(
      screen.getByText('Выберите чат или создайте новый по номеру телефона'),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Чаты' })).toHaveTextContent('+79991234567');
  });
});

describe('ChatPage: новый чат', () => {
  it('пустой номер → «Введите номер телефона», фокус в поле, запрос не уходит', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.click(screen.getByRole('button', { name: 'Создать чат' }));

    const phoneInput = screen.getByLabelText('Номер телефона');
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
    expect(phoneInput).toHaveAccessibleDescription('Введите номер телефона');
    expect(phoneInput).toHaveFocus();
    expect(checkAccount).not.toHaveBeenCalled();
  });

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
    expect(checkAccount).toHaveBeenCalledWith(TEST_CREDENTIALS, 79991234567);

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

    expect(sendMessage).toHaveBeenCalledWith(TEST_CREDENTIALS, {
      chatId: '10000000',
      message: 'Привет',
    });
    expect(screen.getByRole('button', { name: 'Отправляем…' })).toBeDisabled();

    send.resolve({ idMessage: 'BAE5F4886F6F2D05' });

    const feed = await screen.findByRole('list', { name: 'Сообщения' });
    expect(within(feed).getByText('Привет')).toBeInTheDocument();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('');
  });

  it('во время отправки поле только для чтения: допечатанное не теряется, после ответа поле пусто и в фокусе', async () => {
    const send = deferred<{ idMessage: string }>();
    vi.mocked(sendMessage).mockReturnValue(send.promise);
    openChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);
    const input = screen.getByLabelText('Сообщение');

    await user.type(input, 'Привет{Enter}');
    expect(input).toHaveAttribute('readonly');

    await user.type(input, ' ещё');
    expect(input).toHaveValue('Привет');

    send.resolve({ idMessage: 'BAE5F4886F6F2D05' });

    await waitFor(() => expect(input).not.toHaveAttribute('readonly'));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('Shift+Enter — перенос строки, а не отправка', async () => {
    openChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Сообщение'), 'Строка 1{Shift>}{Enter}{/Shift}Строка 2');

    expect(sendMessage).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Строка 1\nСтрока 2');
  });

  it('Enter во время набора через IME не отправляет — он подтверждает выбор иероглифа', async () => {
    openChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);
    const input = screen.getByLabelText('Сообщение');

    await user.type(input, 'nihao');
    // user-event не умеет композицию IME — событие с isComposing собираем сами. Отправляя, обработчик
    // отменяет Enter (preventDefault); неотменённое событие — Enter не перехвачен.
    const notCanceled = fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(notCanceled).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(input).toHaveValue('nihao');
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

  it('текст сообщения выводится как текст, HTML не исполняется', () => {
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

  it('ответ в чат внизу списка поднимает его наверх, с временем и превью', async () => {
    openChat();
    useChatStore.getState().addChat({ chatId: '20000000', phone: '79990000000' });
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
    const chatList = screen.getByRole('list', { name: 'Чаты' });

    expect(within(chatList).getAllByRole('button')[0]).toHaveTextContent('+79990000000');

    await within(chatList).findByText('Привет из MAX');

    const [first] = within(chatList).getAllByRole('button');
    assert.isDefined(first);
    expect(first).toHaveTextContent('+79991234567');
    expect(first.querySelector('time')).toHaveAttribute(
      'dateTime',
      new Date(1763115112000).toISOString(),
    );
  });

  it('без ошибок опроса плашки нет', () => {
    openChat();
    renderWithQueryClient(<ChatPage />);

    expect(screen.queryByText(/Приём сообщений остановлен/)).not.toBeInTheDocument();
  });

  it('GREEN-API не принял учётные данные (401) → плашка над лентой', async () => {
    openChat();
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'http', 401),
    );
    renderWithQueryClient(<ChatPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Приём сообщений остановлен: GREEN-API не принял учётные данные. Войдите заново',
    );
    expect(receiveNotification).toHaveBeenCalledTimes(1);
  });

  it('чат не выбран — плашка остановки всё равно видна', async () => {
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'http', 403),
    );
    renderWithQueryClient(<ChatPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Приём сообщений остановлен/);
  });
});

describe('ChatPage: скринридер', () => {
  it('лента — live-регион role=log с aria-live=polite, есть и в пустом чате', () => {
    openChat();
    renderWithQueryClient(<ChatPage />);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveTextContent('Сообщений пока нет. Напишите первое.');
  });

  it('у сообщения есть текст направления для скринридера', () => {
    openChat();
    useChatStore.getState().addMessage({
      idMessage: 'in-1',
      chatId: '10000000',
      text: 'Привет из MAX',
      direction: 'incoming',
      timestamp: 1790000000000,
    });
    useChatStore.getState().addMessage({
      idMessage: 'out-1',
      chatId: '10000000',
      text: 'Привет',
      direction: 'outgoing',
      timestamp: 1790000060000,
    });
    renderWithQueryClient(<ChatPage />);

    const [incoming, outgoing] = within(screen.getByRole('log')).getAllByRole('listitem');
    expect(incoming).toHaveTextContent('Собеседник: Привет из MAX');
    expect(outgoing).toHaveTextContent('Вы: Привет');
  });

  it('другой чат — новый live-регион: история не зачитывается', async () => {
    useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
    useChatStore.getState().addChat({ chatId: '20000000', phone: '79990000000' });
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);
    const firstLog = screen.getByRole('log');

    await user.click(screen.getByRole('button', { name: /\+79991234567/ }));

    expect(screen.getByRole('log')).not.toBe(firstLog);
  });

  it('плашка остановки не перемонтируется при открытии и закрытии чата и лежит вне ленты', async () => {
    useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
    useChatStore.getState().closeChat();
    vi.mocked(receiveNotification).mockRejectedValueOnce(
      new GreenApiError('receiveNotification', 'http', 401),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);
    const alert = await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: /\+79991234567/ }));
    expect(screen.getByRole('alert')).toBe(alert);
    expect(screen.getByRole('log')).not.toContainElement(alert);

    await user.click(screen.getByRole('button', { name: 'Назад к списку чатов' }));
    expect(screen.getByRole('alert')).toBe(alert);
  });
});

describe('ChatPage: фокус', () => {
  it('«Назад» → фокус на закрытом чате в списке', async () => {
    useChatStore.getState().addChat({ chatId: '20000000', phone: '79990000000' });
    openChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.click(screen.getByRole('button', { name: 'Назад к списку чатов' }));

    expect(screen.getByRole('button', { name: /\+79991234567/ })).toHaveFocus();
  });

  it('клик по чату в списке → фокус в поле «Сообщение»', async () => {
    useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
    useChatStore.getState().closeChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.click(screen.getByRole('button', { name: /\+79991234567/ }));

    expect(screen.getByLabelText('Сообщение')).toHaveFocus();
  });

  it('«Создать чат» → фокус в поле «Сообщение» нового чата', async () => {
    vi.mocked(checkAccount).mockResolvedValue({ exist: true, chatId: '10000000' });
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Номер телефона'), '+7 999 123-45-67');
    await user.click(screen.getByRole('button', { name: 'Создать чат' }));

    expect(await screen.findByLabelText('Сообщение')).toHaveFocus();
  });

  it('«Перейти в чат» → фокус в поле «Сообщение»', async () => {
    useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
    useChatStore.getState().closeChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Номер телефона'), '+7 999 123-45-67');
    await user.click(screen.getByRole('button', { name: 'Перейти в чат' }));

    expect(await screen.findByLabelText('Сообщение')).toHaveFocus();
  });

  it('Tab по списку чатов не открывает чат и оставляет фокус в списке', async () => {
    useChatStore.getState().addChat({ chatId: '20000000', phone: '79990000000' });
    useChatStore.getState().addChat({ chatId: '10000000', phone: '79991234567' });
    useChatStore.getState().closeChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);
    const [first, second] = within(screen.getByRole('list', { name: 'Чаты' })).getAllByRole(
      'button',
    );
    assert.isDefined(first);

    first.focus();
    await user.tab();

    expect(second).toHaveFocus();
    expect(screen.queryByLabelText('Сообщение')).not.toBeInTheDocument();
  });

  it('нажатие «Отправить» → фокус остаётся в поле «Сообщение»', async () => {
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => {}));
    openChat();
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Сообщение'), 'Привет');
    await user.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(screen.getByRole('button', { name: 'Отправляем…' })).toBeDisabled();
    expect(screen.getByLabelText('Сообщение')).toHaveFocus();
  });

  it('неверный номер → фокус в поле номера', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Номер телефона'), '12345');
    await user.click(screen.getByRole('button', { name: 'Создать чат' }));

    expect(screen.getByLabelText('Номер телефона')).toHaveFocus();
  });

  it('отказ CheckAccount → фокус в поле номера', async () => {
    vi.mocked(checkAccount).mockResolvedValue({ exist: false, chatId: '' });
    const user = userEvent.setup();
    renderWithQueryClient(<ChatPage />);

    await user.type(screen.getByLabelText('Номер телефона'), '+7 999 123-45-67');
    await user.click(screen.getByRole('button', { name: 'Создать чат' }));

    await screen.findByRole('alert');
    expect(screen.getByLabelText('Номер телефона')).toHaveFocus();
  });
});
