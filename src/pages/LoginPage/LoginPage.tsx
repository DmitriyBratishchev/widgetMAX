import { useRef, useState, type ChangeEvent, type SubmitEvent } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { suggestApiUrl } from '@/helpers/apiUrl';
import { validateCredentials, type CredentialsErrors } from '@/helpers/credentialsValidation';
import { getSignInErrorMessage } from '@/helpers/signInError';
import { useSignIn } from '@/hooks/useSignIn';
import type { GreenApiCredentials } from '@/types/greenApi';
import styles from './LoginPage.module.scss';

const EMPTY_VALUES: GreenApiCredentials = { idInstance: '', apiTokenInstance: '', apiUrl: '' };
// Порядок полей на экране: при ошибках фокус уходит на первое невалидное.
const FIELDS: (keyof GreenApiCredentials)[] = ['idInstance', 'apiTokenInstance', 'apiUrl'];

export function LoginPage() {
  const signIn = useSignIn();
  const [values, setValues] = useState<GreenApiCredentials>(EMPTY_VALUES);
  const [errors, setErrors] = useState<CredentialsErrors>({});
  // Пока пользователь не правил apiUrl сам, поле следует за idInstance (ресёрч max-chat §3 Р3).
  const [isApiUrlEdited, setIsApiUrlEdited] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const focusField = (field: keyof GreenApiCredentials) => {
    const input = formRef.current?.elements.namedItem(field);
    if (input instanceof HTMLInputElement) input.focus();
  };

  const handleChange = (field: keyof GreenApiCredentials) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'idInstance' && !isApiUrlEdited) next.apiUrl = suggestApiUrl(value);
      return next;
    });
    if (field === 'apiUrl') setIsApiUrlEdited(true);
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationErrors = validateCredentials(values);
    // Ошибки — в DOM до фокуса: скринридер прочтёт поле вместе с aria-invalid и текстом ошибки.
    flushSync(() => setErrors(validationErrors));
    const invalidField = FIELDS.find((field) => validationErrors[field]);
    if (invalidField) {
      focusField(invalidField);
      return;
    }
    // Отказ GREEN-API объявляет role="alert", а заблокированная на время запроса «Войти» теряет
    // фокус. Возвращаем его в первое поле: 401 правится там, а сеть и 429 — Enter из любого поля.
    signIn.mutate(values, { onError: () => focusField('idInstance') });
  };

  return (
    <main className={styles.page}>
      <form ref={formRef} className={styles.card} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.title}>widgetMAX</h1>
        <p className={styles.subtitle}>
          Войдите данными инстанса MAX из{' '}
          <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
            личного кабинета GREEN-API
          </a>
        </p>

        <Input
          label="idInstance"
          name="idInstance"
          inputMode="numeric"
          autoComplete="off"
          value={values.idInstance}
          onChange={handleChange('idInstance')}
          error={errors.idInstance}
        />
        <Input
          label="apiTokenInstance"
          name="apiTokenInstance"
          type="password"
          autoComplete="off"
          value={values.apiTokenInstance}
          onChange={handleChange('apiTokenInstance')}
          error={errors.apiTokenInstance}
        />
        <Input
          label="apiUrl"
          name="apiUrl"
          type="url"
          autoComplete="off"
          value={values.apiUrl}
          onChange={handleChange('apiUrl')}
          error={errors.apiUrl}
        />

        {signIn.isError && (
          <p className={styles.error} role="alert">
            {getSignInErrorMessage(signIn.error)}
          </p>
        )}

        <Button type="submit" disabled={signIn.isPending}>
          {signIn.isPending ? 'Входим…' : 'Войти'}
        </Button>
      </form>
    </main>
  );
}
