import request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function createRoom(
    app: INestApplication,
    adminToken: string,
    overrides: { name?: string; capacity?: number; location?: string } = {},
) {
    const name = overrides.name ?? `Room-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const capacity = overrides.capacity ?? 30;
    const location = overrides.location ?? 'Floor 1';
    const res = await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            name,
            capacity,
            location,
        });

    return res.body;
}