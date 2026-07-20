import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp, closeTestApp } from './helpers/app.helper';
import { cleanDatabase, disconnectDatabase } from './helpers/db.helper';

describe('App (e2e)', () => {
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

  it('GET / → 200 Hello World', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

});