import { normalizeApiUrl } from '@/helpers/apiUrl';
import type { GreenApiCredentials } from '@/types/greenApi';

export type CredentialsErrors = Partial<Record<keyof GreenApiCredentials, string>>;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateCredentials(values: GreenApiCredentials): CredentialsErrors {
  const errors: CredentialsErrors = {};
  const idInstance = values.idInstance.trim();
  const apiUrl = values.apiUrl.trim();

  if (!idInstance) errors.idInstance = 'Введите idInstance';
  else if (!/^\d+$/.test(idInstance)) errors.idInstance = 'idInstance состоит только из цифр';

  if (!values.apiTokenInstance.trim()) errors.apiTokenInstance = 'Введите apiTokenInstance';

  if (!apiUrl) errors.apiUrl = 'Введите apiUrl';
  else if (!isHttpsUrl(apiUrl)) errors.apiUrl = 'apiUrl должен начинаться с https://';

  return errors;
}

export function normalizeCredentials(values: GreenApiCredentials): GreenApiCredentials {
  return {
    idInstance: values.idInstance.trim(),
    apiTokenInstance: values.apiTokenInstance.trim(),
    apiUrl: normalizeApiUrl(values.apiUrl),
  };
}
