function parseDuration(input) {
    if (typeof input === 'string') {
        // Updated regex to include an option for "full" as a standalone match
        const match = input.match(/(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)|^full$/i);
        if (match) {
            if (match[0].toLowerCase() === 'full') {
                return { value: 1, unit: 'full' };
            }
            const value = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();
            return { value, unit };
        }
        throw new Error('Invalid duration string format');
    }
    return input;
}
export function getTimeframeTimestamp(durationInput) {
    const now = Math.floor(Date.now() / 1000); // Convert milliseconds to seconds
    const duration = parseDuration(durationInput);
    if (duration.unit === 'full') {
        return 0; // Return earliest possible timestamp for "full" history
    }
    const unitSeconds = {
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
        year: 365 * 24 * 60 * 60,
        years: 365 * 24 * 60 * 60,
    };
    const durationInSeconds = duration.value * unitSeconds[duration.unit];
    return now - durationInSeconds;
}
//# sourceMappingURL=Timeframes.js.map