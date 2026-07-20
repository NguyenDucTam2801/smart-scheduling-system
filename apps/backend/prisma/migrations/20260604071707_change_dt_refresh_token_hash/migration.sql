/*
  Warnings:

  - Made the column `refresh_token_hash` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "refresh_token_hash" SET NOT NULL;
