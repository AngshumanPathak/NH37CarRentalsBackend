import { OtpType } from "@prisma/client";
import { Request, Response } from "express";
import { createOtp, verifyOtp } from "../services/otp.service.js";


export const sendOtp = async (
  phone: string,
  type: OtpType = OtpType.LOGIN
) => {
  const { otp, otpId, expiresAt } = await createOtp(phone, type);

  // Temporary: simulate sending OTP
  console.log(`OTP sent to ${phone}: ${otp}`);

  return {
    otpId,
    expiresAt,
  };
}


export const sendOtpController = async (
  req: Request,
  res: Response
) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const result = await sendOtp(phone, OtpType.LOGIN);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      otpId: result.otpId,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

export const verifyOtpController = async (
  req: Request,
  res: Response
) => {
  try {
    const { otpId, otp } = req.body;

    if (!otpId || !otp) {
      return res.status(400).json({
        success: false,
        message: "OTP ID and OTP are required",
      });
    }

    const otpRecord = await verifyOtp(otpId, otp);

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      verifiedAt: otpRecord.verifiedAt,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to verify OTP";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};