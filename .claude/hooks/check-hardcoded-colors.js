// PostToolUse (Edit|Write): хардкод-цвета в .tsx/.ts/.scss/.css вне styles/tokens/
// (rules.md §8, золотое правило №4). Exit 2 — фидбек модели: использовать CSS Custom Properties.
const fs = require('fs');
const { changedLines } = require('./lib/changed-lines');

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const rawPath = input.tool_input?.file_path || '';
const filePath = rawPath.replace(/\\/g, '/');

if (!/\.(tsx|ts|scss|css)$/.test(filePath)) process.exit(0);
// Палитра живёт в styles/tokens/ — там литеральные значения легальны (это их определение).
if (/\/styles\/tokens\//.test(filePath)) process.exit(0);

let content = '';
try {
  content = fs.readFileSync(rawPath, 'utf8');
} catch {
  process.exit(0);
}

const hexColor = /#[0-9a-fA-F]{3,8}\b/;
const rawColorFn = /\b(rgba?|hsla?)\(\s*\d/; // rgba(255,...) — хардкод; rgba(var(--x),...) — допустимо

// Только новые/изменённые строки (null = новый файл, скан весь).
const touched = changedLines(rawPath);

const offenders = [];
content.split('\n').forEach((line, i) => {
  if (touched && !touched.has(i + 1)) return;
  if (/^\s*(\/\/|\/\*|\*)/.test(line)) return; // комментарии
  if (hexColor.test(line) || rawColorFn.test(line)) {
    offenders.push(`${filePath}:${i + 1}: ${line.trim().slice(0, 80)}`);
  }
});

if (offenders.length) {
  process.stderr.write(`FIX REQUIRED: хардкод-цвета вне styles/tokens/ — используй CSS Custom Properties (skill frontend-patterns §«Стили»):\n${offenders.join('\n')}\n`);
  process.exit(2);
}
process.exit(0);
