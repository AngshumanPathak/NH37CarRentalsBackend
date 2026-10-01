import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import {
  checkAvailabilitySchema,
  createBookingSchema,
} from "../validators/booking.validator.js";
import {
  checkCarAvailability,
  createBooking,
  getMyBookings,
  getBookingById,
  getAllBookings,
  getAdminBookingById,
  confirmBooking,
  rejectBooking,
} from "../services/booking.service.js";

// ============================================================
// CHECK CAR AVAILABILITY
// ============================================================

export const checkAvailabilityController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const parsed = checkAvailabilitySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid availability request",
        errors: parsed.error.flatten(),
      });
    }

    const { carId, pickupAt, returnAt } = parsed.data;
    const pickupDate = new Date(pickupAt);
    const returnDate = new Date(returnAt);

    if (
      Number.isNaN(pickupDate.getTime()) ||
      Number.isNaN(returnDate.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup or return date",
      });
    }

    const result = await checkCarAvailability(carId, pickupDate, returnDate);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Check availability error:", error);
    const message = error?.message || "Failed to check car availability";

    if (message === "Car not found") {
      return res.status(404).json({ success: false, message });
    }

    if (
      message === "Pickup date must be in the future" ||
      message === "Return date must be after pickup date"
    ) {
      return res.status(400).json({ success: false, message });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to check car availability",
    });
  }
};

// ============================================================
// CREATE BOOKING
// ============================================================

export const createBookingController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking request",
        errors: parsed.error.flatten(),
      });
    }

    const data = parsed.data;
    const pickupAt = new Date(data.pickupAt);
    const returnAt = new Date(data.returnAt);

    if (
      Number.isNaN(pickupAt.getTime()) ||
      Number.isNaN(returnAt.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup or return date",
      });
    }

    const result = await createBooking(req.user.id, {
      carId: data.carId,
      rentalType: data.rentalType,
      pickupLocation: data.pickupLocation,
      dropLocation: data.dropLocation ?? null,
      pickupLatitude: data.pickupLatitude ?? null,
      pickupLongitude: data.pickupLongitude ?? null,
      dropLatitude: data.dropLatitude ?? null,
      dropLongitude: data.dropLongitude ?? null,
      pickupAt,
      returnAt,
      documents: data.documents?.map((document) => ({
        type: document.type,
        url: document.url,
        publicId: document.publicId ?? null,
      })),
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Create booking error:", error);
    const message = error?.message || "Failed to create booking";

    if (error?.code === "P2034") {
      return res.status(409).json({
        success: false,
        message: "The car was booked by another customer. Please check availability again.",
      });
    }

    if (message === "Car not found" || message === "User not found") {
      return res.status(404).json({ success: false, message });
    }

    if (
      message === "Car is already booked for the selected period" ||
      message === "Car is currently unavailable"
    ) {
      return res.status(409).json({ success: false, message });
    }

    if (message === "Your account is not active") {
      return res.status(403).json({ success: false, message });
    }

    if (
      message === "Only self-drive bookings are currently supported" ||
      message === "Pickup date must be in the future" ||
      message === "Return date must be after pickup date"
    ) {
      return res.status(400).json({ success: false, message });
    }

    return res.status(500).json({
      success: false,
      message,
    });
  }
};

// ============================================================
// CUSTOMER BOOKINGS LIST
// ============================================================

export const getMyBookingsController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const bookings = await getMyBookings(req.user.id);
    return res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error("Get my bookings error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch bookings" });
  }
};

// ============================================================
// GET CUSTOMER BOOKING BY ID
// ============================================================

export const getBookingByIdController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const bookingId = Array.isArray(id) ? id[0] : id;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required" });
    }

    const booking = await getBookingById(bookingId, userId);
    return res.status(200).json({ success: true, data: booking });
  } catch (error: any) {
    console.error("Get booking by ID error:", error);
    if (error?.message === "Booking not found") {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to fetch booking" });
  }
};

// ============================================================
// ADMIN GET ALL BOOKINGS
// ============================================================

export const getAllBookingsController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const bookings = await getAllBookings();
    return res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error("Get all bookings error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch bookings" });
  }
};

// ============================================================
// ADMIN GET BOOKING BY ID
// ============================================================

export const getAdminBookingByIdController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const bookingId = Array.isArray(id) ? id[0] : id;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required" });
    }

    const booking = await getAdminBookingById(bookingId);
    return res.status(200).json({ success: true, data: booking });
  } catch (error: any) {
    console.error("Get admin booking error:", error);
    if (error?.message === "Booking not found") {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to fetch booking" });
  }
};

// ============================================================
// ADMIN CONFIRM BOOKING
// ============================================================

export const confirmBookingController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const bookingId = Array.isArray(id) ? id[0] : id;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required" });
    }

    const note = typeof req.body?.note === "string" ? req.body.note.trim() : undefined;
    const booking = await confirmBooking(bookingId, req.user.id, note);

    return res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
    });
  } catch (error: any) {
    console.error("Confirm booking error:", error);
    const message = error?.message || "Failed to confirm booking";

    if (message === "Booking not found" || message === "Car not found") {
      return res.status(404).json({ success: false, message });
    }

    if (
      message === "Car is currently unavailable" ||
      message === "Car is no longer available for this booking period" ||
      message.startsWith("Booking cannot be confirmed from")
    ) {
      return res.status(409).json({ success: false, message });
    }

    return res.status(500).json({ success: false, message });
  }
};

// ============================================================
// ADMIN REJECT BOOKING
// ============================================================

export const rejectAdminBookingController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const rawId = req.params.bookingId || req.params.id;
    const bookingId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { reason } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const booking = await rejectBooking(bookingId, reason);

    return res.status(200).json({
      success: true,
      message: "Booking rejected successfully",
      data: booking,
    });
  } catch (error: any) {
    console.error("Reject admin booking error:", error);
    const message = error?.message || "Failed to reject booking";

    if (message === "Booking not found") {
      return res.status(404).json({ success: false, message });
    }

    if (message.startsWith("Booking cannot be rejected")) {
      return res.status(400).json({ success: false, message });
    }

    return res.status(500).json({ success: false, message });
  }
};