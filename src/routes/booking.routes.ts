
import { Router } from "express";

import { authenticate, authorize } from "../middleware/auth.middleware.js";

import {
  checkAvailabilityController,
  createBookingController,
  getMyBookingsController,
  getBookingByIdController,
  getAllBookingsController,
  getAdminBookingByIdController,
  confirmBookingController,
  rejectAdminBookingController,
} from "../controllers/booking.controller.js";

import { UserRole } from "@prisma/client";

const router = Router();

/*
 * ============================================================
 * PUBLIC / CUSTOMER BOOKING ROUTES
 * ============================================================
 */

/*
 * Availability can be checked before login.
 */
router.post(
  "/check-availability",
  checkAvailabilityController
);

/*
 * Creating a booking requires authentication.
 */
router.post(
  "/",
  authenticate,
  createBookingController
);

/*
 * Get logged-in user's bookings.
 */
router.get(
  "/my",
  authenticate,
  getMyBookingsController
);


/*
 * ============================================================
 * ADMIN BOOKING ROUTES
 * ============================================================
 */

/*
 * Get all bookings.
 *
 * IMPORTANT:
 * This MUST come before "/:id".
 * Otherwise "/admin" gets interpreted as:
 *
 *     id = "admin"
 */
router.get(
  "/admin",
  authenticate,
  authorize(UserRole.ADMIN),
  getAllBookingsController
);

/*
 * Get a specific booking as admin.
 */
router.get(
  "/admin/:id",
  authenticate,
  authorize(UserRole.ADMIN),
  getAdminBookingByIdController
);

/*
 * Confirm a pending booking.
 */
router.patch(
  "/admin/:id/confirm",
  authenticate,
  authorize(UserRole.ADMIN),
  confirmBookingController
);


/*
 * ============================================================
 * CUSTOMER BOOKING BY ID
 * ============================================================
 *
 * IMPORTANT:
 * This generic "/:id" route MUST remain AFTER
 * all "/admin/..." routes.
 */
router.get(
  "/:id",
  authenticate,
  getBookingByIdController
);


router.patch(
  "/admin/:bookingId/reject",
  authenticate,
  authorize("ADMIN"),
  rejectAdminBookingController
);


/*
 * ============================================================
 * EXPORT
 * ============================================================
 */

export default router;
