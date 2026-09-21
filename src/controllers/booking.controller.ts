
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
    // --------------------------------------------------------
    // VALIDATE REQUEST
    // --------------------------------------------------------

    const parsed =
      checkAvailabilitySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid availability request",
        errors: parsed.error.flatten(),
      });
    }

    const {
      carId,
      pickupAt,
      returnAt,
    } = parsed.data;

    // --------------------------------------------------------
    // CONVERT DATES
    // --------------------------------------------------------

    const pickupDate = new Date(pickupAt);
    const returnDate = new Date(returnAt);

    // --------------------------------------------------------
    // CHECK INVALID DATE VALUES
    // --------------------------------------------------------

    if (
      Number.isNaN(pickupDate.getTime()) ||
      Number.isNaN(returnDate.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup or return date",
      });
    }

    // --------------------------------------------------------
    // CHECK AVAILABILITY
    // --------------------------------------------------------

    const result =
      await checkCarAvailability(
        carId,
        pickupDate,
        returnDate
      );

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error(
      "Check availability error:",
      error
    );

    const message =
      error?.message ||
      "Failed to check car availability";

    // --------------------------------------------------------
    // NOT FOUND
    // --------------------------------------------------------

    if (message === "Car not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    // --------------------------------------------------------
    // DATE VALIDATION
    // --------------------------------------------------------

    if (
      message ===
        "Pickup date must be in the future" ||
      message ===
        "Return date must be after pickup date"
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    // --------------------------------------------------------
    // DEFAULT ERROR
    // --------------------------------------------------------

    return res.status(500).json({
      success: false,
      message:
        "Failed to check car availability",
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
    // --------------------------------------------------------
    // AUTH CHECK
    // --------------------------------------------------------

    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // --------------------------------------------------------
    // VALIDATE REQUEST
    // --------------------------------------------------------

    const parsed =
      createBookingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking request",
        errors: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    // --------------------------------------------------------
    // CONVERT DATES
    // --------------------------------------------------------

    const pickupAt = new Date(data.pickupAt);
    const returnAt = new Date(data.returnAt);

    // --------------------------------------------------------
    // CHECK INVALID DATE VALUES
    // --------------------------------------------------------

    if (
      Number.isNaN(pickupAt.getTime()) ||
      Number.isNaN(returnAt.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pickup or return date",
      });
    }

    // --------------------------------------------------------
    // CREATE BOOKING
    // --------------------------------------------------------

    const result = await createBooking(
      req.user.id,
      {
        carId: data.carId,

        rentalType:
          data.rentalType,

        pickupLocation:
          data.pickupLocation,

        dropLocation:
          data.dropLocation ?? null,

        pickupLatitude:
          data.pickupLatitude ?? null,

        pickupLongitude:
          data.pickupLongitude ?? null,

        dropLatitude:
          data.dropLatitude ?? null,

        dropLongitude:
          data.dropLongitude ?? null,

        pickupAt,

        returnAt,

        documents:
          data.documents?.map(
            (document) => ({
              type: document.type,
              url: document.url,
              publicId:
                document.publicId ?? null,
            })
          ),
      }
    );

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Booking created successfully",

      data: result,
    });
  } catch (error: any) {
    console.error(
      "Create booking error:",
      error
    );

    const message =
      error?.message ||
      "Failed to create booking";

    // --------------------------------------------------------
    // PRISMA SERIALIZATION CONFLICT
    //
    // Serializable transaction can fail when another
    // customer creates a booking for the same car/time.
    // --------------------------------------------------------

    if (error?.code === "P2034") {
      return res.status(409).json({
        success: false,
        message:
          "The car was booked by another customer. Please check availability again.",
      });
    }

    // --------------------------------------------------------
    // NOT FOUND
    // --------------------------------------------------------

    if (
      message === "Car not found" ||
      message === "User not found"
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    // --------------------------------------------------------
    // CONFLICT
    // --------------------------------------------------------

    if (
      message ===
        "Car is already booked for the selected period" ||
      message ===
        "Car is currently unavailable"
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    // --------------------------------------------------------
    // ACCOUNT
    // --------------------------------------------------------

    if (
      message ===
      "Your account is not active"
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    // --------------------------------------------------------
    // RENTAL TYPE
    // --------------------------------------------------------

    if (
      message ===
      "Only self-drive bookings are currently supported"
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    // --------------------------------------------------------
    // DATE VALIDATION
    // --------------------------------------------------------

    if (
      message ===
        "Pickup date must be in the future" ||
      message ===
        "Return date must be after pickup date"
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    // --------------------------------------------------------
    // DEFAULT ERROR
    // --------------------------------------------------------

    return res.status(500).json({
      success: false,
      message,
    });
  }
};





export const getMyBookingsController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    console.log("====================================");
    console.log("GET MY BOOKINGS");
    console.log("req.user:", req.user);
    console.log("userId:", req.user?.id);
    console.log("====================================");

    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const bookings = await getMyBookings(req.user.id);

    console.log("Bookings found:", bookings.length);

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
};



export const getBookingByIdController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    console.log("====================================");
    console.log("GET BOOKING BY ID");
    console.log("bookingId:", id);
    console.log("userId:", userId);
    console.log("====================================");

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const booking = await getBookingById(
      Array.isArray(id) ? id[0] : id,
      userId
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error(
      "Get booking by ID error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
    });
  }
};

// ============================================================
// GET ALL BOOKINGS - ADMIN
// ============================================================

export const getAllBookingsController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const bookings = await getAllBookings();

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error(
      "Get all bookings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
};

// ============================================================
// GET BOOKING BY ID - ADMIN
// ============================================================

export const getAdminBookingByIdController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const booking =
      await getAdminBookingById(
        Array.isArray(id) ? id[0] : id
      );

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error: any) {
    console.error(
      "Get admin booking error:",
      error
    );

    if (
      error?.message ===
      "Booking not found"
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
    });
  }
};

// ============================================================
// CONFIRM BOOKING - ADMIN
// ============================================================

export const confirmBookingController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const note =
      typeof req.body?.note === "string"
        ? req.body.note.trim()
        : undefined;

    const booking =
      await confirmBooking(
        Array.isArray(id) ? id[0] : id,
        req.user.id,
        note
      );

    return res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
    });
  } catch (error: any) {
    console.error(
      "Confirm booking error:",
      error
    );

    const message =
      error?.message ||
      "Failed to confirm booking";

    if (message === "Booking not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message === "Car not found"
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "Car is currently unavailable"
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "Car is no longer available for this booking period"
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    if (
      message.startsWith(
        "Booking cannot be confirmed from"
      )
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message,
    });
  }
};


export const rejectAdminBookingController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const bookingId = req.params.bookingId as string;
    const { reason } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        message: "Booking ID is required",
      });
    }

    const booking = await rejectBooking(
      bookingId,
      reason
    );

    return res.status(200).json(booking);
  } catch (error) {
    console.error("Reject admin booking error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to reject booking";

    if (message === "Booking not found") {
      return res.status(404).json({
        message,
      });
    }

    if (message.startsWith("Booking cannot be rejected")) {
      return res.status(400).json({
        message,
      });
    }

    return res.status(500).json({
      message: "Failed to reject booking",
    });
  }
};