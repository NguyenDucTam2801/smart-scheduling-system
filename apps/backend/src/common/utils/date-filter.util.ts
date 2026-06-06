import dayjs from 'dayjs';
import { CalendarView } from 'src/schedules/dto/query-schedule.dto';

export interface PrismaTimeFilter {
    startTime?: { gte: Date };
    endTime?: { lte: Date };
}

/**
 * Helper filter startDate/endTIme for prisma based on date and view
 */
export function buildPrismaTimeFilter(
    date?: string | Date,
    view?: CalendarView,
): PrismaTimeFilter {
    if (!date || !view) return {};

    const anchor = dayjs(date);

    const ranges = {
        day: { start: anchor.startOf('day'), end: anchor.endOf('day') },
        week: { start: anchor.startOf('week'), end: anchor.endOf('week') },
        month: { start: anchor.startOf('month'), end: anchor.endOf('month') },
    };

    const range = ranges[view];
    if (!range) return {};

    return {
        startTime: { gte: range.start.toDate() },
        endTime: { lte: range.end.toDate() },
    };
}