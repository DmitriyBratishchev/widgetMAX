// PreToolUse (Bash): в коммитах проекта запрещён трейлер Co-Authored-By (rules.md §5).
// Дефолт харнесса — добавлять его; хук снимает конфликт детерминированно.
// Exit 2 — коммит блокируется, сообщение уходит модели.
const fs = require('fs');

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const command = input.tool_input?.command || '';

if (!/git\s[^|;&]*commit/.test(command)) process.exit(0);

const TRAILER = /co-authored-by\s*:/i;

// Сообщение может прийти инлайном (-m / heredoc) или файлом (-F/--file).
let found = TRAILER.test(command);

if (!found) {
  const fileArg = command.match(/(?:-F|--file[= ])\s*["']?([^\s"']+)/);
  if (fileArg) {
    try {
      found = TRAILER.test(fs.readFileSync(fileArg[1], 'utf8'));
    } catch { /* файла нет или он нечитаем — не мешаем коммиту */ }
  }
}

if (found) {
  process.stderr.write(
    'BLOCKED: трейлер Co-Authored-By запрещён в коммитах этого проекта (rules.md §5).\n' +
    'Убери строку Co-Authored-By из сообщения коммита и повтори.\n'
  );
  process.exit(2);
}
process.exit(0);
