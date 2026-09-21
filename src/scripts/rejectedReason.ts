import prisma from "../config/prisma.js";

const addBookingRejectionReason = async () => {
  try {
    console.log("Adding rejectionReason column...");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Booking"
      ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
    `);

    console.log("✅ rejectionReason column added successfully.");
  } catch (error) {
    console.error("❌ Failed to add rejectionReason column:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
};

addBookingRejectionReason();