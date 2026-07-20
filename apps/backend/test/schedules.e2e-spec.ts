import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp, closeTestApp } from './helpers/app.helper';
import { cleanDatabase, disconnectDatabase } from './helpers/db.helper';
import { createUser, createAdmin } from './helpers/auth.helper';
import { createRoom } from './helpers/room.helper';
import { StatusEnum } from '@prisma/client';
import { futureWindow } from './helpers/utils/time.helper';

describe('Schedules (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        app = await bootstrapTestApp();
    });

    beforeEach(async () => {
        await cleanDatabase();
    });

    afterAll(async () => {
        await closeTestApp();
        await disconnectDatabase();
    });

    // ── helper to build a valid future time window ────────────────────


    // ── POST /schedules ───────────────────────────────────────────────

    describe('POST /schedules', () => {

        it('201 — user creates own schedule', async () => {
            const { tokens, userId } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const res = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'English Class A1', roomId: room.id, startTime, endTime })
                .expect(201);

            expect(res.body).toHaveProperty('id');
            expect(res.body.title).toBe('English Class A1');
            expect(res.body.userId).toBe(userId);
            expect(res.body.status).toBe(StatusEnum.APPROVED);
            expect(res.body.version).toBe(0);
        });

        it('201 — admin creates schedule', async () => {
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ title: 'Math Class B2', roomId: room.id, startTime, endTime })
                .expect(201);
        });

        it('400 — invalid time range (end before start)', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime } = futureWindow();
            const past = new Date(Date.now() - 1000).toISOString();

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Bad Time', roomId: room.id, startTime, endTime: past })
                .expect(400);
        });

        it('400 — time range in the past', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const start = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            const end = new Date(Date.now() - 46 * 60 * 60 * 1000).toISOString();

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Past Booking', roomId: room.id, startTime: start, endTime: end })
                .expect(400);
        });

        it('409 — overlapping booking on same room', async () => {
            const { tokens: userA } = await createUser(app);
            const { tokens: userB } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${userA.accessToken}`)
                .send({ title: 'First booking', roomId: room.id, startTime, endTime })
                .expect(201);

            const overlapStart = new Date(new Date(startTime).getTime() + 30 * 60 * 1000).toISOString();
            const overlapEnd = new Date(new Date(endTime).getTime() + 30 * 60 * 1000).toISOString();

            const res = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${userB.accessToken}`)
                .send({ title: 'Overlapping booking', roomId: room.id, startTime: overlapStart, endTime: overlapEnd })
                .expect(409);

            expect(res.body.message).toContain('already booked');
        });

        it('201 — adjacent bookings are allowed (end = start)', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'First slot', roomId: room.id, startTime, endTime })
                .expect(201);

            const nextEnd = new Date(new Date(endTime).getTime() + 2 * 60 * 60 * 1000).toISOString();

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Adjacent slot', roomId: room.id, startTime: endTime, endTime: nextEnd })
                .expect(201);
        });

        it('401 — no token', async () => {
            const { startTime, endTime } = futureWindow();

            await request(app.getHttpServer())
                .post('/schedules')
                .send({ title: 'No auth', roomId: 'some-uuid', startTime, endTime })
                .expect(401);
        });

        it('400 — missing required fields', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Missing fields' })
                .expect(400);
        });

    });

    // ── GET /schedules ────────────────────────────────────────────────

    describe('GET /schedules', () => {

        it('200 — user sees only own schedules', async () => {
            const { tokens: tokensA, userId: userIdA } = await createUser(app);
            const { tokens: tokensB } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokensA.accessToken}`)
                .send({ title: 'User A booking', roomId: room.id, startTime, endTime });

            const { startTime: s2, endTime: e2 } = futureWindow(48);
            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokensB.accessToken}`)
                .send({ title: 'User B booking', roomId: room.id, startTime: s2, endTime: e2 });

            const res = await request(app.getHttpServer())
                .get('/schedules')
                .set('Authorization', `Bearer ${tokensA.accessToken}`)
                .expect(200);

            expect(res.body).toHaveLength(1);
            expect(res.body[0].userId).toBe(userIdA);
        });

        it('200 — empty array when user has no schedules', async () => {
            const { tokens } = await createUser(app);

            const res = await request(app.getHttpServer())
                .get('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            expect(res.body).toEqual([]);
        });

        it('401 — no token', async () => {
            await request(app.getHttpServer())
                .get('/schedules')
                .expect(401);
        });

    });

    // ── GET /schedules/admin ──────────────────────────────────────────

    describe('GET /schedules/admin', () => {

        it('200 — admin sees all schedules from all users', async () => {
            const { tokens: tokensA } = await createUser(app);
            const { tokens: tokensB } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            const { startTime: s1, endTime: e1 } = futureWindow(24);
            const { startTime: s2, endTime: e2 } = futureWindow(48);

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokensA.accessToken}`)
                .send({ title: 'A booking', roomId: room.id, startTime: s1, endTime: e1 });

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokensB.accessToken}`)
                .send({ title: 'B booking', roomId: room.id, startTime: s2, endTime: e2 });

            const res = await request(app.getHttpServer())
                .get('/schedules/admin')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);

            expect(res.body).toHaveLength(2);
        });

        it('403 — non-admin cannot access', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .get('/schedules/admin')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(403);
        });

    });

    // ── GET /schedules/:id ─────────────────────────────────────────────

    describe('GET /schedules/:id', () => {

        it('302 — owner views own schedule', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'View test', roomId: room.id, startTime, endTime });

            const res = await request(app.getHttpServer())
                .get(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(302);

            expect(res.body.id).toBe(created.body.id);
        });

        it('302 — admin views any schedule', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Admin view test', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .get(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(302);
        });

        it('403 — user cannot view another users schedule', async () => {
            const { tokens: tokensA } = await createUser(app);
            const { tokens: tokensB } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokensA.accessToken}`)
                .send({ title: 'Private booking', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .get(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokensB.accessToken}`)
                .expect(403);
        });

        it('404 — schedule does not exist', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .get('/schedules/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(404);
        });

        it('400 — invalid UUID format', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .get('/schedules/not-a-uuid')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(400);
        });

    });

    // ── PATCH /schedules/:id — user (cancel only) ───────────────────────

    describe('PATCH /schedules/:id', () => {

        it('202 — user cancels own schedule', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'To cancel', roomId: room.id, startTime, endTime });
            const res = await request(app.getHttpServer())
                .patch(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ status: StatusEnum.CANCELLED, version: 0 })
                .expect(202);
            // console.log(`res:${JSON.stringify(res.body)}`);
            expect(res.body.status).toBe(StatusEnum.CANCELLED);
        });

        it('403 — user tries to set status to APPROVED', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Cannot self-approve', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .patch(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ status: StatusEnum.APPROVED, version: 0 })
                .expect(403);
        });

        it('403 — user cannot update another users schedule', async () => {
            const { tokens: tokensA } = await createUser(app);
            const { tokens: tokensB } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokensA.accessToken}`)
                .send({ title: 'Not yours', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .patch(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokensB.accessToken}`)
                .send({ status: StatusEnum.CANCELLED, version: 0 })
                .expect(403);
        });

        it('400 — stale version rejected', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Version test', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .patch(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ status: StatusEnum.CANCELLED, version: 99 })  // wrong version
                .expect(400);
        });

        it('409 — schedule already cancelled', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Double cancel', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .patch(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ status: StatusEnum.CANCELLED, version: 0 })
                .expect(202);

            await request(app.getHttpServer())
                .patch(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ status: StatusEnum.CANCELLED, version: 1 })
                .expect(409);
        });

    });

    // ── PATCH /schedules/admin/:id — admin approve/reject ───────────────

    describe('PATCH /schedules/admin/:id', () => {

        it('202 — admin approves schedule', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'To approve', roomId: room.id, startTime, endTime });

            const res = await request(app.getHttpServer())
                .patch(`/schedules/admin/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: StatusEnum.APPROVED, version: 0 })
                .expect(202);

            expect(res.body.status).toBe(StatusEnum.APPROVED);
            expect(res.body.version).toBe(1);
        });

        it('202 — admin rejects schedule', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'To reject', roomId: room.id, startTime, endTime });

            const res = await request(app.getHttpServer())
                .patch(`/schedules/admin/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: StatusEnum.REJECTED, version: 0 })
                .expect(202);

            expect(res.body.status).toBe(StatusEnum.REJECTED);
        });

        it('400 — admin cannot set status other than APPROVED/REJECTED', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Bad status', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .patch(`/schedules/admin/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: StatusEnum.CANCELLED, version: 0 })
                .expect(400);
        });

        it('400 — stale version on admin update', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Stale version', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .patch(`/schedules/admin/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: StatusEnum.APPROVED, version: 5 })
                .expect(400);
        });

        it('409 — admin reschedule conflicts with existing booking', async () => {
            const { tokens: tokensA } = await createUser(app,
                { name: 'User A', email: `userA-${Date.now()}@example.com`, password: 'Test1234!' }
            );
            const { tokens: tokensB } = await createUser(app,
                { name: 'User B', email: `userB-${Date.now()}@example.com`, password: 'Test1234!' }
            );
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            const { startTime: s1, endTime: e1 } = futureWindow(24);
            const { startTime: s2, endTime: e2 } = futureWindow(48);

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokensA.accessToken}`)
                .send({ title: 'Existing A', roomId: room.id, startTime: s1, endTime: e1 });

            const scheduleB = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokensB.accessToken}`)
                .send({ title: 'To reschedule', roomId: room.id, startTime: s2, endTime: e2 });
            // console.log(`scheduleA :${JSON.stringify(scheduleA.body)}`);
            // console.log(`scheduleB :${JSON.stringify(scheduleB.body)}`);
            // try to move B's schedule into A's time slot
            await request(app.getHttpServer())
                .patch(`/schedules/admin/${scheduleB.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ title: 'Updated admin B', startTime: s1, endTime: e1, version: 0 })
                .expect(409);
            // console.log(`updateSchedule:${updateSchedule.body}`);
            // updateSchedule.expect(409);
        });

        it('403 — non-admin cannot access admin update route', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Protected', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .patch(`/schedules/admin/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ status: StatusEnum.APPROVED, version: 0 })
                .expect(403);
        });

        it('409 — cannot update a cancelled schedule', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Will be cancelled', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .patch(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ status: StatusEnum.CANCELLED, version: 0 });

            await request(app.getHttpServer())
                .patch(`/schedules/admin/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: StatusEnum.APPROVED, version: 1 })
                .expect(409);
        });

    });

    // ── DELETE /schedules/permanent/:id ──────────────────────────────

    describe('DELETE /schedules/permanent/:id', () => {

        it('200 — admin hard deletes a cancelled schedule', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'To hard delete', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .patch(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ status: StatusEnum.CANCELLED, version: 0 });

            await request(app.getHttpServer())
                .delete(`/schedules/permanent/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);

            await request(app.getHttpServer())
                .get(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(404);
        });

        it('409 — cannot hard delete a non-cancelled schedule', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Still active', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .delete(`/schedules/permanent/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(409);
        });

        it('403 — non-admin cannot hard delete', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Protected delete', roomId: room.id, startTime, endTime });

            await request(app.getHttpServer())
                .delete(`/schedules/permanent/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(403);
        });

        it('404 — schedule does not exist', async () => {
            const admin = await createAdmin(app);

            await request(app.getHttpServer())
                .delete('/schedules/permanent/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(404);
        });

    });

    // ── Full schedule flow ────────────────────────────────────────────

    describe('Full schedule flow', () => {

        it('create → approve → cancel → hard delete', async () => {
            const { tokens } = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);
            const { startTime, endTime } = futureWindow();

            // 1 — create
            const created = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Full flow', roomId: room.id, startTime, endTime })
                .expect(201);

            expect(created.body.status).toBe(StatusEnum.APPROVED);

            // 2 — admin approves
            const approved = await request(app.getHttpServer())
                .patch(`/schedules/admin/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: StatusEnum.APPROVED, version: 0 })
                .expect(202);

            expect(approved.body.status).toBe(StatusEnum.APPROVED);

            // 3 — user cancels
            const cancelled = await request(app.getHttpServer())
                .patch(`/schedules/${created.body.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ status: StatusEnum.CANCELLED, version: 1 })
                .expect(202);

            expect(cancelled.body.status).toBe(StatusEnum.CANCELLED);

            // 4 — admin hard deletes
            await request(app.getHttpServer())
                .delete(`/schedules/permanent/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);
        });

    });

});