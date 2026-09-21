import { Request, Response } from "express";
import prisma from "../config/prisma.js";

import {
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
} from "../services/email-otp.service.js";

import {
  createPasswordResetToken,
  verifyPasswordResetToken,
} from "../services/password-reset.service.js";

import bcrypt from "bcrypt";

// ======================================================
// SEND FORGOT PASSWORD OTP
// ======================================================

export const sendForgotPasswordOtpController = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    // Send PASSWORD_RESET OTP
    await sendPasswordResetOtp(email);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error: any) {
    console.error("Forgot password OTP error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to send OTP",
    });
  }
};

// ======================================================
// VERIFY FORGOT PASSWORD OTP
// ======================================================

export const verifyForgotPasswordOtpController = async (
  req: Request,
  res: Response
) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify PASSWORD_RESET OTP
    await verifyPasswordResetOtp(email, otp);

    // OTP verified successfully.
    // Now create temporary reset token.
    const { token, expiresAt } =
      await createPasswordResetToken(user.id);

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      resetToken: token,
      expiresAt,
    });
  } catch (error: any) {
    console.error(
      "Verify password reset OTP error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message || "Invalid or expired OTP",
    });
  }
};

// ======================================================
// RESET PASSWORD
// ======================================================

export const resetPasswordController = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      resetToken,
      newPassword,
      confirmPassword,
    } = req.body;

    if (
      !resetToken ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check password confirmation
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // Minimum password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters",
      });
    }

    // Validate reset token
    const tokenRecord =
      await verifyPasswordResetToken(resetToken);

    // Hash new password
    const passwordHash = await bcrypt.hash(
      newPassword,
      10
    );

    // Update user's password
    await prisma.user.update({
      where: {
        id: tokenRecord.userId,
      },
      data: {
        passwordHash,
      },
    });

    // Delete reset token after successful reset
    await prisma.passwordResetToken.delete({
      where: {
        id: tokenRecord.id,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. Please login.",
    });
  } catch (error: any) {
    console.error(
      "Reset password error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to reset password",
    });
  }
};