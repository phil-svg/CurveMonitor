import { DurationType, IntervalInput } from '../../Interfaces.js';
import { VolumeData } from './AggregatedMevVolume.js';
import moment from 'moment-timezone';

interface BaseUnits {
  [key: string]: number;
  second: number;
  seconds: number;
  minute: number;
  minutes: number;
  hour: number;
  hours: number;
  day: number;
  days: number;
  week: number;
  weeks: number;
  month: number;
  months: number;
  year: number;
  years: number;
}

export function secondsPerUnit(unit: string): number {
  const base: BaseUnits = {
    second: 1,
    seconds: 1,
    minute: 60,
    minutes: 60,
    hour: 60 * 60,
    hours: 60 * 60,
    day: 24 * 60 * 60,
    days: 24 * 60 * 60,
    week: 7 * 24 * 60 * 60,
    weeks: 7 * 24 * 60 * 60,
    month: 30 * 24 * 60 * 60,
    months: 30 * 24 * 60 * 60,
    year: 365.25 * 24 * 60 * 60,
    years: 365.25 * 24 * 60 * 60,
  };

  return base[unit] || 0;
}

export interface TransactionCountData {
  interval_start: Date;
  transaction_count: number;
}

export function determineSqlInterval(intervalInput: IntervalInput): string {
  if (typeof intervalInput === 'string' && intervalInput === 'max') {
    throw new Error('Max interval is not supported yet');
  }

  const { value, unit } = intervalInput as DurationType;
  const unitMapping: Record<string, string> = {
    minute: 'minutes',
    minutes: 'minutes',
    hour: 'hours',
    hours: 'hours',
    day: 'days',
    days: 'days',
    week: 'weeks',
    weeks: 'weeks',
    month: 'months',
    months: 'months',
    year: 'years',
    years: 'years',
    full: 'century',
  };

  const interval = unitMapping[unit];
  return `${value} ${interval}`;
}

// hardcoded to max 10k entries.
export function createIntervalBlueprint(
  startUnixtime: number,
  endUnixtime: number,
  interval: string,
  timeZone: string = 'UTC'
): VolumeData[] {
  const blueprint: VolumeData[] = [];

  moment.updateLocale('en', {
    week: {
      dow: 1, // Monday is the first day of the week.
    },
  });
  let currentTime = moment(startUnixtime * 1000).tz(timeZone);

  const endTime = moment(endUnixtime * 1000).tz(timeZone);

  const [count, unit] = interval.split(' ');
  const durationUnit = unit as moment.unitOfTime.DurationConstructor;

  let safetyThing = 0;
  while (true) {
    safetyThing++;
    const startOfInterval = currentTime.clone().startOf(durationUnit);

    if (startOfInterval > endTime) {
      break;
    }

    if (safetyThing > 10000) {
      break;
    }

    blueprint.push({
      interval_start: startOfInterval.toDate(),
      interval_start_unixtime: startOfInterval.unix(),
      total_volume: 0,
    });

    currentTime.add(parseInt(count), durationUnit);
  }

  return blueprint;
}

export function mergeData(blueprint: VolumeData[], sqlData: VolumeData[]): VolumeData[] {
  let mergedData: VolumeData[] = blueprint;
  for (const sqlEntry of sqlData) {
    for (let i = 0; i < blueprint.length; i++) {
      const cell = blueprint[i];
      if (!blueprint[i + 1] && sqlEntry.interval_start_unixtime >= cell.interval_start_unixtime) {
        cell.total_volume += sqlEntry.total_volume;
      } else if (
        sqlEntry.interval_start_unixtime >= cell.interval_start_unixtime &&
        sqlEntry.interval_start_unixtime < blueprint[i + 1].interval_start_unixtime
      ) {
        cell.total_volume += sqlEntry.total_volume;
      }
    }
  }
  return mergedData;
}
