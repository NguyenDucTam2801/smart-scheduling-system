import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    // datasources: {
    //     db: { url: process.env.DATABASE_URL },
    // },
    adapter: new (require('@prisma/adapter-pg').PrismaPg)({ connectionString: process.env.DATABASE_URL }),
});

export async function cleanDatabase(): Promise<void> {
    // Delete in correct FK order
    await prisma.$transaction([
        prisma.notification.deleteMany(),
        prisma.changeRequest.deleteMany(),
        prisma.schedule.deleteMany(),
        prisma.room.deleteMany(),
        prisma.user.deleteMany(),
    ]);
}

export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
}

export { prisma };