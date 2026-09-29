// PostToolUse (Edit|Write): ищет захардкоженные секреты в только что изменённом файле.
// Главный секрет проекта — apiTokenInstance GREEN-API (rules.md §6).
// Exit 2 — фидбек модели: секрет нужно убрать немедленно.
const fs = require('fs');
const { changedLines } = require('./lib/changed-lines');

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const rawPath = input.tool_input?.file_path || '';
const filePath = rawPath.replace(/\\/g, '/');

// Документация, локи, картинки и зависимости не проверяем. `.env*` проверяем:
// переменные VITE_* вшиваются в бандл, токену там не место.
if (
  !filePath ||
  /\.(md|txt|lock|svg|png|jpg|jpeg)$/.test(filePath) ||
  /\/node_modules\//.test(filePath)
) {
  process.exit(0);
}

let content = '';
try {
  content = fs.readFileSync(rawPath, 'utf8');
} catch {
  process.exit(0);
}

// Плейсхолдеры и фейки в тестах — не секрет.
const safeLine = /example|placeholder|changeme|your-|xxx|test-token|fake|mock/i;

// Ключ = литерал длиннее 8 символов. `apiTokenInstance` называем явно: общий `token`
// его не ловит — после слова идёт `Instance`, а не разделитель.
const keyValueSecret = /(api[_-]?token[_-]?instance|api[_-]?key|api[_-]?secret|secret[_-]?key|password|token|secret)\s*["']?\s*(=|:)\s*["'][A-Za-z0-9+/=_-]{8,}["']/i;
// Формат ключа GREEN-API — 50 hex-символов (пример из документации:
// d75b3a66374942c5b3c019c698abc2067e151558acbd451234).
const greenApiToken = /\b[0-9a-f]{50}\b/i;

// Только новые/изменённые строки (null = новый файл, скан весь).
const touched = changedLines(rawPath);

const offenders = [];
content.split('\n').forEach((line, i) => {
  if (touched && !touched.has(i + 1)) return;
  if (safeLine.test(line)) return;
  if (keyValueSecret.test(line) || greenApiToken.test(line)) {
    offenders.push(`${filePath}:${i + 1}`);
  }
});

if (offenders.length) {
  process.stderr.write(`FIX REQUIRED: возможный захардкоженный секрет — учётные данные GREEN-API вводит пользователь в UI, в коде/.env им не место:\n${offenders.join('\n')}\n`);
  process.exit(2);
}
process.exit(0);
