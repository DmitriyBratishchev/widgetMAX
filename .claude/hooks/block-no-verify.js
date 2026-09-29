// PreToolUse (Bash): блокирует git-команды с --no-verify.
// Exit 2 — Claude Code блокирует вызов и показывает stderr модели.
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const command = input.tool_input?.command || '';

if (/git\s[^|;&]*--no-verify/.test(command) || command.includes('--no-verify')) {
  process.stderr.write('BLOCKED: --no-verify запрещён. Хуки git должны выполняться — почини причину, а не обходи проверку.\n');
  process.exit(2);
}
process.exit(0);
