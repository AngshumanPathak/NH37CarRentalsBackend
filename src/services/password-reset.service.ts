import crypto from "crypto";
import prisma from "../config/prisma.js";

export const createPasswordResetToken = async (
  userId: string
) => {
  // Delete previous reset tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: {
      userId,
    },
  });

  // Generate secure random token
  const token = crypto
    .randomBytes(32)
    .toString("hex");

  // Token expires in 10 minutes
  const expiresAt = new Date(
    Date.now() + 10 * 60 * 1000
  );

  await prisma.passwordResetToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
};

export const verifyPasswordResetToken = async (
  token: string
) => {
  const tokenRecord =
    await prisma.passwordResetToken.findUnique({
      where: {
        token,
      },
    });

  if (!tokenRecord) {
    throw new Error("Invalid reset token");
  }

  if (tokenRecord.expiresAt < new Date()) {
    // Remove expired token
    await prisma.passwordResetToken.delete({
      where: {
        id: tokenRecord.id,
      },
    });

    throw new Error("Reset token has expired");
  }

  return tokenRecord;
};