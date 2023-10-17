import { addMinutes, differenceInMinutes, format } from "date-fns";
import * as readline from "readline";
import { abiCache, methodIdCache } from "./MethodID.js";
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
// Log after every 50 fetches
export function logProgress(fetchCount, totalTimeTaken, totalToBeFetched) {
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
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export class RateLimiter {
    constructor(maxCallsPerInterval, interval) {
        this.maxCallsPerInterval = maxCallsPerInterval;
        this.interval = interval;
        this.callsThisInterval = 0;
        this.currentIntervalStartedAt = Date.now();
    }
    resetInterval() {
        this.callsThisInterval = 0;
        this.currentIntervalStartedAt = Date.now();
    }
    async call(fn) {
        if (Date.now() - this.currentIntervalStartedAt > this.interval) {
            this.resetInterval();
        }
        if (this.callsThisInterval >= this.maxCallsPerInterval) {
            await new Promise((resolve) => setTimeout(resolve, this.interval - (Date.now() - this.currentIntervalStartedAt)));
            this.resetInterval();
        }
        this.callsThisInterval++;
        return await fn();
    }
}
function clearMethodIdCache() {
    Object.keys(methodIdCache).forEach((key) => {
        delete methodIdCache[key];
    });
}
function clearAbiCache() {
    Object.keys(abiCache).forEach((key) => {
        delete abiCache[key];
    });
}
export function clearCaches() {
    clearMethodIdCache();
    clearAbiCache();
}
//# sourceMappingURL=QualityOfLifeStuff.js.map