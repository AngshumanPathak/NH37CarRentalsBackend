
import { Router } from "express";

import { upload } from "../middleware/upload.middleware.js";
import {
  uploadBookingDocuments,
  uploadCarImages,
} from "../controllers/upload.controller.js";

import { uploadBookingDocuments as bookingDocumentUpload } from "../middleware/document-upload.middleware.js";

const router = Router();

/*
 * Car images
 */
router.post(
  "/cars/images",
  upload.array("images", 10),
  uploadCarImages
);

/*
 * Booking verification documents
 *
 * Supported fields:
 * - drivingLicense
 * - aadhaar
 * - voterId
 */
router.post(
  "/bookings/documents",
  bookingDocumentUpload.fields([
    {
      name: "drivingLicense",
      maxCount: 1,
    },
    {
      name: "aadhaar",
      maxCount: 1,
    },
    {
      name: "voterId",
      maxCount: 1,
    },
  ]),
  uploadBookingDocuments
);

export default router;

