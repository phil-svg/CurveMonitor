import { addMinutes, differenceInMinutes, format } from 'date-fns';
import * as readline from 'readline';
import { abiCache } from './MethodID.js';

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

  const bar = `[${'#'.repeat(filled)}${'-'.repeat(empty)}]`;

  updateConsoleOutput(`${infoText} ${bar} ${current}/${total}`);
}

export function getCurrentTimeString(): string {
  const date = new Date();
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';

  hours %= 12;
  hours = hours || 12;

  return `${hours}:${minutes < 10 ? '0' : ''}${minutes}${ampm}`;
}

// Log after every 50 fetches
export function logProgress(
  info: string,
  printStepInterval: number,
  fetchCount: number,
  totalTimeTaken: number,
  totalToBeFetched: number
) {
  if (fetchCount === 0) return;
  if (fetchCount % printStepInterval === 0) {
    const averageTimePerFetch = totalTimeTaken / fetchCount / 1000 / 60;
    const estimatedFinishTime = addMinutes(new Date(), averageTimePerFetch * (totalToBeFetched - fetchCount));
    const percentComplete = (fetchCount / totalToBeFetched) * 100;

    const finishTimeFormatted = format(estimatedFinishTime, 'EEE hh:mma');
    const timeToCompletion = differenceInMinutes(estimatedFinishTime, new Date());
    const hoursToCompletion = Math.floor(timeToCompletion / 60);
    const minutesToCompletion = (timeToCompletion % 60).toString().padStart(2, '0');

    console.log(
      `${percentComplete.toFixed(2)}% | ${fetchCount}/${totalToBeFetched} | ${finishTimeFormatted} | ${hoursToCompletion}h:${minutesToCompletion}min | ${info}`
    );
  }
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class RateLimiter {
  private maxCallsPerInterval: number;
  private interval: number;
  private callsThisInterval: number;
  private currentIntervalStartedAt: number;

  constructor(maxCallsPerInterval: number, interval: number) {
    this.maxCallsPerInterval = maxCallsPerInterval;
    this.interval = interval;
    this.callsThisInterval = 0;
    this.currentIntervalStartedAt = Date.now();
  }

  private resetInterval() {
    this.callsThisInterval = 0;
    this.currentIntervalStartedAt = Date.now();
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
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

export function clearAbiCache() {
  Object.keys(abiCache).forEach((key) => {
    delete abiCache[key];
  });
}

export function getCurrentFormattedTime(): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  const formattedHours = hours % 12 || 12; // Convert 24h to 12h format and handle midnight as 12 instead of 0
  const formattedMinutes = minutes < 10 ? '0' + minutes : minutes; // Add leading zero to minutes if needed
  return `${formattedHours}:${formattedMinutes}${ampm}`;
}

// Helper function to convert date strings to Unix time
export function convertDateToUnixTime(dateString: string): number {
  const date = new Date(dateString);
  return Math.floor(date.getTime() / 1000);
}

export function getElementCountChunkedForArrayAndChunksize(
  numbers: number[],
  chunkSize: number
): Record<string, number> {
  if (chunkSize <= 0) throw new Error('Chunk size must be greater than zero');

  // Sort the array
  const sortedNumbers = [...numbers].sort((a, b) => a - b);

  // Create an object to hold the counts
  const chunkCounts: Record<string, number> = {};

  // Initialize variables for the current chunk
  let currentChunkStart = Math.floor(sortedNumbers[0] / chunkSize) * chunkSize;
  let currentChunkEnd = currentChunkStart + chunkSize;
  let currentIndex = 0;

  // Iterate through the array and count the elements in each chunk
  while (currentIndex < sortedNumbers.length) {
    let count = 0;
    while (currentIndex < sortedNumbers.length && sortedNumbers[currentIndex] < currentChunkEnd) {
      count++;
      currentIndex++;
    }

    // Add the count to the chunkCounts object
    chunkCounts[`${currentChunkStart}-${currentChunkEnd}`] = count;

    // Move to the next chunk
    currentChunkStart = currentChunkEnd;
    currentChunkEnd += chunkSize;
  }

  return chunkCounts;
}

// Function to estimate the size of an object in MB
export function estimateSizeInMB(object: any): number {
  const jsonString = JSON.stringify(object);
  const bytes = new TextEncoder().encode(jsonString).length;
  return bytes / 1024 / 1024;
}

export function logMemoryUsage(message: string) {
  const memoryUsage = process.memoryUsage();
  // console.log(`Memory Usage:
  // RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB,
  // Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB,
  // Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB,
  // External: ${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(0)} MB (${message})`);
}
