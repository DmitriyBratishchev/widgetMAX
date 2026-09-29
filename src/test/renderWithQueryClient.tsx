import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';

// Свежий клиент на каждый рендер: кеш и состояние мутаций не протекают между тестами.
function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export function renderWithQueryClient(ui: ReactElement) {
  return render(ui, { wrapper: createQueryClientWrapper() });
}

export function renderHookWithQueryClient<Result>(hook: () => Result) {
  return renderHook(hook, { wrapper: createQueryClientWrapper() });
}
