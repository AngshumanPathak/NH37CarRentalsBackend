/*
  Warnings:

  - Added the required column `customerEmail` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerName` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerPhone` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pricePerDay` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rentalAmount` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rentalDays` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rentalHours` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "customerEmail" TEXT NOT NULL,
ADD COLUMN     "customerName" TEXT NOT NULL,
ADD COLUMN     "customerPhone" TEXT NOT NULL,
ADD COLUMN     "pricePerDay" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "pricePerHour" DECIMAL(10,2),
ADD COLUMN     "rentalAmount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "rentalDays" INTEGER NOT NULL,
ADD COLUMN     "rentalHours" INTEGER NOT NULL;
