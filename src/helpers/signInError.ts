import { GreenApiError } from '@/api/greenApiClient';
import type { StateInstance } from '@/types/greenApi';

export class InstanceNotAuthorizedError extends Error {
  readonly state: StateInstance;

  constructor(state: StateInstance) {
    super(`Инстанс в состоянии ${state}`);
    this.name = 'InstanceNotAuthorizedError';
    this.state = state;
  }
}

function describeInstanceState(state: StateInstance): string {
  switch (state) {
    case 'notAuthorized':
      return 'Инстанс не авторизован в MAX: получите QR-код в личном кабинете GREEN-API и отсканируйте его в приложении MAX.';
    case 'blocked':
      return 'Инстанс заблокирован. Подробности — в личном кабинете GREEN-API.';
    case 'starting':
      return 'Инстанс запускается. Попробуйте войти через минуту.';
    case 'suspended':
      return 'Инстанс приостановлен. Проверьте тариф в личном кабинете GREEN-API.';
    case 'pendingPassword':
      return 'MAX запрашивает пароль входа. Отключите пароль в MAX и авторизуйте инстанс заново.';
    default:
      return `Инстанс недоступен (состояние «${state}»). Проверьте его в личном кабинете GREEN-API.`;
  }
}

export function getSignInErrorMessage(error: unknown): string {
  if (error instanceof InstanceNotAuthorizedError) return describeInstanceState(error.state);

  if (error instanceof GreenApiError) {
    if (error.kind === 'network') {
      return 'Нет связи с GREEN-API. Проверьте интернет и адрес apiUrl.';
    }
    switch (error.status) {
      case 401:
      case 403:
        return 'Неверный idInstance или apiTokenInstance.';
      case 404:
        return 'Инстанс не найден по этому apiUrl. Сверьте адрес с личным кабинетом GREEN-API.';
      case 429:
        return 'Слишком частые запросы. Подождите пару секунд и попробуйте снова.';
    }
  }

  return 'Не удалось войти. Попробуйте ещё раз.';
}
