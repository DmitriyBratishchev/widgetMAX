// PreToolUse (Bash): перед git commit проверяет staged .ts/.tsx/.js/.jsx на console.log.
// Exit 2 — блокирует коммит, сообщение уходит модели для исправления.
// Допустимо только обёрнутое в import.meta.env.DEV (rules.md §7).
const fs = require('fs');
const { execSync } = require('child_process');

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const command = input.tool_input?.command || '';

if (!/git\s[^|;&]*commit/.test(command)) process.exit(0);

let files = [];
try {
  files = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
    .trim().split('\n')
    .filter((f) => /\.(ts|tsx|js|jsx)$/.test(f))
    // Свои хуки — Node-скрипты, в бандл не попадают; правило адресовано коду в src/.
    .filter((f) => !f.startsWith('.claude/'));
} catch {
  process.exit(0); // не git-репозиторий или нет staged — не мешаем
}

const offenders = [];
for (const f of files) {
  let staged;
  try {
    // Содержимое берём из индекса, а не из рабочей копии: иначе правки после
    // `git add` дают ложный вердикт в обе стороны.
    staged = execSync(`git show :${JSON.stringify(f)}`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } catch {
    continue; // файл удалён из индекса или нечитаем
  }
  staged.split('\n').forEach((line, i) => {
    if (/console\.log\(/.test(line) && !/^\s*(\/\/|\*)/.test(line) && !/import\.meta\.env\.DEV/.test(line)) {
      offenders.push(`${f}:${i + 1}`);
    }
  });
}

if (offenders.length) {
  process.stderr.write(`BLOCKED: console.log в staged файлах — убери или оберни в if (import.meta.env.DEV):\n${offenders.join('\n')}\n`);
  process.exit(2);
}
process.exit(0);
