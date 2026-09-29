// PreToolUse (Bash): блокирует команды, которые безвозвратно сносят незакоммиченную работу,
// историю или файлы. Такие операции выполняет пользователь сам.
// Операции с remote (включая форс-пуш) здесь не описаны: их целиком закрывает личный хук
// Димы `~/.claude/hooks/block-remote-git.js`.
// Exit 2 — вызов блокируется, stderr уходит модели.
//
// Принцип паттернов: описываем ВЫЗОВ, а не упоминание строки. `grep "reset --hard"` проходит,
// `git reset --hard` — нет.
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const command = (input.tool_input?.command || '').replace(/[\r\n\t]+/g, ' ');

// Одиночный поиск по коду — не операция. Любой из `;&|` снимает послабление,
// и команда проверяется правилами целиком (закрывает `grep x && rm -rf y`).
const isPlainSearch = /^\s*(git\s+grep|grep|egrep|fgrep|rg|ag|ack|find)\b/.test(command)
  && !/[;&|]/.test(command);
if (isPlainSearch) process.exit(0);

const rules = [
  // ─── Git: потеря незакоммиченного и переписывание истории ────────────
  { re: /\bgit\s+reset\s+--hard\b/i,
    label: 'git reset --hard — отбрасывает незакоммиченное и коммиты' },
  // Точечный `git checkout -- <файл>` разрешён; блокируем снос всего дерева
  { re: /\bgit\s+(checkout|restore)\b[^|;&]*?(\s--)?\s(\.|:\/|\*)\s*$/i,
    label: 'git checkout/restore всего дерева — снос всех незакоммиченных правок' },
  { re: /\bgit\s+clean\b[^|;&]*-[a-zA-Z]*f/i,
    label: 'git clean -f — удаление untracked-файлов (там может быть работа)' },
  // Без флага `i`: `-D` (force) блокируем, безопасный `-d` (только merged) — нет
  { re: /\bgit\s+branch\s+(-D|--delete\s+--force)\b/,
    label: 'git branch -D — принудительное удаление ветки без проверки merged' },
  { re: /\bgit\s+stash\s+(drop|clear)\b/i,
    label: 'git stash drop/clear — безвозвратная потеря отложенной работы' },
  { re: /\bgit\s+(filter-branch|filter-repo)\b/i,
    label: 'git filter-branch/filter-repo — переписывание всей истории' },

  // ─── Файловая система ────────────────────────────────────────────────
  { re: /(^|[\s;&|])rm\s+(-[a-zA-Z]*[rR][a-zA-Z]*[fF]|-[a-zA-Z]*[fF][a-zA-Z]*[rR])\b/,
    label: 'rm -rf — рекурсивное безоговорочное удаление' },
];

for (const { re, label } of rules) {
  if (re.test(command)) {
    process.stderr.write(
      `BLOCKED: ${label}\n` +
      'Такие команды выполняет пользователь сам — спроси разрешение и объясни, ЧТО именно\n' +
      'будет уничтожено и зачем. Не обходи блокировку и не ищи обходной путь.\n' +
      'Обычный аналог: `git restore <файл>` (точечно).\n'
    );
    process.exit(2);
  }
}
process.exit(0);
