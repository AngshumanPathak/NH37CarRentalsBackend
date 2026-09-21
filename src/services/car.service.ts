import prisma from "../config/prisma.js";
import { CarStatus, RentalType } from "@prisma/client";

export type CreateCarInput = {
  name: string;
  brand: string;
  model: string;

  year?: number | null;
  registrationNumber: string;
  description?: string | null;

  // Rental Type
  rentalType: RentalType;

  // Self Drive Pricing
  pricePerDaySelfDrive?: number | null;
  pricePerHourSelfDrive?: number | null;
  securityDepositSelfDrive?: number | null;

  // With Driver Pricing
  pricePerDayWithDriver?: number | null;
  pricePerHourWithDriver?: number | null;
  securityDepositWithDriver?: number | null;

  // Specifications
  seats?: number | null;
  transmission?: string | null;
  fuelType?: string | null;

  status?: CarStatus;

  images?: {
    url: string;
    publicId: string;
  }[];
};

export const createCar = async (data: CreateCarInput) => {
  const registrationNumber =
    data.registrationNumber.trim().toUpperCase();

  // ============================================================
  // CHECK DUPLICATE REGISTRATION NUMBER
  // ============================================================

  const existingCar = await prisma.car.findUnique({
    where: {
      registrationNumber,
    },
  });

  if (existingCar) {
    throw new Error(
      "A car with this registration number already exists"
    );
  }

  // ============================================================
  // VALIDATE RENTAL TYPE PRICING
  // ============================================================

  const hasSelfDrivePricing =
    data.pricePerDaySelfDrive !== null &&
    data.pricePerDaySelfDrive !== undefined;

  const hasSelfDriveOptionalPricing =
    data.pricePerHourSelfDrive !== null &&
    data.pricePerHourSelfDrive !== undefined;

  const hasSelfDriveDeposit =
    data.securityDepositSelfDrive !== null &&
    data.securityDepositSelfDrive !== undefined;

  const hasWithDriverPricing =
    data.pricePerDayWithDriver !== null &&
    data.pricePerDayWithDriver !== undefined;

  const hasWithDriverOptionalPricing =
    data.pricePerHourWithDriver !== null &&
    data.pricePerHourWithDriver !== undefined;

  const hasWithDriverDeposit =
    data.securityDepositWithDriver !== null &&
    data.securityDepositWithDriver !== undefined;

  // ============================================================
  // SELF DRIVE
  // ============================================================

  if (data.rentalType === RentalType.SELF_DRIVE) {
    if (!hasSelfDrivePricing) {
      throw new Error(
        "Self-drive price per day is required"
      );
    }

    if (
      hasWithDriverPricing ||
      hasWithDriverOptionalPricing ||
      hasWithDriverDeposit
    ) {
      throw new Error(
        "With-driver pricing cannot be provided for a self-drive-only car"
      );
    }
  }

  // ============================================================
  // WITH DRIVER
  // ============================================================

  if (data.rentalType === RentalType.WITH_DRIVER) {
    if (!hasWithDriverPricing) {
      throw new Error(
        "With-driver price per day is required"
      );
    }

    if (
      hasSelfDrivePricing ||
      hasSelfDriveOptionalPricing ||
      hasSelfDriveDeposit
    ) {
      throw new Error(
        "Self-drive pricing cannot be provided for a with-driver-only car"
      );
    }
  }

  // ============================================================
  // BOTH
  // ============================================================

  if (data.rentalType === RentalType.BOTH) {
    if (!hasSelfDrivePricing) {
      throw new Error(
        "Self-drive price per day is required when rental type is BOTH"
      );
    }

    if (!hasWithDriverPricing) {
      throw new Error(
        "With-driver price per day is required when rental type is BOTH"
      );
    }
  }

  // ============================================================
  // PREPARE PRICING
  // ============================================================

  const selfDrivePricing =
    data.rentalType === RentalType.SELF_DRIVE ||
    data.rentalType === RentalType.BOTH;

  const withDriverPricing =
    data.rentalType === RentalType.WITH_DRIVER ||
    data.rentalType === RentalType.BOTH;

  // ============================================================
  // CREATE CAR
  // ============================================================

  const car = await prisma.car.create({
    data: {
      name: data.name.trim(),

      brand: data.brand.trim(),

      model: data.model.trim(),

      year: data.year ?? null,

      registrationNumber,

      description:
        data.description?.trim() || null,

      // ========================================================
      // RENTAL TYPE
      // ========================================================

      rentalType: data.rentalType,

      // ========================================================
      // SELF DRIVE PRICING
      // ========================================================
      //
      // Only stored when:
      // SELF_DRIVE
      // BOTH
      //
      // Otherwise everything is NULL.
      // ========================================================

      pricePerDaySelfDrive: selfDrivePricing
        ? data.pricePerDaySelfDrive!
        : null,

      pricePerHourSelfDrive: selfDrivePricing
        ? data.pricePerHourSelfDrive ?? null
        : null,

      securityDepositSelfDrive: selfDrivePricing
        ? data.securityDepositSelfDrive ?? null
        : null,

      // ========================================================
      // WITH DRIVER PRICING
      // ========================================================
      //
      // Only stored when:
      // WITH_DRIVER
      // BOTH
      //
      // Otherwise everything is NULL.
      // ========================================================

      pricePerDayWithDriver: withDriverPricing
        ? data.pricePerDayWithDriver!
        : null,

      pricePerHourWithDriver: withDriverPricing
        ? data.pricePerHourWithDriver ?? null
        : null,

      securityDepositWithDriver: withDriverPricing
        ? data.securityDepositWithDriver ?? null
        : null,

      // ========================================================
      // SPECIFICATIONS
      // ========================================================

      seats:
        data.seats ?? null,

      transmission:
        data.transmission?.trim() || null,

      fuelType:
        data.fuelType?.trim() || null,

      status:
        data.status ?? CarStatus.AVAILABLE,

      // ========================================================
      // IMAGES
      // ========================================================

      images: data.images?.length
        ? {
            create: data.images.map((image) => ({
              url: image.url,
              publicId: image.publicId,
            })),
          }
        : undefined,
    },

    include: {
      images: true,
    },
  });

  return car;
};