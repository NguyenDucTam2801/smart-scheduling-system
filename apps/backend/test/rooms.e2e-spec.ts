import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp, closeTestApp } from './helpers/app.helper';
import { cleanDatabase, disconnectDatabase } from './helpers/db.helper';
import { createUser, createAdmin } from './helpers/auth.helper';
import { createRoom } from './helpers/room.helper';
import { futureWindow } from './helpers/utils/time.helper';

describe('Rooms (e2e)', () => {
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

    // ── POST /rooms ────────────────────────────────────────────────────

    describe('POST /rooms', () => {

        it('201 — admin creates room', async () => {
            const admin = await createAdmin(app);

            const res = await request(app.getHttpServer())
                .post('/rooms')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ name: 'Room A', capacity: 30, location: 'Floor 1' })
                .expect(201);

            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Room A');
            expect(res.body.capacity).toBe(30);
            expect(res.body.location).toBe('Floor 1');
            expect(res.body.isActive).toBe(true);
        });

        it('201 — room without optional location field', async () => {
            const admin = await createAdmin(app);

            const res = await request(app.getHttpServer())
                .post('/rooms')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ name: 'Room B', capacity: 20 })
                .expect(201);

            expect(res.body.name).toBe('Room B');
            expect(res.body.location).toBeNull();
        });

        it('409 — duplicate room name', async () => {
            const admin = await createAdmin(app);

            await request(app.getHttpServer())
                .post('/rooms')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ name: 'Room A', capacity: 30 });

            const res = await request(app.getHttpServer())
                .post('/rooms')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ name: 'Room A', capacity: 20 })
                .expect(409);

            expect(res.body.message).toContain('Room already exists');
        });

        it('403 — normal user cannot create room', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .post('/rooms')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ name: 'Room C', capacity: 10 })
                .expect(403);
        });

        it('401 — no token', async () => {
            await request(app.getHttpServer())
                .post('/rooms')
                .send({ name: 'Room D', capacity: 10 })
                .expect(401);
        });

        it('400 — missing name field', async () => {
            const admin = await createAdmin(app);

            await request(app.getHttpServer())
                .post('/rooms')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ capacity: 30 })
                .expect(400);
        });

        it('400 — missing capacity field', async () => {
            const admin = await createAdmin(app);

            await request(app.getHttpServer())
                .post('/rooms')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ name: 'Room E' })
                .expect(400);
        });

        it('400 — capacity must be positive integer', async () => {
            const admin = await createAdmin(app);

            await request(app.getHttpServer())
                .post('/rooms')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ name: 'Room F', capacity: -1 })
                .expect(400);
        });

    });

    // ── GET /rooms ─────────────────────────────────────────────────────

    describe('GET /rooms', () => {

        it('200 — returns all rooms for authenticated user', async () => {
            const admin = await createAdmin(app);
            const { tokens } = await createUser(app);

            await createRoom(app, admin.tokens.accessToken, { name: 'Room A' });
            await createRoom(app, admin.tokens.accessToken, { name: 'Room B' });

            const res = await request(app.getHttpServer())
                .get('/rooms')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            expect(res.body).toHaveLength(2);
        });

        it('200 — returns empty array when no rooms exist', async () => {
            const { tokens } = await createUser(app);

            const res = await request(app.getHttpServer())
                .get('/rooms')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            expect(res.body).toEqual([]);
        });

        it('200 — filter by isActive=true', async () => {
            const admin = await createAdmin(app);
            const { tokens } = await createUser(app);

            await createRoom(app, admin.tokens.accessToken, { name: 'Active Room' });
            const room2 = await createRoom(app, admin.tokens.accessToken, { name: 'To Deactivate' });

            // deactivate room2
            await request(app.getHttpServer())
                .patch(`/rooms/${room2.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ isActive: false });

            const res = await request(app.getHttpServer())
                .get('/rooms?isActive=true')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Active Room');
        });

        it('200 — filter by minCapacity', async () => {
            const admin = await createAdmin(app);
            const { tokens } = await createUser(app);

            await createRoom(app, admin.tokens.accessToken, { name: 'Small Room', capacity: 10 });
            await createRoom(app, admin.tokens.accessToken, { name: 'Large Room', capacity: 50 });

            const res = await request(app.getHttpServer())
                .get('/rooms?minCapacity=30')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Large Room');
        });

        it('404 — filter with no matching rooms throws', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .get('/rooms?name=NonExistentRoom')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(404);
        });

        it('401 — no token', async () => {
            await request(app.getHttpServer())
                .get('/rooms')
                .expect(401);
        });

    });

    // ── GET /rooms/:id ─────────────────────────────────────────────────

    describe('GET /rooms/:id', () => {

        it('200 — returns room for authenticated user', async () => {
            const admin = await createAdmin(app);
            const { tokens } = await createUser(app);
            const room = await createRoom(app, admin.tokens.accessToken, { name: 'Room A' });

            const res = await request(app.getHttpServer())
                .get(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            expect(res.body.id).toBe(room.id);
            expect(res.body.name).toBe('Room A');
        });

        it('404 — room does not exist', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .get('/rooms/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(404);
        });

        it('400 — invalid UUID format', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .get('/rooms/not-a-uuid')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(400);
        });

        it('401 — no token', async () => {
            await request(app.getHttpServer())
                .get('/rooms/00000000-0000-0000-0000-000000000000')
                .expect(401);
        });

    });

    // ── GET /rooms/admin/:id ───────────────────────────────────────────

    describe('GET /rooms/admin/:id', () => {

        it('200 — admin sees room with schedule count', async () => {
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken, { name: 'Audit Room' });

            const res = await request(app.getHttpServer())
                .get(`/rooms/admin/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);

            expect(res.body.id).toBe(room.id);
            expect(res.body).toHaveProperty('_count');
            expect(res.body._count).toHaveProperty('schedules');
        });

        it('403 — normal user cannot access audit route', async () => {
            const admin = await createAdmin(app);
            const { tokens } = await createUser(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            await request(app.getHttpServer())
                .get(`/rooms/admin/${room.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(403);
        });

        it('404 — room does not exist', async () => {
            const admin = await createAdmin(app);

            await request(app.getHttpServer())
                .get('/rooms/admin/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(404);
        });

    });

    // ── PATCH /rooms/:id ───────────────────────────────────────────────

    describe('PATCH /rooms/:id', () => {

        it('200 — admin updates room details', async () => {
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken, { name: 'Old Name' });

            const res = await request(app.getHttpServer())
                .patch(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ name: 'New Name', capacity: 50 })
                .expect(200);

            expect(res.body.name).toBe('New Name');
            expect(res.body.capacity).toBe(50);
        });

        it('200 — admin deactivates room', async () => {
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            const res = await request(app.getHttpServer())
                .patch(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ isActive: false })
                .expect(200);

            expect(res.body.isActive).toBe(false);
        });

        it('409 — cannot deactivate room with active schedules', async () => {
            const admin = await createAdmin(app);
            const { tokens } = await createUser(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            const { startTime: futureStart, endTime: futureEnd } = futureWindow(24, 2);

            // create an approved schedule for this room
            const schedule = await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Active booking', roomId: room.id, startTime: futureStart, endTime: futureEnd });

            await request(app.getHttpServer())
                .patch(`/schedules/admin/${schedule.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ status: 'APPROVED', version: 0 });

            const res = await request(app.getHttpServer())
                .patch(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ isActive: false })
                .expect(409);

            expect(res.body.message).toContain('Cannot deactivate a room with existing schedules.');
        });

        it('404 — room does not exist', async () => {
            const admin = await createAdmin(app);

            await request(app.getHttpServer())
                .patch('/rooms/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ capacity: 20 })
                .expect(404);
        });

        it('403 — normal user cannot update room', async () => {
            const admin = await createAdmin(app);
            const { tokens } = await createUser(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            await request(app.getHttpServer())
                .patch(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ capacity: 20 })
                .expect(403);
        });

        it('401 — no token', async () => {
            await request(app.getHttpServer())
                .patch('/rooms/00000000-0000-0000-0000-000000000000')
                .send({ capacity: 20 })
                .expect(401);
        });

    });

    // ── DELETE /rooms/permanent/:id ─────────────────────────────────────

    describe('DELETE /rooms/permanent/:id', () => {

        it('200 — admin hard deletes a deactivated room', async () => {
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            // deactivate first
            await request(app.getHttpServer())
                .patch(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ isActive: false });

            await request(app.getHttpServer())
                .delete(`/rooms/permanent/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);

            // verify it's gone
            await request(app.getHttpServer())
                .get(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(404);
        });

        it('400 — cannot hard delete an active room', async () => {
            const admin = await createAdmin(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            const res = await request(app.getHttpServer())
                .delete(`/rooms/permanent/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(400);

            expect(res.body.message).toContain('Deactivate the room');
        });

        it('409 — cannot delete deactivated room with existing schedules: Have schedule -> not deactive -> not delete permanent', async () => {
            const admin = await createAdmin(app);
            const { tokens } = await createUser(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const futureEnd = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

            // create schedule
            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Booked', roomId: room.id, startTime: futureStart, endTime: futureEnd });

            // deactivate room
            await request(app.getHttpServer())
                .patch(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ isActive: false });

            // try to delete — should fail because PENDING schedule still references it
            const res = await request(app.getHttpServer())
                .delete(`/rooms/permanent/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(400);

            expect(res.body.message).toContain('Deactivate the room before permanently deleting it.');
        });

        it('404 — room does not exist', async () => {
            const admin = await createAdmin(app);

            await request(app.getHttpServer())
                .delete('/rooms/permanent/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(404);
        });

        it('403 — normal user cannot hard delete', async () => {
            const admin = await createAdmin(app);
            const { tokens } = await createUser(app);
            const room = await createRoom(app, admin.tokens.accessToken);

            await request(app.getHttpServer())
                .patch(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ isActive: false });

            await request(app.getHttpServer())
                .delete(`/rooms/permanent/${room.id}`)
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(403);
        });

        it('400 — invalid UUID format', async () => {
            const admin = await createAdmin(app);

            await request(app.getHttpServer())
                .delete('/rooms/permanent/not-a-uuid')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(400);
        });

    });

    // ── Full room flow ─────────────────────────────────────────────────

    describe('Full room flow', () => {

        it('create → update → deactivate → hard delete', async () => {
            const admin = await createAdmin(app);

            // 1 — create
            const created = await request(app.getHttpServer())
                .post('/rooms')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ name: 'Flow Room', capacity: 20 })
                .expect(201);

            expect(created.body.isActive).toBe(true);

            // 2 — update details
            const updated = await request(app.getHttpServer())
                .patch(`/rooms/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ capacity: 40, location: 'Floor 3' })
                .expect(200);

            expect(updated.body.capacity).toBe(40);
            expect(updated.body.location).toBe('Floor 3');

            // 3 — deactivate
            const deactivated = await request(app.getHttpServer())
                .patch(`/rooms/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ isActive: false })
                .expect(200);

            expect(deactivated.body.isActive).toBe(false);

            // 4 — hard delete
            await request(app.getHttpServer())
                .delete(`/rooms/permanent/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);

            // 5 — verify gone
            await request(app.getHttpServer())
                .get(`/rooms/${created.body.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(404);
        });

        it('cannot deactivate → hard delete with active booking in between', async () => {
            const admin = await createAdmin(app);
            const { tokens } = await createUser(app);

            // 1 — create room
            const room = await createRoom(app, admin.tokens.accessToken, { name: 'Busy Room' });

            // 2 — user books it
            const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const futureEnd = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

            await request(app.getHttpServer())
                .post('/schedules')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .send({ title: 'Busy booking', roomId: room.id, startTime: futureStart, endTime: futureEnd });

            // 3 — cannot deactivate while booking exists
            await request(app.getHttpServer())
                .patch(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .send({ isActive: false })
                .expect(409);

            // 4 — room is still active
            const check = await request(app.getHttpServer())
                .get(`/rooms/${room.id}`)
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);

            expect(check.body.isActive).toBe(true);
        });

    });

});