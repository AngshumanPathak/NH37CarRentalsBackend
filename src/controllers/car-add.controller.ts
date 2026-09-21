import { Request, Response } from "express";
import {
  createCar,
  type CreateCarInput,
} from "../services/car.service.js";

import { RentalType, CarStatus } from "@prisma/client";

// ============================================================
// CREATE CAR CONTROLLER
// ============================================================

export const createCarController = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      brand,
      model,
      year,
      rentalType,
      registrationNumber,
      description,

      pricePerDaySelfDrive,
      pricePerHourSelfDrive,
      securityDepositSelfDrive,

      pricePerDayWithDriver,
      pricePerHourWithDriver,
      securityDepositWithDriver,

      seats,
      transmission,
      fuelType,

      status,
      images,
    } = req.body;

    // ========================================================
    // BASIC REQUIRED VALIDATION
    // ========================================================

    if (
      !name ||
      !brand ||
      !model ||
      !registrationNumber
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required car details",
      });
    }

    // ========================================================
    // RENTAL TYPE VALIDATION
    // ========================================================

    if (
      rentalType !== RentalType.SELF_DRIVE &&
      rentalType !== RentalType.WITH_DRIVER &&
      rentalType !== RentalType.BOTH
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid rental type",
      });
    }

    // ========================================================
    // NUMBER CONVERSION HELPER
    // ========================================================

    const parseOptionalNumber = (
      value: unknown
    ): number | null => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return null;
      }

      const parsed = Number(value);

      return Number.isFinite(parsed)
        ? parsed
        : null;
    };

    // ========================================================
    // PARSE BASIC NUMBERS
    // ========================================================

    const parsedYear =
      parseOptionalNumber(year);

    const parsedSeats =
      parseOptionalNumber(seats);

    // ========================================================
    // PARSE SELF DRIVE PRICING
    // ========================================================

    const parsedPricePerDaySelfDrive =
      parseOptionalNumber(
        pricePerDaySelfDrive
      );

    const parsedPricePerHourSelfDrive =
      parseOptionalNumber(
        pricePerHourSelfDrive
      );

    const parsedSecurityDepositSelfDrive =
      parseOptionalNumber(
        securityDepositSelfDrive
      );

    // ========================================================
    // PARSE WITH DRIVER PRICING
    // ========================================================

    const parsedPricePerDayWithDriver =
      parseOptionalNumber(
        pricePerDayWithDriver
      );

    const parsedPricePerHourWithDriver =
      parseOptionalNumber(
        pricePerHourWithDriver
      );

    const parsedSecurityDepositWithDriver =
      parseOptionalNumber(
        securityDepositWithDriver
      );

    // ========================================================
    // VALIDATE REQUIRED PRICING BASED ON RENTAL TYPE
    // ========================================================

    if (
      rentalType === RentalType.SELF_DRIVE ||
      rentalType === RentalType.BOTH
    ) {
      if (
        parsedPricePerDaySelfDrive === null ||
        parsedPricePerDaySelfDrive <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Self-drive price per day is required and must be greater than 0",
        });
      }
    }

    if (
      rentalType === RentalType.WITH_DRIVER ||
      rentalType === RentalType.BOTH
    ) {
      if (
        parsedPricePerDayWithDriver === null ||
        parsedPricePerDayWithDriver <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "With-driver price per day is required and must be greater than 0",
        });
      }
    }

    // ========================================================
    // CLEAR UNUSED PRICING
    // ========================================================

    const finalPricePerDaySelfDrive =
      rentalType === RentalType.SELF_DRIVE ||
      rentalType === RentalType.BOTH
        ? parsedPricePerDaySelfDrive
        : null;

    const finalPricePerHourSelfDrive =
      rentalType === RentalType.SELF_DRIVE ||
      rentalType === RentalType.BOTH
        ? parsedPricePerHourSelfDrive
        : null;

    const finalSecurityDepositSelfDrive =
      rentalType === RentalType.SELF_DRIVE ||
      rentalType === RentalType.BOTH
        ? parsedSecurityDepositSelfDrive
        : null;

    const finalPricePerDayWithDriver =
      rentalType === RentalType.WITH_DRIVER ||
      rentalType === RentalType.BOTH
        ? parsedPricePerDayWithDriver
        : null;

    const finalPricePerHourWithDriver =
      rentalType === RentalType.WITH_DRIVER ||
      rentalType === RentalType.BOTH
        ? parsedPricePerHourWithDriver
        : null;

    const finalSecurityDepositWithDriver =
      rentalType === RentalType.WITH_DRIVER ||
      rentalType === RentalType.BOTH
        ? parsedSecurityDepositWithDriver
        : null;

    // ========================================================
    // VALIDATE OPTIONAL NUMBERS
    // ========================================================

    const optionalNumbers = [
      parsedYear,
      parsedSeats,
      finalPricePerHourSelfDrive,
      finalSecurityDepositSelfDrive,
      finalPricePerHourWithDriver,
      finalSecurityDepositWithDriver,
    ];

    if (
      optionalNumbers.some(
        (value) =>
          value !== null &&
          !Number.isFinite(value)
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid numeric value provided",
      });
    }

    // ========================================================
    // BUILD SERVICE INPUT
    // ========================================================

    const carData: CreateCarInput = {
      name: String(name).trim(),

      brand: String(brand).trim(),

      model: String(model).trim(),

      rentalType,

      year: parsedYear,

      registrationNumber:
        String(registrationNumber)
          .trim()
          .toUpperCase(),

      description:
        description
          ? String(description).trim()
          : null,

      // ------------------------------------------------------
      // SELF DRIVE
      // ------------------------------------------------------

      pricePerDaySelfDrive:
        finalPricePerDaySelfDrive,

      pricePerHourSelfDrive:
        finalPricePerHourSelfDrive,

      securityDepositSelfDrive:
        finalSecurityDepositSelfDrive,

      // ------------------------------------------------------
      // WITH DRIVER
      // ------------------------------------------------------

      pricePerDayWithDriver:
        finalPricePerDayWithDriver,

      pricePerHourWithDriver:
        finalPricePerHourWithDriver,

      securityDepositWithDriver:
        finalSecurityDepositWithDriver,

      // ------------------------------------------------------
      // SPECIFICATIONS
      // ------------------------------------------------------

      seats: parsedSeats,

      transmission:
        transmission
          ? String(transmission).trim()
          : null,

      fuelType:
        fuelType
          ? String(fuelType).trim()
          : null,

      // ------------------------------------------------------
      // STATUS
      // ------------------------------------------------------

      status:
        status &&
        Object.values(CarStatus).includes(status)
          ? status
          : CarStatus.AVAILABLE,

      // ------------------------------------------------------
      // IMAGES
      // ------------------------------------------------------

      images:
        Array.isArray(images)
          ? images
          : undefined,
    };

    // ========================================================
    // CREATE CAR
    // ========================================================

    const car = await createCar(carData);

    return res.status(201).json({
      success: true,
      message: "Car added successfully",
      car,
    });
  } catch (error: any) {
    console.error(
      "Create car controller error:",
      error
    );

    // ========================================================
    // DUPLICATE REGISTRATION
    // ========================================================

    if (
      error instanceof Error &&
      error.message ===
        "A car with this registration number already exists"
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    // ========================================================
    // SERVICE VALIDATION ERRORS
    // ========================================================

    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // ========================================================
    // UNKNOWN ERROR
    // ========================================================

    return res.status(500).json({
      success: false,
      message: "Failed to add car",
    });
  }
};