import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp, closeTestApp } from './helpers/app.helper';
import { cleanDatabase, disconnectDatabase } from './helpers/db.helper';
import { createUser, createAdmin } from './helpers/auth.helper';

describe('Auth (e2e)', () => {
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

    // ── POST /auth/signup ────────────────────────────────────────────

    describe('POST /auth/signup', () => {

        it('201 — registers new user with empty body', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/signup')
                .send({ name: 'Tâm', email: 'tam@example.com', password: 'Test1234!' })
                .expect(201);

            // register() returns void — no tokens in response
            expect(res.body).toEqual({});
        });

        it('201 — user can login after signup', async () => {
            await request(app.getHttpServer())
                .post('/auth/signup')
                .send({ name: 'Tâm', email: 'tam@example.com', password: 'Test1234!' })
                .expect(201);

            // verify the user actually exists by logging in
            const loginRes = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'tam@example.com', password: 'Test1234!' })
                .expect(200);

            expect(loginRes.body).toHaveProperty('accessToken');
        });

        it('400 — duplicate email', async () => {
            const dto = { name: 'Tâm', email: 'tam@example.com', password: 'Test1234!' };

            await request(app.getHttpServer()).post('/auth/signup').send(dto);

            const res = await request(app.getHttpServer())
                .post('/auth/signup')
                .send(dto)
                .expect(400);

            expect(res.body.message).toBe('Email already registered');
        });

        it('400 — missing name field', async () => {
            await request(app.getHttpServer())
                .post('/auth/signup')
                .send({ email: 'tam@example.com', password: 'Test1234!' })
                .expect(400);
        });

        it('400 — missing email field', async () => {
            await request(app.getHttpServer())
                .post('/auth/signup')
                .send({ name: 'Tâm', password: 'Test1234!' })
                .expect(400);
        });

        it('400 — missing password field', async () => {
            await request(app.getHttpServer())
                .post('/auth/signup')
                .send({ name: 'Tâm', email: 'tam@example.com' })
                .expect(400);
        });

        it('400 — invalid email format', async () => {
            await request(app.getHttpServer())
                .post('/auth/signup')
                .send({ name: 'Tâm', email: 'not-an-email', password: 'Test1234!' })
                .expect(400);
        });

        it('400 — extra unknown field rejected (whitelist)', async () => {
            await request(app.getHttpServer())
                .post('/auth/signup')
                .send({
                    name: 'Tâm', email: 'tam@example.com', password: 'Test1234!',
                    role: 'ADMIN',  // should never be accepted from client
                })
                .expect(400);
        });

    });

    // ── POST /auth/login ─────────────────────────────────────────────

    describe('POST /auth/login', () => {

        beforeEach(async () => {
            await request(app.getHttpServer())
                .post('/auth/signup')
                .send({ name: 'Tâm', email: 'tam@example.com', password: 'Test1234!' });
        });

        it('200 — returns accessToken and refreshToken', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'tam@example.com', password: 'Test1234!' })
                .expect(200);

            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
            expect(typeof res.body.accessToken).toBe('string');
            expect(typeof res.body.refreshToken).toBe('string');
        });

        it('401 — wrong password', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'tam@example.com', password: 'WrongPass!' })
                .expect(401);

            expect(res.body.message).toBe('Invalid Credentials');
        });

        it('401 — email not found', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'ghost@example.com', password: 'Test1234!' })
                .expect(401);

            expect(res.body.message).toBe('Invalid Credentials');
        });

        it('400 — missing email', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ password: 'Test1234!' })
                .expect(400);
        });

        it('400 — missing password', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'tam@example.com' })
                .expect(400);
        });

    });

    // ── GET /auth/user ───────────────────────────────────────────────

    describe('GET /auth/user', () => {

        it('200 — returns JWT payload with valid token', async () => {
            const { tokens } = await createUser(app, { email: 'tam@example.com' });

            const res = await request(app.getHttpServer())
                .get('/auth/user')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('sub');
            expect(res.body).toHaveProperty('email', 'tam@example.com');
            expect(res.body).toHaveProperty('role', 'USER');
        });

        it('401 — no token provided', async () => {
            await request(app.getHttpServer())
                .get('/auth/user')
                .expect(401);
        });

        it('401 — malformed token', async () => {
            await request(app.getHttpServer())
                .get('/auth/user')
                .set('Authorization', 'Bearer not-a-real-token')
                .expect(401);
        });

        it('401 — missing Bearer prefix', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .get('/auth/user')
                .set('Authorization', tokens.accessToken)  // no "Bearer " prefix
                .expect(401);
        });

    });

    // ── GET /auth/refresh ────────────────────────────────────────────

    describe('GET /auth/refresh', () => {

        it('200 — returns new tokens with valid refresh token', async () => {
            const { tokens } = await createUser(app);

            const res = await request(app.getHttpServer())
                .get('/auth/refresh')
                .set('Authorization', `Bearer ${tokens.refreshToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
        });

        it('200 — new accessToken works on protected route', async () => {
            const { tokens } = await createUser(app);

            const refreshRes = await request(app.getHttpServer())
                .get('/auth/refresh')
                .set('Authorization', `Bearer ${tokens.refreshToken}`)
                .expect(200);

            const newAccessToken = refreshRes.body.accessToken;

            await request(app.getHttpServer())
                .get('/auth/user')
                .set('Authorization', `Bearer ${newAccessToken}`)
                .expect(200);
        });

        it('401 — access token used as refresh token (wrong secret)', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .get('/auth/refresh')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(401);
        });

        it('401 — no token provided', async () => {
            await request(app.getHttpServer())
                .get('/auth/refresh')
                .expect(401);
        });

        it('401 — garbage token string', async () => {
            await request(app.getHttpServer())
                .get('/auth/refresh')
                .set('Authorization', 'Bearer garbage.token.string')
                .expect(401);
        });

    });

    // ── POST /auth/logout ────────────────────────────────────────────

    describe('POST /auth/logout', () => {

        it('200 — logs out and invalidates refresh token', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .post('/auth/logout')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            // old refresh token must now fail
            await request(app.getHttpServer())
                .get('/auth/refresh')
                .set('Authorization', `Bearer ${tokens.refreshToken}`)
                .expect(401);
        });

        it('200 — access token still works after logout (only refresh invalidated)', async () => {
            const { tokens } = await createUser(app);

            await request(app.getHttpServer())
                .post('/auth/logout')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            // access token is stateless JWT — still valid until expiry
            await request(app.getHttpServer())
                .get('/auth/user')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);
        });

        it('401 — logout without token', async () => {
            await request(app.getHttpServer())
                .post('/auth/logout')
                .expect(401);
        });

        it('user can login again after logout', async () => {
            const { email } = await createUser(app, { email: 'tam@example.com' });
            const { tokens } = await createUser(app, { email });

            await request(app.getHttpServer())
                .post('/auth/logout')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password: 'Test1234!' })
                .expect(200);
        });

    });

    // ── PATCH /auth/promote-admin ────────────────────────────────────

    describe('PATCH /auth/promote-admin', () => {

        it('200 — promotes USER to ADMIN', async () => {
            const { userId } = await createUser(app);
            // console.log(`userId:${userId}, secretKey: ${process.env.ADMIN_SECRET_KEY}`);
            const res = await request(app.getHttpServer())
                .patch('/auth/promote-admin')
                .send({
                    userId,
                    targetRole: 'ADMIN',
                    secretKey: process.env.ADMIN_SECRET_KEY,
                })
                .expect(200);

            expect(res.body).toHaveProperty('id', userId);
            expect(res.body).toHaveProperty('role', 'ADMIN');
        });

        it('200 — promotes USER to SUPERADMIN', async () => {
            const { userId } = await createUser(app);

            const res = await request(app.getHttpServer())
                .patch('/auth/promote-admin')
                .send({
                    userId,
                    targetRole: 'SUPERADMIN',
                    secretKey: process.env.SUPER_ADMIN_SECRET_KEY,
                })
                .expect(200);

            expect(res.body.role).toBe('SUPERADMIN');
        });

        it('ADMIN role appears in JWT after re-login', async () => {
            const admin = await createAdmin(app);

            const res = await request(app.getHttpServer())
                .get('/auth/user')
                .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
                .expect(200);

            expect(res.body.role).toBe('ADMIN');
        });

        it('401 — wrong secret key for ADMIN', async () => {
            const { userId } = await createUser(app);

            const res = await request(app.getHttpServer())
                .patch('/auth/promote-admin')
                .send({ userId, targetRole: 'ADMIN', secretKey: 'wrong-secret' })
                .expect(401);

            expect(res.body.message).toBe('Invalid secret key');
        });

        it('401 — ADMIN secret used for SUPERADMIN target (cross-secret rejected)', async () => {
            const { userId } = await createUser(app);

            await request(app.getHttpServer())
                .patch('/auth/promote-admin')
                .send({
                    userId,
                    targetRole: 'SUPERADMIN',
                    secretKey: process.env.ADMIN_SECRET_KEY, // wrong secret for this target
                })
                .expect(401);
        });

        it('400 — targetRole USER is blocked', async () => {
            const { userId } = await createUser(app);

            const res = await request(app.getHttpServer())
                .patch('/auth/promote-admin')
                .send({
                    userId,
                    targetRole: 'USER',
                    secretKey: process.env.ADMIN_SECRET_KEY,
                })
                .expect(400);

            expect(res.body.message).toBe('Target role cannot be USER');
        });

        it('400 — invalid targetRole string', async () => {
            await request(app.getHttpServer())
                .patch('/auth/promote-admin')
                .send({
                    userId: '00000000-0000-0000-0000-000000000000',
                    targetRole: 'INVALID_ROLE',
                    secretKey: process.env.ADMIN_SECRET_KEY,
                })
                .expect(400);
        });

        it('400 — missing userId field', async () => {
            await request(app.getHttpServer())
                .patch('/auth/promote-admin')
                .send({
                    targetRole: 'ADMIN',
                    secretKey: process.env.ADMIN_SECRET_KEY,
                })
                .expect(400);
        });

        it('404 — user does not exist', async () => {
            const res = await request(app.getHttpServer())
                .patch('/auth/promote-admin')
                .send({
                    userId: '00000000-0000-0000-0000-000000000000',
                    targetRole: 'ADMIN',
                    secretKey: process.env.ADMIN_SECRET_KEY,
                })
                .expect(404);

            expect(res.body.message).toBe('User not found');
        });

    });

    // ── Full auth flow integration ────────────────────────────────────

    describe('Full auth flow', () => {

        it('signup → login → get user → refresh → logout → refresh fails', async () => {
            const email = 'flow-test@example.com';
            const password = 'Test1234!';

            // 1 — signup
            await request(app.getHttpServer())
                .post('/auth/signup')
                .send({ name: 'Flow Test', email, password })
                .expect(201);

            // 2 — login
            const loginRes = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password })
                .expect(200);

            const { accessToken, refreshToken } = loginRes.body;

            // 3 — get user
            const userRes = await request(app.getHttpServer())
                .get('/auth/user')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(userRes.body.email).toBe(email);

            // 4 — refresh
            const refreshRes = await request(app.getHttpServer())
                .get('/auth/refresh')
                .set('Authorization', `Bearer ${refreshToken}`)
                .expect(200);

            const newAccessToken = refreshRes.body.accessToken;

            // 5 — logout
            await request(app.getHttpServer())
                .post('/auth/logout')
                .set('Authorization', `Bearer ${newAccessToken}`)
                .expect(200);

            // 6 — old refresh token now fails
            await request(app.getHttpServer())
                .get('/auth/refresh')
                .set('Authorization', `Bearer ${refreshToken}`)
                .expect(401);
        });

    });

});