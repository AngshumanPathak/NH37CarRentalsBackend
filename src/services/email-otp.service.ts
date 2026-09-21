import crypto from "crypto";
import prisma from "../config/prisma.js";
import { sendEmail } from "./email.service.js";
import { OtpType } from "@prisma/client";

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const hashOtp = (otp: string) => {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
};

export const sendEmailVerificationOtp = async (
  email: string
) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.emailVerifiedAt) {
    throw new Error("Email is already verified");
  }

  // Remove previous email verification OTPs
  await prisma.otp.deleteMany({
    where: {
      type: "EMAIL_VERIFICATION",
      // We don't have email in Otp, so we'll handle this below
    },
  });

  const otp = generateOtp();
  const codeHash = hashOtp(otp);

  await prisma.otp.create({
    data: {
      email: user.email,
      type: "EMAIL_VERIFICATION",
      codeHash,
      expiresAt: new Date(
        Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
      ),
    },
  });

  await sendEmail({
    to: user.email,
    subject: "Verify your email - NH37 Car Rentals",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Verify your email</title>
        </head>

        <body style="
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
          font-family: Arial, Helvetica, sans-serif;
        ">

          <div style="
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          ">

            <!-- Header -->
            <div style="
              background: #111111;
              padding: 30px;
              text-align: center;
            ">
              <h1 style="
                margin: 0;
                color: #ffffff;
                font-size: 26px;
              ">
                NH37 Car Rentals
              </h1>

              <p style="
                margin: 8px 0 0;
                color: #cccccc;
                font-size: 14px;
              ">
                Your journey starts here
              </p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 35px;">

              <h2 style="
                margin-top: 0;
                color: #222222;
                font-size: 22px;
              ">
                Verify your email
              </h2>

              <p style="
                color: #555555;
                font-size: 15px;
                line-height: 1.6;
              ">
                Hi ${user.name},
              </p>

              <p style="
                color: #555555;
                font-size: 15px;
                line-height: 1.6;
              ">
                Use the verification code below to verify your
                email address for your NH37 Car Rentals account.
              </p>

              <!-- OTP -->
              <div style="
                margin: 30px 0;
                text-align: center;
              ">

                <div style="
                  display: inline-block;
                  background: #f1f1f1;
                  border: 1px solid #dddddd;
                  border-radius: 10px;
                  padding: 18px 35px;
                  letter-spacing: 8px;
                  font-size: 30px;
                  font-weight: bold;
                  color: #111111;
                ">
                  ${otp}
                </div>

              </div>

              <p style="
                text-align: center;
                color: #777777;
                font-size: 13px;
              ">
                This code will expire in
                <strong>10 minutes</strong>.
              </p>

              <p style="
                color: #555555;
                font-size: 14px;
                line-height: 1.6;
              ">
                If you did not request this verification code,
                you can safely ignore this email.
              </p>

              <p style="
                margin-top: 30px;
                color: #555555;
                font-size: 14px;
              ">
                Regards,<br />
                <strong>NH37 Car Rentals</strong>
              </p>

            </div>

            <!-- Footer -->
            <div style="
              background: #f7f7f7;
              padding: 20px;
              text-align: center;
            ">
              <p style="
                margin: 0;
                color: #999999;
                font-size: 12px;
              ">
                © ${new Date().getFullYear()} NH37 Car Rentals.
                All rights reserved.
              </p>
            </div>

          </div>

        </body>
      </html>
    `,
  });

  return {
    message: "Verification OTP sent successfully",
  };
};


export const verifyEmailOtp = async (
  email: string,
  otp: string
) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.emailVerifiedAt) {
    throw new Error("Email is already verified");
  }

  const otpRecord = await prisma.otp.findFirst({
    where: {
      email,
      type: "EMAIL_VERIFICATION",
      verifiedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otpRecord) {
    throw new Error("OTP not found or expired");
  }

  if (otpRecord.expiresAt < new Date()) {
    throw new Error("OTP has expired");
  }

  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    throw new Error(
      "Too many incorrect attempts. Please request a new OTP."
    );
  }

  const otpHash = hashOtp(otp);

  if (otpHash !== otpRecord.codeHash) {
    await prisma.otp.update({
      where: {
        id: otpRecord.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw new Error("Invalid OTP");
  }

  await prisma.$transaction([
    prisma.otp.update({
      where: {
        id: otpRecord.id,
      },
      data: {
        verifiedAt: new Date(),
      },
    }),

    prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerifiedAt: new Date(),
      },
    }),
  ]);

  return {
    message: "Email verified successfully",
  };
};


export const sendPasswordResetOtp = async (
  email: string
) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Remove previous password reset OTPs for this email
  await prisma.otp.deleteMany({
    where: {
      email,
      type: OtpType.PASSWORD_RESET,
    },
  });

  const otp = generateOtp();
  const codeHash = hashOtp(otp);

  await prisma.otp.create({
    data: {
      email: user.email,
      type: OtpType.PASSWORD_RESET,
      codeHash,
      expiresAt: new Date(
        Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
      ),
    },
  });

  await sendEmail({
    to: user.email,
    subject: "Password Reset OTP - NH37 Car Rentals",
    html: `
      <h2>Reset your password</h2>

      <p>Hi ${user.name},</p>

      <p>
        Use the OTP below to reset your NH37 Car Rentals password.
      </p>

      <h1>${otp}</h1>

      <p>This OTP will expire in 10 minutes.</p>

      <p>
        If you did not request a password reset,
        you can safely ignore this email.
      </p>

      <p>
        Regards,<br />
        NH37 Car Rentals
      </p>
    `,
  });

  return {
    message: "Password reset OTP sent successfully",
  };
};

export const verifyPasswordResetOtp = async (
  email: string,
  otp: string
) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const otpRecord = await prisma.otp.findFirst({
    where: {
      email,
      type: OtpType.PASSWORD_RESET,
      verifiedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otpRecord) {
    throw new Error("OTP not found or expired");
  }

  if (otpRecord.expiresAt < new Date()) {
    throw new Error("OTP has expired");
  }

  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    throw new Error(
      "Too many incorrect attempts. Please request a new OTP."
    );
  }

  const otpHash = hashOtp(otp);

  if (otpHash !== otpRecord.codeHash) {
    await prisma.otp.update({
      where: {
        id: otpRecord.id,
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
      id: otpRecord.id,
    },
    data: {
      verifiedAt: new Date(),
    },
  });

  return {
    message: "Password reset OTP verified successfully",
  };
};