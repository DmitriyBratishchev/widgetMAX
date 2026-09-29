// Хелпер для PostToolUse-хуков: какие строки файла отличаются от HEAD.
//
// Зачем: хук, сканирующий файл целиком, блокирует правку одной корректной строки
// в легаси-файле, где нарушения были до нас. Это мешает правилу «заменять при
// касании файла» и создаёт ложные блокировки.
const { execSync } = require('child_process');
const path = require('path');

/**
 * @param {string} filePath абсолютный путь к файлу
 * @returns {Set<number>|null} 1-based номера новых/изменённых строк;
 *                             null — «проверять весь файл» (новый файл или не git)
 */
function changedLines(filePath) {
  const abs = filePath.replace(/\\/g, '/');
  const opts = { cwd: path.dirname(filePath), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

  try {
    // Файл вне git (untracked/новый) — нарушения целиком наши, скан полный.
    execSync(`git ls-files --error-unmatch "${abs}"`, opts);
  } catch {
    return null;
  }

  let diff;
  try {
    // HEAD, а не индекс: ловим и застейдженные, и незастейдженные правки.
    diff = execSync(`git diff HEAD -U0 --no-color -- "${abs}"`, opts);
  } catch {
    return null;
  }

  const lines = new Set();
  for (const hunk of diff.split('\n')) {
    // @@ -12,3 +12,4 @@  → новые строки 12..15
    const m = hunk.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!m) continue;
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    for (let i = 0; i < count; i++) lines.add(start + i);
  }
  return lines;
}

module.exports = { changedLines };
