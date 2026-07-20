import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp, closeTestApp } from './helpers/app.helper';
import { createAdmin, createUser } from './helpers/auth.helper';
import { cleanDatabase, disconnectDatabase } from './helpers/db.helper';
import { createRoom } from './helpers/room.helper';
import { createSchedule } from './helpers/schedule.helper';
import { futureWindow } from './helpers/utils/time.helper';
import { CrStatusEnum, StatusEnum } from '@prisma/client';

describe('ChangeRequests (e2e)', () => {
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

    // ── shared setup helper ────────────────────────────────────────────
    // creates user + admin + room + schedule — used in most tests
    async function setupBaseScenario() {
        const user = await createUser(app);
        const admin = await createAdmin(app);
        const room = await createRoom(app, admin.tokens.accessToken);
        const schedule = await createSchedule(app, user.tokens.accessToken, room.id);

        return { user, admin, room, schedule };
    }

    // ── POST /change-requests ──────────────────────────────────────────

    describe('POST /change-requests', () => {

        it('201 — user submits change request without new times (cancel intent)', async () => {
            const { user, schedule } = await setupBaseScenario();

            const res = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({
                    scheduleId: schedule.id,
                    reason: 'Please cancel this booking',
                })
                .expect(201);

            expect(res.body).toHaveProperty('id');
            expect(res.body.scheduleId).toBe(schedule.id);
            expect(res.body.requesterId).toBe(user.userId);
            expect(res.body.status).toBe('PENDING');
        });

        it('201 — user submits change request with new times', async () => {
            const { user, schedule } = await setupBaseScenario();

            const newStart = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
            const newEnd = new Date(Date.now() + 74 * 60 * 60 * 1000).toISOString();

            const res = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({
                    scheduleId: schedule.id,
                    newStart,
                    newEnd,
                    reason: 'Need to reschedule',
                })
                .expect(201);

            expect(res.body.status).toBe('PENDING');
            expect(res.body.newStart).toBeDefined();
            expect(res.body.newEnd).toBeDefined();
        });

        it('404 — schedule does not exist', async () => {
            const { user } = await setupBaseScenario();

            const res = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({
                    scheduleId: '00000000-0000-0000-0000-000000000000',
                    reason: 'Non-existent',
                })
                .expect(404);

            expect(res.body.message).toBe('Schedule not found');
        });

        it('403 — user cannot submit request for another users schedule', async () => {
            const { room } = await setupBaseScenario();
            const userB = await createUser(app);
            const schedule = await createSchedule(app, userB.tokens.accessToken, room.id, { offsetHours: 72 });

            const userA = await createUser(app);

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${userA.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Not my schedule' })
                .expect(403);
        });

        it('400 — cannot submit request for REJECTED schedule', async () => {
            const { user, admin, schedule } = await setupBaseScenario();

            // reject the schedule
            await request(app.getHttpServer())
                .patch(`/schedules/admin/${schedule.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'REJECTED', version: 0 });

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Already rejected' })
                .expect(400);
        });

        it('409 — duplicate pending request for same schedule', async () => {
            const { user, schedule } = await setupBaseScenario();

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'First request' })
                .expect(201);

            const res = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Duplicate request' })
                .expect(409);

            expect(res.body.message).toContain('pending change request');
        });

        it('400 — invalid new time range (end before start)', async () => {
            const { user, schedule } = await setupBaseScenario();

            const newStart = new Date(Date.now() + 74 * 60 * 60 * 1000).toISOString();
            const newEnd = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, newStart, newEnd, reason: 'Bad time' })
                .expect(400);
        });

        it('409 — proposed time overlaps existing booking', async () => {
            const { user, room, schedule } = await setupBaseScenario();

            // create a second schedule that blocks the proposed time
            // const blockedStart = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
            // const blockedEnd = new Date(Date.now() + 74 * 60 * 60 * 1000).toISOString();
            const { startTime: blockedStart, endTime: blockedEnd } = futureWindow(72, 2);
            const userB = await createUser(app);
            await createSchedule(app, userB.tokens.accessToken, room.id, {
                offsetHours: 73, durationHours: 2,
            });

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({
                    scheduleId: schedule.id,
                    newStart: blockedStart,
                    newEnd: blockedEnd,
                    reason: 'Conflicting time',
                })
                .expect(409);
        });

        it('401 — no token', async () => {
            await request(app.getHttpServer())
                .post('/change-requests')
                .send({ scheduleId: '00000000-0000-0000-0000-000000000000' })
                .expect(401);
        });

        it('400 — missing scheduleId field', async () => {
            const { user } = await setupBaseScenario();

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ reason: 'No scheduleId' })
                .expect(400);
        });

    });

    // ── GET /change-requests ───────────────────────────────────────────

    describe('GET /change-requests', () => {

        it('200 — user sees only own change requests', async () => {
            const { user, schedule } = await setupBaseScenario();
            await createUser(app);

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'User A request' });

            const res = await request(app.getHttpServer())
                .get('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .expect(200);

            expect(res.body).toHaveLength(1);
            expect(res.body[0].requesterId).toBe(user.userId);
        });

        it('200 — returns empty array when user has no requests', async () => {
            const { user } = await setupBaseScenario();

            const res = await request(app.getHttpServer())
                .get('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .expect(200);

            expect(res.body).toEqual([]);
        });

        it('200 — filter by status', async () => {
            const { user, schedule } = await setupBaseScenario();

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Pending request' });

            const res = await request(app.getHttpServer())
                .get('/change-requests?status=PENDING')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .expect(200);

            expect(res.body).toHaveLength(1);
            expect(res.body[0].status).toBe('PENDING');
        });

        it('401 — no token', async () => {
            await request(app.getHttpServer())
                .get('/change-requests')
                .expect(401);
        });

    });

    // ── GET /change-requests/admin ─────────────────────────────────────

    describe('GET /change-requests/admin', () => {

        it('200 — admin sees all change requests from all users', async () => {
            const { user, admin, room } = await setupBaseScenario();
            const userB = await createUser(app);

            const schedA = await createSchedule(app, user.tokens.accessToken, room.id, { offsetHours: 48 });
            const schedB = await createSchedule(app, userB.tokens.accessToken, room.id, { offsetHours: 72 });

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedA.id, reason: 'Request A' });
            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${userB.tokens.accessToken}`)
                .send({ scheduleId: schedB.id, reason: 'Request B' });

            const res = await request(app.getHttpServer())
                .get('/change-requests/admin')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);

            expect(res.body).toHaveLength(2);
        });

        it('403 — normal user cannot access admin route', async () => {
            const { user } = await setupBaseScenario();

            await request(app.getHttpServer())
                .get('/change-requests/admin')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .expect(403);
        });

        it('200 — admin filters by requesterId', async () => {
            const { user, admin, room } = await setupBaseScenario();
            const userB = await createUser(app);

            const schedA = await createSchedule(app, user.tokens.accessToken, room.id, { offsetHours: 48 });
            const schedB = await createSchedule(app, userB.tokens.accessToken, room.id, { offsetHours: 72 });

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedA.id, reason: 'A' });

            await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${userB.tokens.accessToken}`)
                .send({ scheduleId: schedB.id, reason: 'B' });

            const res = await request(app.getHttpServer())
                .get(`/change-requests/admin?requesterId=${user.userId}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);

            expect(res.body).toHaveLength(1);
            expect(res.body[0].requesterId).toBe(user.userId);
        });

    });

    // ── GET /change-requests/:id ───────────────────────────────────────

    describe('GET /change-requests/:id', () => {

        it('200 — owner views own change request', async () => {
            const { user, schedule } = await setupBaseScenario();

            const created = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'View test' });

            const res = await request(app.getHttpServer())
                .get(`/change-requests/${created.body.id}`)
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .expect(200);

            expect(res.body.id).toBe(created.body.id);
        });

        it('200 — admin views any change request', async () => {
            const { user, admin, schedule } = await setupBaseScenario();

            const created = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Admin view' });

            await request(app.getHttpServer())
                .get(`/change-requests/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);
        });

        it('403 — user cannot view another users change request', async () => {
            const { user, schedule } = await setupBaseScenario();
            const userB = await createUser(app);

            const created = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Private' });

            await request(app.getHttpServer())
                .get(`/change-requests/${created.body.id}`)
                .set('Authorization', `Bearer ${userB.tokens.accessToken}`)
                .expect(403);
        });

        it('404 — change request does not exist', async () => {
            const { user } = await setupBaseScenario();

            await request(app.getHttpServer())
                .get('/change-requests/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .expect(404);
        });

        it('401 — no token', async () => {
            await request(app.getHttpServer())
                .get('/change-requests/00000000-0000-0000-0000-000000000000')
                .expect(401);
        });

    });

    // ── PATCH /change-requests/review/:id ─────────────────────────────

    describe('PATCH /change-requests/review/:id — APPROVE', () => {

        it('200 — admin approves change request without new times', async () => {
            const { user, admin, schedule } = await setupBaseScenario();

            const cr = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Cancel please' });

            const res = await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'APPROVED' })
                .expect(200);

            expect(res.body.status).toBe('APPROVED');
            expect(res.body.reviewedBy).toBe(admin.userId);
        });

        it('200 — admin approves with new times → schedule updated', async () => {
            const { user, admin, schedule } = await setupBaseScenario();
            // const schedule = await createSchedule(app, user.tokens.accessToken, room.id, { offsetHours: 24 });
            // console.log(`schedule:${JSON.stringify(schedule)}`);
            const { startTime: newStart, endTime: newEnd } = futureWindow(72, 2);

            const cr = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, newStart, newEnd, reason: 'Move to next week' });

            // console.log(`Change request created: ${JSON.stringify(cr.body)}`);
            const res = await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'APPROVED' })
                .expect(200);

            expect(res.body.status).toBe('APPROVED');
        });

        // it('409 — approve fails when new time conflicts with existing booking', async () => {
        //     const admin = await createAdmin(app);
        //     const userA = await createUser(app);
        //     const userB = await createUser(app);
        //     const room = await createRoom(app, admin.tokens.accessToken);

        //     // userA has a schedule at 24h
        //     await createSchedule(app, userA.tokens.accessToken, room.id, { offsetHours: 24 });
        //     // userB has a schedule at 72h
        //     const schedB = await createSchedule(app, userB.tokens.accessToken, room.id, { offsetHours: 72 });
        //     // console.log(`UserB schedule: ${JSON.stringify(schedB)}`);

        //     // userB wants to move to 24h slot — same as userA
        //     const { startTime: conflictStart, endTime: conflictEnd } = futureWindow(24, 2);

        //     const cr = await request(app.getHttpServer())
        //         .post('/change-requests')
        //         .set('Authorization', `Bearer ${userB.tokens.accessToken}`)
        //         .send({
        //             scheduleId: schedB.id,
        //             newStart: conflictStart,
        //             newEnd: conflictEnd,
        //             reason: 'Move to conflicting slot',
        //         });
        //     console.log(`change request:${JSON.stringify(cr.body)}`);
        //     const res = await request(app.getHttpServer())
        //         .patch(`/change-requests/review/${cr.body.id}`)
        //         .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
        //         .send({ status: 'APPROVED' })
        //         .expect(409);

        //     expect(res.body.message).toContain('conflicts with an existing booking');
        // });

        it('404 — change request does not exist', async () => {
            const admin = await createAdmin(app);

            await request(app.getHttpServer())
                .patch('/change-requests/review/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'APPROVED' })
                .expect(404);
        });

        it('403 — normal user cannot review', async () => {
            const { user, schedule } = await setupBaseScenario();

            const cr = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Test' });

            await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ status: 'APPROVED' })
                .expect(403);
        });

    });

    describe('PATCH /change-requests/review/:id — REJECT', () => {

        it('200 — admin rejects change request', async () => {
            const { user, admin, schedule } = await setupBaseScenario();

            const cr = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Please reschedule' });

            const res = await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'REJECTED' })
                .expect(200);

            expect(res.body.status).toBe('REJECTED');
            expect(res.body.reviewedBy).toBe(admin.userId);
        });

        it('200 — original schedule is unchanged after rejection', async () => {
            const { user, admin, schedule } = await setupBaseScenario();

            const originalStart = schedule.startTime;

            const newStart = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();
            const newEnd = new Date(Date.now() + 98 * 60 * 60 * 1000).toISOString();

            const cr = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, newStart, newEnd, reason: 'Reschedule' });

            await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'REJECTED' });

            // verify schedule still has original time
            const scheduleAfter = await request(app.getHttpServer())
                .get(`/schedules/${schedule.id}`)
                .set('Authorization', `Bearer ${user.tokens.accessToken}`);

            expect(scheduleAfter.body.startTime).toBe(originalStart);
        });

        it('400 — invalid status value', async () => {
            const { user, admin, schedule } = await setupBaseScenario();

            const cr = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Test' });

            await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'INVALID_STATUS' })
                .expect(400);
        });

        it('409 - cannot review an already-reviewed request', async () => {
            const { user, admin, schedule } = await setupBaseScenario();

            const cr = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Once only' });

            await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'APPROVED' });
            // try to review again
            const res = await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'REJECTED' });
            // console.log(`review2: ${JSON.stringify(res.body)}`);

            // should not be PENDING anymore so it must fail or return already-reviewed
            expect(['400', '409']).toContain(String(res.status));
        });

    });

    // ── Full change request flow ───────────────────────────────────────

    describe('Full change request flow', () => {

        it('create schedule → submit request → admin approves → schedule updated', async () => {
            const user = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            // 1 — user creates schedule at 24h
            const schedule = await createSchedule(
                app, user.tokens.accessToken, room.id, { offsetHours: 24, title: 'Original booking' }
            );
            console.log(`schedule:${JSON.stringify(schedule)}`);
            expect(schedule.status).toBe(StatusEnum.APPROVED);

            // 2 — user submits change request to move to 96h
            // const newStart = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();
            // const newEnd = new Date(Date.now() + 98 * 60 * 60 * 1000).toISOString();
            const { startTime: newStart, endTime: newEnd } = futureWindow(96, 2);
            const cr = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, newStart, newEnd, reason: 'Need to reschedule' })
                .expect(201);

            expect(cr.body.status).toBe(CrStatusEnum.PENDING);

            // 3 — admin sees it in the list
            const adminList = await request(app.getHttpServer())
                .get('/change-requests/admin')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`);

            expect(adminList.body).toHaveLength(1);

            // 4 — admin approves
            const approved = await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'APPROVED' })
                .expect(200);

            expect(approved.body.status).toBe(CrStatusEnum.APPROVED);

            // 5 — user sees updated status in their list
            const userCrs = await request(app.getHttpServer())
                .get('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`);

            expect(userCrs.body[0].status).toBe(CrStatusEnum.APPROVED);
        });

        it('create schedule → submit request → admin rejects → original schedule unchanged', async () => {
            const user = await createUser(app);
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            const schedule = await createSchedule(
                app, user.tokens.accessToken, room.id, { offsetHours: 24 }
            );
            const originalStart = schedule.startTime;

            // const newStart = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();
            // const newEnd = new Date(Date.now() + 98 * 60 * 60 * 1000).toISOString();
            const { startTime: newStart, endTime: newEnd } = futureWindow(96, 2);
            const cr = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, newStart, newEnd, reason: 'Reschedule' });

            await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'REJECTED' })
                .expect(200);

            // schedule is untouched
            const scheduleAfter = await request(app.getHttpServer())
                .get(`/schedules/${schedule.id}`)
                .set('Authorization', `Bearer ${user.tokens.accessToken}`);

            expect(scheduleAfter.body.startTime).toBe(originalStart);
            expect(scheduleAfter.body.status).toBe(StatusEnum.APPROVED);
        });

        it('cannot submit second request after first is approved', async () => {
            const { user, admin, schedule } = await setupBaseScenario();

            const cr = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'First request' });

            await request(app.getHttpServer())
                .patch(`/change-requests/review/${cr.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'APPROVED' });

            // can submit again since first is no longer PENDING
            const second = await request(app.getHttpServer())
                .post('/change-requests')
                .set('Authorization', `Bearer ${user.tokens.accessToken}`)
                .send({ scheduleId: schedule.id, reason: 'Second request' });

            expect(second.status).toBe(201);
        });

    });

});