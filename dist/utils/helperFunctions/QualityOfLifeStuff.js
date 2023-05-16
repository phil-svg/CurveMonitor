import * as readline from "readline";
export function updateConsoleOutput(message, yOffset = 0) {
    readline.moveCursor(process.stdout, 0, yOffset);
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(message);
    readline.moveCursor(process.stdout, 0, -yOffset);
}
export function displayProgressBar(infoText, current, total) {
    const length = 40;
    const ratio = current / total;
    const filled = Math.round(ratio * length);
    const empty = Math.max(0, length - filled);
    const bar = `[${"#".repeat(filled)}${"-".repeat(empty)}]`;
    updateConsoleOutput(`${infoText} ${bar} ${current}/${total}`);
}
//# sourceMappingURL=QualityOfLifeStuff.js.map