import {
  BookingStatus,
  CarStatus,
  DocumentType,
  Prisma,
  RentalType,
  UserStatus,
} from "@prisma/client";
import prisma from "../config/prisma.js";
import {
  sendBookingReceivedCustomerEmail,
  sendNewBookingAdminAlert,
  sendBookingConfirmedCustomerEmail,
  sendBookingRejectedCustomerEmail,
  BookingEmailData,
} from "./mail.service.js";

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

const BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.PAYMENT_PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CAR_ASSIGNED,
  BookingStatus.PICKUP_SCHEDULED,
  BookingStatus.ON_THE_WAY,
  BookingStatus.ACTIVE,
];

// Helper to assemble email payload from Prisma Booking
const mapBookingToEmailData = (booking: any, extra?: { rejectionReason?: string | null; adminNote?: string | null }): BookingEmailData => {
  const carName = booking.car ? `${booking.car.brand} ${booking.car.model}` : "Car Rental";

  return {
    bookingNumber: booking.bookingNumber,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    carName,
    pickupLocation: booking.pickupLocation,
    dropLocation: booking.dropLocation,
    pickupAt: booking.pickupAt,
    returnAt: booking.returnAt,
    rentalDays: booking.rentalDays,
    rentalHours: booking.rentalHours,
    rentalAmount: booking.rentalAmount.toString(),
    securityDeposit: booking.securityDeposit.toString(),
    totalAmount: booking.totalAmount.toString(),
    rejectionReason: extra?.rejectionReason ?? booking.rejectionReason,
    adminNote: extra?.adminNote,
  };
};

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
  const remainingHours = remainingMs > 0 ? Math.ceil(remainingMs / hourMs) : 0;

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

  if (fullDays > 0) {
    rentalAmount = rentalAmount.add(pricePerDay.mul(fullDays));
  }

  if (remainingHours > 0) {
    if (pricePerHour) {
      rentalAmount = rentalAmount.add(pricePerHour.mul(remainingHours));
    } else {
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

const checkAvailability = async (
  carId: string,
  pickupAt: Date,
  returnAt: Date,
  tx: typeof prisma = prisma
) => {
  const car = await tx.car.findUnique({ where: { id: carId } });
  if (!car) throw new Error("Car not found");

  if (
    car.status === CarStatus.MAINTENANCE ||
    car.status === CarStatus.OUT_OF_SERVICE
  ) {
    return { available: false, reason: "Car is currently unavailable" };
  }

  const conflictingBooking = await tx.booking.findFirst({
    where: {
      carId,
      status: { in: BLOCKING_BOOKING_STATUSES },
      pickupAt: { lt: returnAt },
      returnAt: { gt: pickupAt },
    },
    select: { id: true },
  });

  if (conflictingBooking) {
    return {
      available: false,
      reason: "Car is already booked for the selected period",
    };
  }

  return { available: true, reason: null };
};

export const checkCarAvailability = async (
  carId: string,
  pickupAt: Date,
  returnAt: Date
) => {
  const now = new Date();
  if (pickupAt <= now) throw new Error("Pickup date must be in the future");
  if (returnAt <= pickupAt) throw new Error("Return date must be after pickup date");

  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) throw new Error("Car not found");

  const availability = await checkAvailability(carId, pickupAt, returnAt);
  if (!availability.available) {
    return { available: false, reason: availability.reason, pricing: null };
  }

  const pricing = calculateRentalAmount(pickupAt, returnAt, RentalType.SELF_DRIVE, car);
  const securityDeposit = car.securityDepositSelfDrive ?? new Prisma.Decimal(0);
  const totalAmount = pricing.rentalAmount.add(securityDeposit);

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

const generateBookingNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(100000 + Math.random() * 900000);
  return `NH37-${year}${month}${day}-${random}`;
};

// ============================================================
// CREATE BOOKING (Dispatches: Customer receipt + Admin alert)
// ============================================================

export const createBooking = async (userId: string, data: CreateBookingData) => {
  const now = new Date();

  if (data.pickupAt <= now) throw new Error("Pickup date must be in the future");
  if (data.returnAt <= data.pickupAt) throw new Error("Return date must be after pickup date");
  if (data.rentalType !== RentalType.SELF_DRIVE) {
    throw new Error("Only self-drive bookings are currently supported");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, status: true },
  });

  if (!user) throw new Error("User not found");
  if (user.status !== UserStatus.ACTIVE) throw new Error("Your account is not active");

  const result = await prisma.$transaction(
    async (tx) => {
      const car = await tx.car.findUnique({ where: { id: data.carId } });
      if (!car) throw new Error("Car not found");

      if (
        car.status === CarStatus.MAINTENANCE ||
        car.status === CarStatus.OUT_OF_SERVICE
      ) {
        throw new Error("Car is currently unavailable");
      }

      const conflictingBooking = await tx.booking.findFirst({
        where: {
          carId: data.carId,
          status: { in: BLOCKING_BOOKING_STATUSES },
          pickupAt: { lt: data.returnAt },
          returnAt: { gt: data.pickupAt },
        },
        select: { id: true },
      });

      if (conflictingBooking) {
        throw new Error("Car is already booked for the selected period");
      }

      const pricing = calculateRentalAmount(data.pickupAt, data.returnAt, RentalType.SELF_DRIVE, car);
      const securityDeposit = car.securityDepositSelfDrive ?? new Prisma.Decimal(0);
      const totalAmount = pricing.rentalAmount.add(securityDeposit);
      const bookingNumber = generateBookingNumber();

      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          customerName: user.name,
          customerEmail: user.email,
          customerPhone: user.phone,
          pickupLocation: data.pickupLocation,
          dropLocation: data.dropLocation ?? null,
          pickupLatitude: data.pickupLatitude ?? null,
          pickupLongitude: data.pickupLongitude ?? null,
          dropLatitude: data.dropLatitude ?? null,
          dropLongitude: data.dropLongitude ?? null,
          pickupAt: data.pickupAt,
          returnAt: data.returnAt,
          rentalType: RentalType.SELF_DRIVE,
          rentalDays: pricing.fullDays,
          rentalHours: pricing.remainingHours,
          pricePerDay: pricing.pricePerDay,
          pricePerHour: pricing.pricePerHour,
          rentalAmount: pricing.rentalAmount,
          securityDeposit,
          totalAmount,
          status: BookingStatus.PENDING,
          userId,
          carId: data.carId,
          statusHistory: {
            create: {
              status: BookingStatus.PENDING,
              note: "Booking created by customer",
              changedById: userId,
            },
          },
          documents:
            data.documents && data.documents.length > 0
              ? {
                  create: data.documents.map((doc) => ({
                    type: doc.type,
                    url: doc.url,
                    publicId: doc.publicId ?? null,
                  })),
                }
              : undefined,
        },
        include: {
          car: { include: { images: true } },
          documents: true,
          statusHistory: { orderBy: { createdAt: "desc" } },
        },
      });

      return {
        booking,
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
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  // Background mail dispatch (won't fail API response if email network errors)
  const emailPayload = mapBookingToEmailData(result.booking);
  Promise.allSettled([
    sendBookingReceivedCustomerEmail(emailPayload),
    sendNewBookingAdminAlert(emailPayload),
  ]).catch((err) => console.error("Error triggering booking creation emails:", err));

  return result;
};

