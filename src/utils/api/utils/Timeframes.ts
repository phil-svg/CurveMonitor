export const getTimeframeTimestamp = (duration: string): number => {
  const now = Math.floor(Date.now() / 1000); // Convert milliseconds to seconds
  switch (duration) {
    case "1 day":
      return now - 24 * 60 * 60;
    case "1 week":
      return now - 7 * 24 * 60 * 60;
    case "1 month":
      return now - 30 * 24 * 60 * 60;
    case "full":
    default:
      return 0; // Return earliest possible timestamp for "full" history
  }
};
