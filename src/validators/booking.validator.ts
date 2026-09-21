import { z } from "zod";

// ============================================================
// DOCUMENT URL SCHEMA
// ============================================================

const bookingDocumentSchema = z.object({
  type: z.enum([
    "AADHAAR",
    "DRIVING_LICENSE",
    "VOTER_ID",
  ]),

  url: z
    .string()
    .url("Invalid document URL"),

  publicId: z
    .string()
    .nullable()
    .optional(),
});

// ============================================================
// BOOKING RENTAL TYPE
// ============================================================
//
// IMPORTANT:
// Car.rentalType can be:
//   SELF_DRIVE
//   WITH_DRIVER
//   BOTH
//
// But a Booking can only have ONE selected rental mode.
// Therefore BOTH is NOT valid here.
//
// ============================================================

const bookingRentalTypeSchema = z.enum([
  "SELF_DRIVE",
  "WITH_DRIVER",
]);

// ============================================================
// CREATE BOOKING SCHEMA
// ============================================================

export const createBookingSchema = z.object({
  carId: z
    .string()
    .uuid("Invalid car ID"),

  rentalType: bookingRentalTypeSchema,

  pickupLocation: z
    .string()
    .trim()
    .min(1, "Pickup location is required"),

  dropLocation: z
    .string()
    .trim()
    .optional()
    .nullable(),

  pickupLatitude: z
    .number()
    .min(-90)
    .max(90)
    .optional()
    .nullable(),

  pickupLongitude: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .nullable(),

  dropLatitude: z
    .number()
    .min(-90)
    .max(90)
    .optional()
    .nullable(),

  dropLongitude: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .nullable(),

  pickupAt: z.coerce.date(),

  returnAt: z.coerce.date(),

  documents: z
    .array(bookingDocumentSchema)
    .optional()
    .default([]),
});

// ============================================================
// CHECK AVAILABILITY SCHEMA
// ============================================================

export const checkAvailabilitySchema = z.object({
  carId: z
    .string()
    .uuid("Invalid car ID"),

  rentalType: bookingRentalTypeSchema,

  pickupAt: z.coerce.date(),

  returnAt: z.coerce.date(),
});