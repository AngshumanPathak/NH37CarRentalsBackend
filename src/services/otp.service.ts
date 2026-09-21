import crypto from "crypto";
import prisma from "../config/prisma.js";
import { OtpType } from  "@prisma/client";

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;

const hashOtp = (otp: string) => {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
};

export const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const createOtp = async (
  phone: string,
  type: OtpType
) => {
  // Remove any previous OTP of the same type
  await prisma.otp.deleteMany({
    where: {
      phone,
      type,
    },
  });

  const otp = generateOtp();

  const codeHash = hashOtp(otp);

  const expiresAt = new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );

  const otpRecord = await prisma.otp.create({
    data: {
      phone,
      type,
      codeHash,
      expiresAt,
    },
  });

  return {
    otp,
    otpId: otpRecord.id,
    expiresAt,
  };
};

export const verifyOtp = async (
  otpId: string,
  otp: string
) => {
  const otpRecord = await prisma.otp.findUnique({
    where: {
      id: otpId,
    },
  });

  if (!otpRecord) {
    throw new Error("Invalid OTP request");
  }

  if (otpRecord.verifiedAt) {
    throw new Error("OTP has already been used");
  }

  if (otpRecord.expiresAt < new Date()) {
    throw new Error("OTP has expired");
  }

  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    throw new Error("Maximum OTP attempts exceeded");
  }

  const submittedOtpHash = hashOtp(otp);

  if (submittedOtpHash !== otpRecord.codeHash) {
    await prisma.otp.update({
      where: {
        id: otpId,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw new Error("Invalid OTP");
  }

  await prisma.otp.update({
    where: {
      id: otpId,
    },
    data: {
      verifiedAt: new Date(),
    },
  });

  return otpRecord;
};