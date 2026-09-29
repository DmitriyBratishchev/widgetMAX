import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { GreenApiCredentials } from '@/types/greenApi';

interface SessionState {
  credentials: GreenApiCredentials | null;
  signIn: (credentials: GreenApiCredentials) => void;
  signOut: () => void;
}

export const SESSION_STORAGE_KEY = 'widgetmax-session';

// sessionStorage, а не localStorage: вход переживает F5, но токен стирается вместе с вкладкой
// (ресёрч max-chat §3 Р2).
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      credentials: null,
      signIn: (credentials) => set({ credentials }),
      signOut: () => set({ credentials: null }),
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ credentials: state.credentials }),
    },
  ),
);

// Сессия, в которой начат запрос, всё ещё текущая? Сравнение по ссылке: «Выйти» ставит null, а
// каждый вход — новый объект, так что «вышел и снова вошёл тем же инстансом» — уже другая сессия.
export function isCurrentSession(credentials: GreenApiCredentials): boolean {
  return useSessionStore.getState().credentials === credentials;
}
