import { z } from "zod";
import { CarStatus } from "@prisma/client";

// ============================================================
// COMMON SCHEMAS
// ============================================================

const rentalTypeSchema = z.enum([
  "SELF_DRIVE",
  "WITH_DRIVER",
  "BOTH",
]);

const optionalPositiveNumber = z
  .number()
  .positive()
  .nullable()
  .optional();

const optionalNonNegativeNumber = z
  .number()
  .nonnegative()
  .nullable()
  .optional();

// ============================================================
// BASE CAR SCHEMA
// ============================================================

const carSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Car name is required"),

  brand: z
    .string()
    .trim()
    .min(2, "Brand is required"),

  model: z
    .string()
    .trim()
    .min(1, "Model is required"),

  year: z
    .number()
    .int()
    .min(1990)
    .max(new Date().getFullYear() + 1)
    .nullable()
    .optional(),

  registrationNumber: z
    .string()
    .min(3)
    .max(20)
    .transform((value) =>
      value.toUpperCase().trim()
    ),

  description: z
    .string()
    .trim()
    .nullable()
    .optional(),

  // ==========================================================
  // RENTAL TYPE
  // ==========================================================

  rentalType: rentalTypeSchema,

  // ==========================================================
  // SELF DRIVE PRICING
  // ==========================================================

  pricePerDaySelfDrive:
    optionalPositiveNumber,

  pricePerHourSelfDrive:
    optionalPositiveNumber,

  securityDepositSelfDrive:
    optionalNonNegativeNumber,

  // ==========================================================
  // WITH DRIVER PRICING
  // ==========================================================

  pricePerDayWithDriver:
    optionalPositiveNumber,

  pricePerHourWithDriver:
    optionalPositiveNumber,

  securityDepositWithDriver:
    optionalNonNegativeNumber,

  // ==========================================================
  // CAR DETAILS
  // ==========================================================

  seats: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),

  transmission: z
    .string()
    .trim()
    .nullable()
    .optional(),

  fuelType: z
    .string()
    .trim()
    .nullable()
    .optional(),

  status: z
    .nativeEnum(CarStatus)
    .optional(),

  // ==========================================================
  // IMAGES
  // ==========================================================

  images: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string().min(1),
      })
    )
    .max(10)
    .optional(),
});

// ============================================================
// CREATE CAR VALIDATION
// ============================================================

export const createCarSchema = carSchema.superRefine(
  (data, ctx) => {
    const usesSelfDrive =
      data.rentalType === "SELF_DRIVE" ||
      data.rentalType === "BOTH";

    const usesWithDriver =
      data.rentalType === "WITH_DRIVER" ||
      data.rentalType === "BOTH";

    // ========================================================
    // SELF DRIVE PRICE
    // ========================================================

    if (usesSelfDrive) {
      if (
        data.pricePerDaySelfDrive === null ||
        data.pricePerDaySelfDrive === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricePerDaySelfDrive"],
          message:
            "Self-drive price per day is required",
        });
      }
    }

    // ========================================================
    // WITH DRIVER PRICE
    // ========================================================

    if (usesWithDriver) {
      if (
        data.pricePerDayWithDriver === null ||
        data.pricePerDayWithDriver === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricePerDayWithDriver"],
          message:
            "With-driver price per day is required",
        });
      }
    }

    // ========================================================
    // SELF DRIVE ONLY
    // ========================================================

    if (data.rentalType === "SELF_DRIVE") {
      if (
        data.pricePerDayWithDriver !== null &&
        data.pricePerDayWithDriver !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricePerDayWithDriver"],
          message:
            "With-driver pricing is not allowed for SELF_DRIVE",
        });
      }

      if (
        data.pricePerHourWithDriver !== null &&
        data.pricePerHourWithDriver !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricePerHourWithDriver"],
          message:
            "With-driver pricing is not allowed for SELF_DRIVE",
        });
      }

      if (
        data.securityDepositWithDriver !== null &&
        data.securityDepositWithDriver !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["securityDepositWithDriver"],
          message:
            "With-driver pricing is not allowed for SELF_DRIVE",
        });
      }
    }

    // ========================================================
    // WITH DRIVER ONLY
    // ========================================================

    if (data.rentalType === "WITH_DRIVER") {
      if (
        data.pricePerDaySelfDrive !== null &&
        data.pricePerDaySelfDrive !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricePerDaySelfDrive"],
          message:
            "Self-drive pricing is not allowed for WITH_DRIVER",
        });
      }

      if (
        data.pricePerHourSelfDrive !== null &&
        data.pricePerHourSelfDrive !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricePerHourSelfDrive"],
          message:
            "Self-drive pricing is not allowed for WITH_DRIVER",
        });
      }

      if (
        data.securityDepositSelfDrive !== null &&
        data.securityDepositSelfDrive !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["securityDepositSelfDrive"],
          message:
            "Self-drive pricing is not allowed for WITH_DRIVER",
        });
      }
    }
  }
);

// ============================================================
// UPDATE CAR VALIDATION
// ============================================================

export const updateCarSchema =
  carSchema.partial();