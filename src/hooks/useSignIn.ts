import { useMutation } from '@tanstack/react-query';
import { normalizeCredentials } from '@/helpers/credentialsValidation';
import { InstanceNotAuthorizedError } from '@/helpers/signInError';
import { getStateInstance } from '@/services/instanceService';
import { useSessionStore } from '@/stores/sessionStore';
import type { GreenApiCredentials } from '@/types/greenApi';

export function useSignIn() {
  const signIn = useSessionStore((s) => s.signIn);

  return useMutation({
    mutationFn: async (values: GreenApiCredentials) => {
      const credentials = normalizeCredentials(values);
      const { stateInstance } = await getStateInstance(credentials);
      // Отказ по состоянию бросаем здесь же: любая неудача входа приходит в UI одним путём —
      // через mutation.error.
      if (stateInstance !== 'authorized') throw new InstanceNotAuthorizedError(stateInstance);
      return credentials;
    },
    onSuccess: (credentials) => signIn(credentials),
  });
}
