import { addMinutes, differenceInMinutes, format } from "date-fns";
import * as readline from "readline";

export function updateConsoleOutput(message: string, yOffset: number = 0): void {
  readline.moveCursor(process.stdout, 0, yOffset);
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(message);
  readline.moveCursor(process.stdout, 0, -yOffset);
}

export function displayProgressBar(infoText: string, current: number, total: number): void {
  const length = 40;
  const ratio = current / total;
  const filled = Math.round(ratio * length);
  const empty = Math.max(0, length - filled);

  const bar = `[${"#".repeat(filled)}${"-".repeat(empty)}]`;

  updateConsoleOutput(`${infoText} ${bar} ${current}/${total}`);
}

export function getCurrentTimeString(): string {
  const date = new Date();
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";

  hours %= 12;
  hours = hours || 12;

  return `${hours}:${minutes < 10 ? "0" : ""}${minutes}${ampm}`;
}

// Log after every 50 fetches
export function logProgress(fetchCount: number, totalTimeTaken: number, totalToBeFetched: number) {
  if (fetchCount % 50 === 0) {
    const averageTimePerFetch = totalTimeTaken / fetchCount / 1000 / 60;
    const estimatedFinishTime = addMinutes(new Date(), averageTimePerFetch * (totalToBeFetched - fetchCount));
    const percentComplete = (fetchCount / totalToBeFetched) * 100;

    const finishTimeFormatted = format(estimatedFinishTime, "EEE hh:mma");
    const timeToCompletion = differenceInMinutes(estimatedFinishTime, new Date());
    const hoursToCompletion = Math.floor(timeToCompletion / 60);
    const minutesToCompletion = timeToCompletion % 60;

    console.log(`${percentComplete.toFixed(2)}% | ${fetchCount}/${totalToBeFetched} | ${finishTimeFormatted} | ${hoursToCompletion}h:${minutesToCompletion}min`);
  }
}
