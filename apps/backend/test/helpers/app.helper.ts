import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

let app: INestApplication;

export async function bootstrapTestApp(): Promise<INestApplication> {
    if (app) return app;

    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));

    await app.init();
    return app;
}

export async function closeTestApp(): Promise<void> {
    if (app) {
        await app.close();
        app = undefined as any;
    }
}