// ============================================================
// CONFIRM BOOKING - ADMIN (Dispatches: Customer confirmation)
// ============================================================

export const confirmBooking = async (
  bookingId: string,
  adminId: string,
  note?: string
) => {
  const updatedBooking = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error("Booking not found");

    if (booking.status !== BookingStatus.PENDING) {
      throw new Error(`Booking cannot be confirmed from ${booking.status}`);
    }

    const car = await tx.car.findUnique({ where: { id: booking.carId } });
    if (!car) throw new Error("Car not found");

    if (
      car.status === CarStatus.MAINTENANCE ||
      car.status === CarStatus.OUT_OF_SERVICE
    ) {
      throw new Error("Car is currently unavailable");
    }

    const conflictingBooking = await tx.booking.findFirst({
      where: {
        id: { not: booking.id },
        carId: booking.carId,
        status: { in: BLOCKING_BOOKING_STATUSES },
        pickupAt: { lt: booking.returnAt },
        returnAt: { gt: booking.pickupAt },
      },
      select: { id: true },
    });

    if (conflictingBooking) {
      throw new Error("Car is no longer available for this booking period");
    }

    return tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CONFIRMED,
        statusHistory: {
          create: {
            status: BookingStatus.CONFIRMED,
            note: note || "Booking confirmed by admin",
            changedById: adminId,
          },
        },
      },
      include: {
        car: { include: { images: true } },
        documents: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
        payment: true,
      },
    });
  });

  // Background mail dispatch
  const emailPayload = mapBookingToEmailData(updatedBooking, { adminNote: note });
  sendBookingConfirmedCustomerEmail(emailPayload).catch((err) =>
    console.error("Error sending booking confirmation email:", err)
  );

  return updatedBooking;
};

// ============================================================
// REJECT BOOKING - ADMIN (Dispatches: Customer rejection update)
// ============================================================

export const rejectBooking = async (bookingId: string, reason?: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) throw new Error("Booking not found");

  if (booking.status !== BookingStatus.PENDING) {
    throw new Error(`Booking cannot be rejected from ${booking.status} status`);
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.REJECTED,
      rejectionReason: reason?.trim() || null,
      statusHistory: {
        create: {
          status: BookingStatus.REJECTED,
          note: reason?.trim() || "Booking rejected by admin",
        },
      },
    },
    include: {
      car: true,
    },
  });

  // Background mail dispatch
  const emailPayload = mapBookingToEmailData(updatedBooking, { rejectionReason: reason });
  sendBookingRejectedCustomerEmail(emailPayload).catch((err) =>
    console.error("Error sending booking rejection email:", err)
  );

  return updatedBooking;
};

export const getMyBookings = async (userId: string) => {
  return prisma.booking.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      car: { include: { images: true } },
      documents: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payment: true,
    },
  });
};

export const getBookingById = async (bookingId: string, userId: string) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: {
      car: { include: { images: true } },
      documents: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payment: true,
    },
  });
  if (!booking) throw new Error("Booking not found");
  return booking;
};

export const getAllBookings = async () => {
  return prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      car: { include: { images: true } },
      documents: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payment: true,
    },
  });
};

export const getAdminBookingById = async (bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      car: { include: { images: true } },
      documents: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payment: true,
    },
  });
  if (!booking) throw new Error("Booking not found");
  return booking;
};