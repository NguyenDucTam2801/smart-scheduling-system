import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

// common/database/transaction-manager.service.ts
@Injectable()
export class TransactionManager {
    constructor(private readonly prisma: PrismaService) { }

    // Hàm này nhận vào một callback chứa toàn bộ các lệnh cần chạy trong transaction
    async runInTransaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
        return this.prisma.$transaction(async (tx) => {
            return await work(tx);
        });
    }
}