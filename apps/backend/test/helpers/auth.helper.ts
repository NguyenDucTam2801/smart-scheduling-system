import request from 'supertest';
import { INestApplication } from '@nestjs/common';

export interface TestTokens {
    accessToken: string;
    refreshToken: string;
}

export interface TestUser {
    tokens: TestTokens;
    userId: string;
    email: string;
}

// Register + login in one call — returns tokens + userId
export async function createUser(
    app: INestApplication,
    overrides: { name?: string; email?: string; password?: string } = {},
): Promise<TestUser> {
    const name = overrides.name ?? 'Test User';
    const email = overrides.email ?? `user-${Date.now()}@example.com`;
    const password = overrides.password ?? 'Test1234!';

    await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ name, email, password });

    const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });

    const userInfo = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    // console.log(`userInfo: ${JSON.stringify(userInfo.body)}`);
    return {
        tokens: {
            accessToken: loginRes.body.accessToken,
            refreshToken: loginRes.body.refreshToken,
        },
        userId: userInfo.body.sub ?? '',
        email,
    };
}

// Create user then promote to ADMIN
export async function createAdmin(
    app: INestApplication,
    overrides: { email?: string } = {},
): Promise<TestUser> {
    const user = await createUser(app, {
        name: 'Admin User',
        email: overrides.email ?? `admin-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
        .patch('/auth/promote-admin')
        .send({
            userId: user.userId,
            targetRole: 'ADMIN',
            secretKey: process.env.ADMIN_SECRET_KEY,
        });

    // Re-login to get token with ADMIN role in JWT
    const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'Test1234!' });

    return {
        ...user,
        tokens: {
            accessToken: loginRes.body.accessToken,
            refreshToken: loginRes.body.refreshToken,
        },
    };
}

// Create user then promote to SUPERADMIN
export async function createSuperAdmin(
    app: INestApplication,
): Promise<TestUser> {
    const user = await createUser(app, {
        name: 'SuperAdmin User',
        email: `superadmin-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
        .patch('/auth/promote-admin')
        .send({
            userId: user.userId,
            targetRole: 'SUPERADMIN',
            secretKey: process.env.SUPER_ADMIN_SECRET_KEY,
        });

    const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'Test1234!' });

    return {
        ...user,
        tokens: {
            accessToken: loginRes.body.accessToken,
            refreshToken: loginRes.body.refreshToken,
        },
    };
}