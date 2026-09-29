// Хост API определяется первыми 4 цифрами idInstance: 3100000000 → 3100.api.green-api.com
// (ресёрч max-chat §2.2).
export function suggestApiUrl(idInstance: string): string {
  const prefix = idInstance.trim().match(/^\d{4}/)?.[0];
  return prefix ? `https://${prefix}.api.green-api.com` : '';
}

export function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '');
}
