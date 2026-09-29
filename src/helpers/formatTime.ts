const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

// Время сообщения в ленте: «ЧЧ:ММ» в часовом поясе браузера.
export function formatMessageTime(timestamp: number): string {
  return timeFormat.format(timestamp);
}

// Машиночитаемое время для атрибута dateTime у <time>: ISO 8601 в UTC.
export function formatIsoDateTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}
