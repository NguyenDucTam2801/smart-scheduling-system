/*
  Warnings:

  - The values [SCHEDULE_APPROVED,SCHEDULE_REJECTED,SCHEDULE_MODIFIED,SCHEDULE_REQUEST_RESULT] on the enum `notif_enum` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "notif_enum_new" AS ENUM ('REQUEST_APPROVED', 'REQUEST_REJECTED', 'SCHEDULE_CREATED', 'SCHEDULE_CANCELLED', 'SCHEDULE_UPDATTED', 'REQUEST_RESULT', 'REQUEST_SUBMITTED', 'SYSTEM_ANNOUNCEMENT', 'ROOM_CREATED', 'ROOM_UPDATED', 'ROOM_CANCLED');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "notif_enum_new" USING ("type"::text::"notif_enum_new");
ALTER TYPE "notif_enum" RENAME TO "notif_enum_old";
ALTER TYPE "notif_enum_new" RENAME TO "notif_enum";
DROP TYPE "public"."notif_enum_old";
COMMIT;
