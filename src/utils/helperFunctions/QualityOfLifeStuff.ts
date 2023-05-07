import * as readline from 'readline';

export function updateConsoleOutput(message: string, yOffset: number = 0): void {
  readline.moveCursor(process.stdout, 0, yOffset);
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(message);
  readline.moveCursor(process.stdout, 0, -yOffset);
}

export function displayProgressBar(current: number, total: number): void {
  const length = 40;
  const ratio = current / total;
  const filled = Math.round(ratio * length);
  const empty = length - filled;

  const bar = `[${'#'.repeat(filled)}${'-'.repeat(empty)}]`;

  updateConsoleOutput(`Processing Pools: ${bar} ${current}/${total}`);
}
