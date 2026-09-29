import { GreenApiError } from '@/api/greenApiClient';

// CheckAccount ответил exist: false. Бросает хук, чтобы отказ пришёл в UI тем же путём, что и
// ошибки API, — через mutation.error.
export class AccountNotFoundError extends Error {
  constructor() {
    super('У номера нет аккаунта в MAX');
    this.name = 'AccountNotFoundError';
  }
}

// Общие для CheckAccount и SendMessage случаи; null — пусть решает вызывающий.
function describeCommonError(error: GreenApiError): string | null {
  if (error.kind === 'network') return 'Нет связи с GREEN-API. Проверьте интернет.';
  switch (error.status) {
    case 401:
      return 'GREEN-API не принял учётные данные. Выйдите и войдите заново.';
    case 429:
      return 'Слишком частые запросы. Подождите пару секунд и попробуйте снова.';
    case 466:
      return 'Превышены ограничения тарифа GREEN-API (на тарифе Developer — до 3 чатов).';
    default:
      return null;
  }
}

export function getCreateChatErrorMessage(error: unknown): string {
  if (error instanceof AccountNotFoundError) return 'У этого номера нет аккаунта в MAX';

  if (error instanceof GreenApiError) {
    const common = describeCommonError(error);
    if (common) return common;
    switch (error.status) {
      case 400:
        return 'GREEN-API не смог проверить номер. Проверьте его и попробуйте ещё раз.';
      case 469:
        return 'Исчерпан лимит проверок номеров. GREEN-API снимет ограничение через 2 часа.';
    }
  }

  return 'Не удалось создать чат. Попробуйте ещё раз.';
}

export function getSendMessageErrorMessage(error: unknown): string {
  if (error instanceof GreenApiError) {
    const common = describeCommonError(error);
    if (common) return common;
    switch (error.status) {
      case 400:
        return 'GREEN-API отклонил сообщение. Текст — не длиннее 4000 символов.';
      case 403:
        return 'Отправка временно ограничена для аккаунта MAX. Подробности — в личном кабинете GREEN-API.';
    }
  }

  return 'Не удалось отправить сообщение. Попробуйте ещё раз.';
}
