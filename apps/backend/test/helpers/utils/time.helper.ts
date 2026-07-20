export const futureWindow = (offsetHours = 24, durationHours = 2) => {
    const start = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
};