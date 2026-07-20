import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { futureWindow } from './utils/time.helper';

export async function createSchedule(
    app: INestApplication,
    userToken: string,
    roomId: string,
    overrides: { title?: string; offsetHours?: number; durationHours?: number } = {},
) {
    const offsetHours = overrides.offsetHours ?? 24;
    const durationHours = overrides.durationHours ?? 2;
    const title = overrides.title ?? `Schedule-${Date.now()}`;

    const { startTime, endTime } = futureWindow(offsetHours, durationHours);

    const res = await request(app.getHttpServer())
        .post('/schedules')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
            title,
            roomId,
            startTime: startTime,
            endTime: endTime,
        });

    return res.body;
}

export async function approveSchedule(
    app: INestApplication,
    adminToken: string,
    scheduleId: string,
    version = 0,
) {
    const res = await request(app.getHttpServer())
        .patch(`/schedules/admin/${scheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED', version });

    return res.body;
}