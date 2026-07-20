/*
  Warnings:

  - The values [REQUEST_RESULT] on the enum `notif_enum` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[refresh_token_hash]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "notif_enum_new" AS ENUM ('REQUEST_APPROVED', 'REQUEST_REJECTED', 'REQUEST_SUBMITTED', 'SCHEDULE_CREATED', 'SCHEDULE_DELETED', 'SCHEDULE_UPDATTED', 'ROOM_CREATED', 'ROOM_UPDATED', 'ROOM_DELETED', 'SYSTEM_ANNOUNCEMENT');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "notif_enum_new" USING ("type"::text::"notif_enum_new");
ALTER TYPE "notif_enum" RENAME TO "notif_enum_old";
ALTER TYPE "notif_enum_new" RENAME TO "notif_enum";
DROP TYPE "public"."notif_enum_old";
COMMIT;

-- CreateIndex
CREATE UNIQUE INDEX "users_refresh_token_hash_key" ON "users"("refresh_token_hash");
