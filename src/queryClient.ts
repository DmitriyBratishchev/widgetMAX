import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    // Молчаливый повтор SendMessage задублирует сообщение у получателя,
    // а повтор CheckAccount тратит лимит проверок номеров — ошибку показываем сразу.
    mutations: { retry: false },
  },
});
