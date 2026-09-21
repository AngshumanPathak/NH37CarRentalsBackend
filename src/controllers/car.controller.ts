import { Request, Response } from "express";
import prisma from "../config/prisma.js";

import {
  createCar,
  type CreateCarInput,
} from "../services/car.service.js";

import {
  createCarSchema,
  updateCarSchema,
} from "../validators/car.validator.js";

import { BookingStatus } from "@prisma/client";


export const createCarController = async (
  req: Request,
  res: Response
) => {
  try {
    const validation = createCarSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid car data",
        errors: validation.error.flatten(),
      });
    }

    const car = await createCar(
      validation.data as CreateCarInput
    );

    return res.status(201).json({
      success: true,
      message: "Car created successfully",
      data: car,
    });
  } catch (error: any) {
    console.error("Create car error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create car",
    });
  }
};

export const getCarsController = async (
  req: Request,
  res: Response
) => {
  try {
    const { dateFrom, dateTo } = req.query;

    // ============================================================
    // DATE VALIDATION
    // ============================================================

    let pickupAt: Date | undefined;
    let returnAt: Date | undefined;

    if (dateFrom || dateTo) {
      if (!dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          message:
            "Both dateFrom and dateTo are required",
        });
      }

      if (
        typeof dateFrom !== "string" ||
        typeof dateTo !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid date parameters",
        });
      }

      pickupAt = new Date(`${dateFrom}T00:00:00`);
      returnAt = new Date(`${dateTo}T23:59:59`);

      if (
        Number.isNaN(pickupAt.getTime()) ||
        Number.isNaN(returnAt.getTime())
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }

      if (pickupAt >= returnAt) {
        return res.status(400).json({
          success: false,
          message:
            "Return date must be after pickup date",
        });
      }
    }

    // ============================================================
    // FETCH CARS
    // ============================================================

    const cars = await prisma.car.findMany({
      where: pickupAt && returnAt
        ? {
            bookings: {
              none: {
                // Booking overlaps requested period
                pickupAt: {
                  lt: returnAt,
                },
                returnAt: {
                  gt: pickupAt,
                },

                // Only bookings that actually block the car
                status: {
  in: [
    BookingStatus.PENDING,
    BookingStatus.PAYMENT_PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.CAR_ASSIGNED,
    BookingStatus.PICKUP_SCHEDULED,
    BookingStatus.ON_THE_WAY,
    BookingStatus.ACTIVE,
  ],
},
              },
            },
          }
        : undefined,

      include: {
        images: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: cars,
    });
  } catch (error) {
    console.error("Get cars error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch cars",
    });
  }
};

export const getCarController = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const carId = Array.isArray(id) ? id[0] : id;

    const car = await prisma.car.findUnique({
      where: {
        id: carId,
      },
      include: {
        images: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Car not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: car,
    });
  } catch (error) {
    console.error("Get car error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch car",
    });
  }
};

export const updateCarController = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const carId = Array.isArray(id) ? id[0] : id;

    const validation = updateCarSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid car data",
        errors: validation.error.flatten(),
      });
    }

    const existingCar = await prisma.car.findUnique({
      where: {
        id: carId,
      },
    });

    if (!existingCar) {
      return res.status(404).json({
        success: false,
        message: "Car not found",
      });
    }

    const { images, ...carData } = validation.data;

    const updatedCar = await prisma.car.update({
      where: {
        id: carId,
      },

      data: {
        ...carData,
      },

      include: {
        images: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Car updated successfully",
      data: updatedCar,
    });
  } catch (error: any) {
    console.error("Update car error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update car",
    });
  }
};

export const deleteCarController = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const carId = Array.isArray(id) ? id[0] : id;

    const car = await prisma.car.findUnique({
      where: {
        id: carId,
      },
      include: {
        bookings: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Car not found",
      });
    }

    if (car.bookings.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "This car has booking history and cannot be deleted",
      });
    }

    await prisma.car.delete({
      where: {
        id: carId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Car deleted successfully",
    });
  } catch (error) {
    console.error("Delete car error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete car",
    });
  }
};