-- AlterEnum
ALTER TYPE "OtpType" ADD VALUE 'EMAIL_VERIFICATION';

-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "email" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Otp_email_type_idx" ON "Otp"("email", "type");
