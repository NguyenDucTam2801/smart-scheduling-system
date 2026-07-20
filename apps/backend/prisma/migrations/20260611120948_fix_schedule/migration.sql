/*
  Warnings:

  - The values [PENDING,CONFLICT] on the enum `status_enum` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `updated_at` to the `change_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notif_enum" ADD VALUE 'SCHEDULE_CANCELLED';
ALTER TYPE "notif_enum" ADD VALUE 'SYSTEM_ANNOUNCEMENT';

-- AlterEnum
ALTER TYPE "role_enum" ADD VALUE 'SUPERADMIN';

-- AlterEnum
BEGIN;
CREATE TYPE "status_enum_new" AS ENUM ('APPROVED', 'FINISHED', 'REJECTED', 'CANCELLED');
ALTER TABLE "public"."schedules" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "schedules" ALTER COLUMN "status" TYPE "status_enum_new" USING ("status"::text::"status_enum_new");
ALTER TYPE "status_enum" RENAME TO "status_enum_old";
ALTER TYPE "status_enum_new" RENAME TO "status_enum";
DROP TYPE "public"."status_enum_old";
ALTER TABLE "schedules" ALTER COLUMN "status" SET DEFAULT 'APPROVED';
COMMIT;

-- AlterTable
ALTER TABLE "change_requests" ADD COLUMN     "updated_at" TIMESTAMP NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "rooms" ALTER COLUMN "capacity" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "schedules" ALTER COLUMN "status" SET DEFAULT 'APPROVED';
