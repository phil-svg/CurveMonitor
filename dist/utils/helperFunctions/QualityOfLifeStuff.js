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
export function getCurrentTimeString() {
    const date = new Date();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    hours %= 12;
    hours = hours || 12;
    return `${hours}:${minutes < 10 ? "0" : ""}${minutes}${ampm}`;
}
//# sourceMappingURL=QualityOfLifeStuff.js.map