-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "encryptionVersion",
DROP COLUMN "passwordHash",
DROP COLUMN "recoveryCode",
DROP COLUMN "totpKey";

-- DropTable
DROP TABLE "sessions";
