
import { Request, Response } from "express";
import {
  loginUser,
  registerUser,
} from "../services/auth.service.js";

import { sendEmailVerificationOtp } from "../services/email-otp.service.js";

import { AuthRequest } from "../middleware/auth.middleware.js";
import prisma from "../config/prisma.js";

// ======================================================
// REGISTER
// ======================================================

export const register = async (
  req: Request,
  res: Response
) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message:
          "Name, email, phone and password are required",
      });
    }

    // Create user
    const result = await registerUser({
      name,
      email,
      phone,
      password,
    });

    // Send email verification OTP
    await sendEmailVerificationOtp(email);

    return res.status(201).json({
      message:
        "Registration successful. Verification OTP sent to your email.",
      data: result,
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Registration failed",
    });
  }
};

// ======================================================
// LOGIN
// ======================================================

export const login = async (
  req: Request,
  res: Response
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const result = await loginUser({
      email,
      password,
    });

    // Access Token Cookie
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    // Refresh Token Cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successful",
      user: result.user,
    });
  } catch (error) {
    console.error(error);

    return res.status(401).json({
      message:
        error instanceof Error
          ? error.message
          : "Login failed",
    });
  }
};

// ======================================================
// GET CURRENT USER
// ======================================================

export const getCurrentUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User authenticated",
      user,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      message: "Failed to get user",
    });
  }
};
