/*
  Warnings:

  - You are about to drop the column `pricePerDay` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `pricePerHour` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `securityDeposit` on the `Car` table. All the data in the column will be lost.
  - Added the required column `pricePerDaySelfDrive` to the `Car` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pricePerDayWithDriver` to the `Car` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RentalType" AS ENUM ('SELF_DRIVE', 'WITH_DRIVER');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "rentalType" "RentalType" NOT NULL DEFAULT 'SELF_DRIVE';

-- AlterTable
ALTER TABLE "Car" DROP COLUMN "pricePerDay",
DROP COLUMN "pricePerHour",
DROP COLUMN "securityDeposit",
ADD COLUMN     "pricePerDaySelfDrive" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "pricePerDayWithDriver" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "pricePerHourSelfDrive" DECIMAL(10,2),
ADD COLUMN     "pricePerHourWithDriver" DECIMAL(10,2),
ADD COLUMN     "securityDepositSelfDrive" DECIMAL(10,2),
ADD COLUMN     "securityDepositWithDriver" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "Booking_rentalType_idx" ON "Booking"("rentalType");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");
