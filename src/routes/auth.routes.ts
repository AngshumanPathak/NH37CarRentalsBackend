import { Router } from "express";

import {
  register,
  login,
  getCurrentUser,
} from "../controllers/auth.controller.js";

import {
  sendOtpController,
  verifyOtpController,
} from "../controllers/otp.controller.js";

import {
  sendEmailOtpController,
  verifyEmailController,
} from "../controllers/email.controller.js";

import {
  sendForgotPasswordOtpController,
  verifyForgotPasswordOtpController,
  resetPasswordController,
} from "../controllers/password-reset.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();


// =========================
// AUTHENTICATION
// =========================

router.post("/register", register);

router.post("/login", login);


// =========================
// PHONE OTP
// =========================

router.post("/send-otp", sendOtpController);

router.post("/verify-otp", verifyOtpController);


// =========================
// EMAIL VERIFICATION
// =========================

router.post(
  "/send-email-otp",
  sendEmailOtpController
);

router.post(
  "/verify-email-otp",
  verifyEmailController
);


// =========================
// FORGOT PASSWORD
// =========================

router.post(
  "/forgot-password/send-otp",
  sendForgotPasswordOtpController
);

router.post(
  "/forgot-password/verify-otp",
  verifyForgotPasswordOtpController
);

router.post(
  "/reset-password",
  resetPasswordController
);


// =========================
// CURRENT USER
// =========================

router.get(
  "/me",
  authenticate,
  getCurrentUser
);


export default router;

