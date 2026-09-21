
import {
  BookingStatus,
  CarStatus,
  DocumentType,
  Prisma,
  RentalType,
  UserStatus,
} from "@prisma/client";

import prisma from "../config/prisma.js";

// ============================================================
// TYPES
// ============================================================

interface BookingDocumentInput {
  type: DocumentType;
  url: string;
  publicId?: string | null;
}

export interface CreateBookingData {
  carId: string;
  rentalType: RentalType;

  pickupLocation: string;
  dropLocation?: string | null;

  pickupLatitude?: number | null;
  pickupLongitude?: number | null;

  dropLatitude?: number | null;
  dropLongitude?: number | null;

  pickupAt: Date;
  returnAt: Date;

  documents?: BookingDocumentInput[];
}

// ============================================================
// BOOKING STATUSES THAT BLOCK CAR AVAILABILITY
// ============================================================

const BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.PAYMENT_PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CAR_ASSIGNED,
  BookingStatus.PICKUP_SCHEDULED,
  BookingStatus.ON_THE_WAY,
  BookingStatus.ACTIVE,
];

// ============================================================
// PRICING CALCULATION
// ============================================================

const calculateRentalAmount = (
  pickupAt: Date,
  returnAt: Date,
  rentalType: RentalType,
  car: any
) => {
  const durationMs = returnAt.getTime() - pickupAt.getTime();

  if (durationMs <= 0) {
    throw new Error("Return date must be after pickup date");
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  const fullDays = Math.floor(durationMs / dayMs);

  const remainingMs = durationMs % dayMs;

  const remainingHours =
    remainingMs > 0
      ? Math.ceil(remainingMs / hourMs)
      : 0;

  let pricePerDay: Prisma.Decimal;
  let pricePerHour: Prisma.Decimal | null;

  if (rentalType === RentalType.SELF_DRIVE) {
    pricePerDay = car.pricePerDaySelfDrive;
    pricePerHour = car.pricePerHourSelfDrive;
  } else {
    pricePerDay = car.pricePerDayWithDriver;
    pricePerHour = car.pricePerHourWithDriver;
  }

  let rentalAmount = new Prisma.Decimal(0);

  // ----------------------------------------------------------
  // FULL DAYS
  // ----------------------------------------------------------

  if (fullDays > 0) {
    rentalAmount = rentalAmount.add(
      pricePerDay.mul(fullDays)
    );
  }

  // ----------------------------------------------------------
  // REMAINING HOURS
  // ----------------------------------------------------------

  if (remainingHours > 0) {
    if (pricePerHour) {
      rentalAmount = rentalAmount.add(
        pricePerHour.mul(remainingHours)
      );
    } else {
      // No hourly price configured.
      // Charge one additional full day.
      rentalAmount = rentalAmount.add(pricePerDay);
    }
  }

  return {
    rentalAmount,
    fullDays,
    remainingHours,
    pricePerDay,
    pricePerHour,
  };
};

// ============================================================
// CHECK CAR AVAILABILITY
// ============================================================

const checkAvailability = async (
  carId: string,
  pickupAt: Date,
  returnAt: Date,
  tx: typeof prisma = prisma
) => {
  const car = await tx.car.findUnique({
    where: {
      id: carId,
    },
  });

  if (!car) {
    throw new Error("Car not found");
  }

  // ----------------------------------------------------------
  // CHECK CAR STATUS
  // ----------------------------------------------------------

  if (
    car.status === CarStatus.MAINTENANCE ||
    car.status === CarStatus.OUT_OF_SERVICE
  ) {
    return {
      available: false,
      reason: "Car is currently unavailable",
    };
  }

  // ----------------------------------------------------------
  // CHECK OVERLAPPING BOOKINGS
  // ----------------------------------------------------------

  const conflictingBooking =
    await tx.booking.findFirst({
      where: {
        carId,

        status: {
          in: BLOCKING_BOOKING_STATUSES,
        },

        pickupAt: {
          lt: returnAt,
        },

        returnAt: {
          gt: pickupAt,
        },
      },

      select: {
        id: true,
      },
    });

  if (conflictingBooking) {
    return {
      available: false,
      reason:
        "Car is already booked for the selected period",
    };
  }

  return {
    available: true,
    reason: null,
  };
};

// ============================================================
// PUBLIC AVAILABILITY CHECK
// ============================================================

export const checkCarAvailability = async (
  carId: string,
  pickupAt: Date,
  returnAt: Date
) => {
  const now = new Date();

  // ----------------------------------------------------------
  // DATE VALIDATION
  // ----------------------------------------------------------

  if (pickupAt <= now) {
    throw new Error(
      "Pickup date must be in the future"
    );
  }

  if (returnAt <= pickupAt) {
    throw new Error(
      "Return date must be after pickup date"
    );
  }

  // ----------------------------------------------------------
  // FIND CAR
  // ----------------------------------------------------------

  const car = await prisma.car.findUnique({
    where: {
      id: carId,
    },
  });

  if (!car) {
    throw new Error("Car not found");
  }

  // ----------------------------------------------------------
  // CHECK AVAILABILITY
  // ----------------------------------------------------------

  const availability = await checkAvailability(
    carId,
    pickupAt,
    returnAt
  );

  if (!availability.available) {
    return {
      available: false,
      reason: availability.reason,
      pricing: null,
    };
  }

  // ----------------------------------------------------------
  // CALCULATE PRICING
  // ----------------------------------------------------------

  const pricing = calculateRentalAmount(
    pickupAt,
    returnAt,
    RentalType.SELF_DRIVE,
    car
  );

  // ----------------------------------------------------------
  // SECURITY DEPOSIT
  // ----------------------------------------------------------

  const securityDeposit =
    car.securityDepositSelfDrive ??
    new Prisma.Decimal(0);

  // ----------------------------------------------------------
  // TOTAL
  // ----------------------------------------------------------

  const totalAmount =
    pricing.rentalAmount.add(
      securityDeposit
    );

  return {
    available: true,
    reason: null,

    pricing: {
      rentalAmount: pricing.rentalAmount,
      securityDeposit,
      totalAmount,

      fullDays: pricing.fullDays,
      remainingHours: pricing.remainingHours,

      pricePerDay: pricing.pricePerDay,
      pricePerHour: pricing.pricePerHour,
    },
  };
};

// ============================================================
// CREATE BOOKING
// ============================================================

export const createBooking = async (
  userId: string,
  data: CreateBookingData
) => {
  const now = new Date();

  // ----------------------------------------------------------
  // BASIC DATE VALIDATION
  // ----------------------------------------------------------

  if (data.pickupAt <= now) {
    throw new Error(
      "Pickup date must be in the future"
    );
  }

  if (data.returnAt <= data.pickupAt) {
    throw new Error(
      "Return date must be after pickup date"
    );
  }

  // ----------------------------------------------------------
  // CURRENTLY ONLY SELF DRIVE
  // ----------------------------------------------------------

  if (
    data.rentalType !== RentalType.SELF_DRIVE
  ) {
    throw new Error(
      "Only self-drive bookings are currently supported"
    );
  }

  // ----------------------------------------------------------
  // FIND USER
  // ----------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new Error(
      "Your account is not active"
    );
  }

  // ----------------------------------------------------------
  // SERIALIZABLE TRANSACTION
  // ----------------------------------------------------------

  return prisma.$transaction(
    async (tx) => {
      // ------------------------------------------------------
      // GET CAR
      // ------------------------------------------------------

      const car = await tx.car.findUnique({
        where: {
          id: data.carId,
        },
      });

      if (!car) {
        throw new Error("Car not found");
      }

      // ------------------------------------------------------
      // CHECK CAR STATUS
      // ------------------------------------------------------

      if (
        car.status === CarStatus.MAINTENANCE ||
        car.status === CarStatus.OUT_OF_SERVICE
      ) {
        throw new Error(
          "Car is currently unavailable"
        );
      }

      // ------------------------------------------------------
      // RE-CHECK BOOKING CONFLICT
      //
      // IMPORTANT:
      // Never trust the previous availability check.
      // Another customer may have booked the car
      // between availability check and booking creation.
      // ------------------------------------------------------

      const conflictingBooking =
        await tx.booking.findFirst({
          where: {
            carId: data.carId,

            status: {
              in: BLOCKING_BOOKING_STATUSES,
            },

            pickupAt: {
              lt: data.returnAt,
            },

            returnAt: {
              gt: data.pickupAt,
            },
          },

          select: {
            id: true,
          },
        });

      if (conflictingBooking) {
        throw new Error(
          "Car is already booked for the selected period"
        );
      }

      // ------------------------------------------------------
      // CALCULATE PRICE ON SERVER
      // ------------------------------------------------------

      const pricing = calculateRentalAmount(
        data.pickupAt,
        data.returnAt,
        RentalType.SELF_DRIVE,
        car
      );

      // ------------------------------------------------------
      // SECURITY DEPOSIT
      // ------------------------------------------------------

      const securityDeposit =
        car.securityDepositSelfDrive ??
        new Prisma.Decimal(0);

      // ------------------------------------------------------
      // FINAL TOTAL
      // ------------------------------------------------------

      const totalAmount =
        pricing.rentalAmount.add(
          securityDeposit
        );

      // ------------------------------------------------------
      // BOOKING NUMBER
      // ------------------------------------------------------

      const bookingNumber =
        generateBookingNumber();

      // ------------------------------------------------------
      // CREATE BOOKING
      // ------------------------------------------------------

      const booking =
        await tx.booking.create({
          data: {
            bookingNumber,

            // ------------------------------------------------
            // CUSTOMER SNAPSHOT
            // ------------------------------------------------

            customerName: user.name,
            customerEmail: user.email,
            customerPhone: user.phone,

            // ------------------------------------------------
            // LOCATIONS
            // ------------------------------------------------

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

            // ------------------------------------------------
            // RENTAL PERIOD
            // ------------------------------------------------

            pickupAt: data.pickupAt,
            returnAt: data.returnAt,

            rentalType:
              RentalType.SELF_DRIVE,

            // ------------------------------------------------
            // PRICING SNAPSHOT
            // ------------------------------------------------

            rentalDays:
              pricing.fullDays,

            rentalHours:
              pricing.remainingHours,

            pricePerDay:
              pricing.pricePerDay,

            pricePerHour:
              pricing.pricePerHour,

            rentalAmount:
              pricing.rentalAmount,

            securityDeposit,

            totalAmount,

            // ------------------------------------------------
            // INITIAL STATUS
            // ------------------------------------------------

            status:
              BookingStatus.PENDING,

            // ------------------------------------------------
            // RELATIONS
            // ------------------------------------------------

            userId,
            carId: data.carId,

            // ------------------------------------------------
            // STATUS HISTORY
            // ------------------------------------------------

            statusHistory: {
              create: {
                status:
                  BookingStatus.PENDING,

                note:
                  "Booking created by customer",

                changedById: userId,
              },
            },

            // ------------------------------------------------
            // DOCUMENTS
            // ------------------------------------------------

            documents:
              data.documents &&
              data.documents.length > 0
                ? {
                    create:
                      data.documents.map(
                        (document) => ({
                          type: document.type,

                          url: document.url,

                          publicId:
                            document.publicId ??
                            null,
                        })
                      ),
                  }
                : undefined,
          },

          include: {
            car: {
              include: {
                images: true,
              },
            },

            documents: true,

            statusHistory: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        });

      // ------------------------------------------------------
      // RETURN BOOKING + SERVER CALCULATED PRICING
      // ------------------------------------------------------

      return {
        booking,

        pricing: {
          rentalAmount:
            pricing.rentalAmount,

          securityDeposit,

          totalAmount,

          fullDays:
            pricing.fullDays,

          remainingHours:
            pricing.remainingHours,

          pricePerDay:
            pricing.pricePerDay,

          pricePerHour:
            pricing.pricePerHour,
        },
      };
    },

    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

// ============================================================
// GET CUSTOMER BOOKINGS
// ============================================================

export const getMyBookings = async (
  userId: string
) => {
  const bookings =
    await prisma.booking.findMany({
      where: {
        userId,
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {
        car: {
          include: {
            images: true,
          },
        },

        documents: true,

        statusHistory: {
          orderBy: {
            createdAt: "asc",
          },
        },

        payment: true,
      },
    });

  return bookings;
};

// ============================================================
// GENERATE BOOKING NUMBER
// ============================================================

const generateBookingNumber = () => {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  const random = Math.floor(
    100000 + Math.random() * 900000
  );

  return `NH37-${year}${month}${day}-${random}`;
};


// ============================================================
// GET BOOKING BY ID
// ============================================================

export const getBookingById = async (
  bookingId: string,
  userId: string
) => {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },

    include: {
      car: {
        include: {
          images: true,
        },
      },

      documents: true,

      statusHistory: {
        orderBy: {
          createdAt: "asc",
        },
      },

      payment: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  return booking;
};



// ============================================================
// GET ALL BOOKINGS - ADMIN
// ============================================================

export const getAllBookings = async () => {
  try {
    console.log("====================================");
    console.log("GET ALL BOOKINGS - ADMIN");
    console.log("Starting Prisma query...");
    console.log("====================================");

    const bookings = await prisma.booking.findMany({
      orderBy: {
        createdAt: "desc",
      },

      include: {
        car: {
          include: {
            images: true,
          },
        },

        documents: true,

        statusHistory: {
          orderBy: {
            createdAt: "asc",
          },
        },

        payment: true,
      },
    });

    console.log(
      "Admin bookings fetched:",
      bookings.length
    );

    return bookings;
  } catch (error) {
    console.error(
      "===================================="
    );

    console.error(
      "GET ALL BOOKINGS PRISMA ERROR:"
    );

    console.error(error);

    console.error(
      "===================================="
    );

    throw error;
  }
};



// ============================================================
// GET BOOKING BY ID - ADMIN
// ============================================================

export const getAdminBookingById = async (
  bookingId: string
) => {
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },

    include: {
      car: {
        include: {
          images: true,
        },
      },

      documents: true,

      statusHistory: {
        orderBy: {
          createdAt: "asc",
        },
      },

      payment: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  return booking;
};




// ============================================================
// CONFIRM BOOKING - ADMIN
// ============================================================

export const confirmBooking = async (
  bookingId: string,
  adminId: string,
  note?: string
) => {
  return prisma.$transaction(async (tx) => {
    // --------------------------------------------------------
    // FIND BOOKING
    // --------------------------------------------------------

    const booking = await tx.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    // --------------------------------------------------------
    // ONLY PENDING BOOKINGS CAN BE CONFIRMED
    // --------------------------------------------------------

    if (booking.status !== BookingStatus.PENDING) {
      throw new Error(
        `Booking cannot be confirmed from ${booking.status}`
      );
    }

    // --------------------------------------------------------
    // CHECK CAR STATUS
    // --------------------------------------------------------

    const car = await tx.car.findUnique({
      where: {
        id: booking.carId,
      },
    });

    if (!car) {
      throw new Error("Car not found");
    }

    if (
      car.status === CarStatus.MAINTENANCE ||
      car.status === CarStatus.OUT_OF_SERVICE
    ) {
      throw new Error(
        "Car is currently unavailable"
      );
    }

    // --------------------------------------------------------
    // RE-CHECK OVERLAPPING BOOKINGS
    //
    // IMPORTANT:
    // Exclude the current booking because it is itself PENDING.
    // --------------------------------------------------------

    const conflictingBooking =
      await tx.booking.findFirst({
        where: {
          id: {
            not: booking.id,
          },

          carId: booking.carId,

          status: {
            in: BLOCKING_BOOKING_STATUSES,
          },

          pickupAt: {
            lt: booking.returnAt,
          },

          returnAt: {
            gt: booking.pickupAt,
          },
        },

        select: {
          id: true,
          bookingNumber: true,
          status: true,
        },
      });

    if (conflictingBooking) {
      throw new Error(
        "Car is no longer available for this booking period"
      );
    }

    // --------------------------------------------------------
    // UPDATE BOOKING
    // --------------------------------------------------------

    const updatedBooking =
      await tx.booking.update({
        where: {
          id: booking.id,
        },

        data: {
          status: BookingStatus.CONFIRMED,

          statusHistory: {
            create: {
              status:
                BookingStatus.CONFIRMED,

              note:
                note ||
                "Booking confirmed by admin",

              changedById: adminId,
            },
          },
        },

        include: {
          car: {
            include: {
              images: true,
            },
          },

          documents: true,

          statusHistory: {
            orderBy: {
              createdAt: "asc",
            },
          },

          payment: true,
        },
      });

    return updatedBooking;
  });
};


export const rejectBooking = async (
  bookingId: string,
  reason?: string
) => {
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  // Only pending bookings can be rejected
  if (booking.status !== "PENDING") {
    throw new Error(
      `Booking cannot be rejected from ${booking.status} status`
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      status: "REJECTED",
      rejectionReason: reason?.trim() || null,
    },
  });

  return updatedBooking;
};