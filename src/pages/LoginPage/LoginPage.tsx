import { useState, type ChangeEvent, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { suggestApiUrl } from '@/helpers/apiUrl';
import { validateCredentials, type CredentialsErrors } from '@/helpers/credentialsValidation';
import { getSignInErrorMessage } from '@/helpers/signInError';
import { useSignIn } from '@/hooks/useSignIn';
import type { GreenApiCredentials } from '@/types/greenApi';
import styles from './LoginPage.module.scss';

const EMPTY_VALUES: GreenApiCredentials = { idInstance: '', apiTokenInstance: '', apiUrl: '' };

export function LoginPage() {
  const signIn = useSignIn();
  const [values, setValues] = useState<GreenApiCredentials>(EMPTY_VALUES);
  const [errors, setErrors] = useState<CredentialsErrors>({});
  // Пока пользователь не правил apiUrl сам, поле следует за idInstance (ресёрч max-chat §3 Р3).
  const [isApiUrlEdited, setIsApiUrlEdited] = useState(false);

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
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) signIn.mutate(values);
  };

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.title}>widgetMAX</h1>
        <p className={styles.subtitle}>
          Войдите данными инстанса MAX из{' '}
          <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
            личного кабинета GREEN-API
          </a>
        </p>

        <Input
          label="idInstance"
          inputMode="numeric"
          autoComplete="off"
          value={values.idInstance}
          onChange={handleChange('idInstance')}
          error={errors.idInstance}
        />
        <Input
          label="apiTokenInstance"
          type="password"
          autoComplete="off"
          value={values.apiTokenInstance}
          onChange={handleChange('apiTokenInstance')}
          error={errors.apiTokenInstance}
        />
        <Input
          label="apiUrl"
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
