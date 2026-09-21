import { Request, Response } from "express";
import {
  sendEmailVerificationOtp,
  verifyEmailOtp,
} from "../services/email-otp.service.js";

export const sendEmailOtpController = async (
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

    const result =
      await sendEmailVerificationOtp(email);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Send email OTP error:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message || "Failed to send verification OTP",
    });
  }
};

export const verifyEmailController = async (
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

    const result = await verifyEmailOtp(
      email,
      otp
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Verify email error:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message || "Failed to verify email",
    });
  }
};

