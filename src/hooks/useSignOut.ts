import { useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSessionStore } from '@/stores/sessionStore';

// Выход стирает и сессию, и журнал чатов: следующий вход может быть другим инстансом.
// Сторы друг о друге не знают — связывает их этот хук.
export function useSignOut() {
  const signOut = useSessionStore((s) => s.signOut);
  const resetChats = useChatStore((s) => s.reset);

  return useCallback(() => {
    resetChats();
    signOut();
  }, [resetChats, signOut]);
}
