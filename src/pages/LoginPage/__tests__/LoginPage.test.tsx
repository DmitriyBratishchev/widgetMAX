import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError } from '@/api/greenApiClient';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { getStateInstance } from '@/services/instanceService';
import { useSessionStore } from '@/stores/sessionStore';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';

vi.mock('@/services/instanceService', () => ({
  getStateInstance: vi.fn<typeof getStateInstance>(),
}));

function getFields() {
  return {
    idInstance: screen.getByLabelText('idInstance'),
    token: screen.getByLabelText('apiTokenInstance'),
    apiUrl: screen.getByLabelText('apiUrl'),
    submit: screen.getByRole('button', { name: /Войти|Входим/ }),
  };
}

beforeEach(() => {
  useSessionStore.getState().signOut();
  sessionStorage.clear();
});

describe('LoginPage', () => {
  it('подставляет apiUrl из idInstance, пока его не правили руками', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LoginPage />);
    const { idInstance, apiUrl } = getFields();

    await user.type(idInstance, '3100000000');
    expect(apiUrl).toHaveValue('https://3100.api.green-api.com');

    await user.clear(apiUrl);
    await user.type(apiUrl, 'https://custom.example.com');
    await user.clear(idInstance);
    await user.type(idInstance, '7103000000');
    expect(apiUrl).toHaveValue('https://custom.example.com');
  });

  it('токен вводится в поле password', () => {
    renderWithQueryClient(<LoginPage />);

    expect(getFields().token).toHaveAttribute('type', 'password');
  });

  it('пустая форма → ошибки полей, запрос не уходит', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LoginPage />);

    await user.click(getFields().submit);

    expect(screen.getByText('Введите idInstance')).toBeInTheDocument();
    expect(screen.getByText('Введите apiTokenInstance')).toBeInTheDocument();
    expect(getFields().idInstance).toHaveAttribute('aria-invalid', 'true');
    expect(getStateInstance).not.toHaveBeenCalled();
  });

  it('во время запроса кнопка недоступна, после authorized — вход выполнен', async () => {
    let resolveState!: (value: { stateInstance: 'authorized' }) => void;
    vi.mocked(getStateInstance).mockReturnValue(
      new Promise((resolve) => {
        resolveState = resolve;
      }),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<LoginPage />);
    const { idInstance, token } = getFields();

    await user.type(idInstance, '1101000000');
    await user.type(token, 'test-token');
    await user.click(getFields().submit);

    expect(screen.getByRole('button', { name: 'Входим…' })).toBeDisabled();

    resolveState({ stateInstance: 'authorized' });
    await waitFor(() =>
      expect(useSessionStore.getState().credentials).toEqual({
        idInstance: '1101000000',
        apiTokenInstance: 'test-token',
        apiUrl: 'https://1101.api.green-api.com',
      }),
    );
  });

  it('неверный токен (401) → понятная ошибка в role=alert, без токена', async () => {
    vi.mocked(getStateInstance).mockRejectedValue(
      new GreenApiError('getStateInstance', 'http', 401),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<LoginPage />);
    const { idInstance, token } = getFields();

    await user.type(idInstance, '1101000000');
    await user.type(token, 'test-token');
    await user.click(getFields().submit);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Неверный idInstance или apiTokenInstance');
    expect(alert).not.toHaveTextContent('test-token');
    expect(useSessionStore.getState().credentials).toBeNull();
  });
});
