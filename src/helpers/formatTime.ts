const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

// Время сообщения в ленте: «ЧЧ:ММ» в часовом поясе браузера.
export function formatMessageTime(timestamp: number): string {
  return timeFormat.format(timestamp);
}
