import {
    Injectable,
    OnModuleInit,
    OnModuleDestroy,
    Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private readonly CONNECT_TIMEOUT_MS = Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) || 5000;  // 5 seconds
    private readonly MAX_RETRIES = Number(process.env.DATABASE_MAX_RETRIES) || 3;

    constructor() {
        const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
        super({
            adapter: pool,
            log: [
                { emit: 'event', level: 'error' },
                { emit: 'stdout', level: 'warn' },
                { emit: 'stdout', level: 'info' },
                // { emit: 'stdout', level: 'query' },
            ],
        });
    }

    async onModuleInit() {
        await this.connectWithRetry();
    }

    async onModuleDestroy() {
        try {
            await this.$disconnect();
            this.logger.log('Database disconnected successfully');
        } catch (error) {
            this.logger.error('Error during database disconnection', error);
        }
    }

    // ── Connect with retry + timeout ───────────────────────────────────
    private async connectWithRetry(attempt = 1): Promise<void> {
        try {
            await this.connectWithTimeout();
            //health check
            await this.$queryRaw`SELECT 1`
            this.logger.log(`Database connected successfully`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Database connection attempt ${attempt}/${this.MAX_RETRIES} failed: ${message}`
            );

            if (attempt < this.MAX_RETRIES) {
                const delay = attempt * 2000; // 2s, 4s, 6s
                this.logger.log(`Retrying in ${delay / 1000}s...`);
                await this.sleep(delay);
                return this.connectWithRetry(attempt + 1);
            }

            // All retries exhausted — crash the app so Docker/PM2 can restart it
            this.logger.error('All connection attempts failed. Shutting down.');
            process.exit(1);
        }
    }

    // ── Wrap $connect with a timeout ──────────────────────────────────
    private async connectWithTimeout(): Promise<void> {
        const connectPromise = this.$connect();
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error(`Connection timed out after ${this.CONNECT_TIMEOUT_MS}ms`)),
                this.CONNECT_TIMEOUT_MS,
            ),
        );

        await Promise.race([connectPromise, timeoutPromise]);
    }

    // ── Health check — call this from a /health endpoint ─────────────
    async isHealthy(): Promise<boolean> {
        try {
            await this.$queryRaw`SELECT 1`;
            return true;
        } catch {
            return false;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}