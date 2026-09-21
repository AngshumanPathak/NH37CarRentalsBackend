
import { Request, Response } from "express";
import {
  uploadImageToCloudinary,
  uploadBookingDocumentToCloudinary,
} from "../services/upload.service.js";

export const uploadCarImages = async (
  req: Request,
  res: Response
) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images uploaded",
      });
    }

    const uploadedImages = await Promise.all(
      files.map((file) =>
        uploadImageToCloudinary(
          file.buffer,
          "car-rentals/cars"
        )
      )
    );

    const images = uploadedImages.map((image) => ({
      url: image.secure_url,
      publicId: image.public_id,
    }));

    return res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: images,
    });
  } catch (error) {
    console.error("Image upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload images",
    });
  }
};

export const uploadBookingDocuments = async (
  req: Request,
  res: Response
) => {
  try {
    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    if (!files) {
      return res.status(400).json({
        success: false,
        message: "No documents uploaded",
      });
    }

    const documentFields = [
      {
        fieldName: "drivingLicense",
        type: "DRIVING_LICENSE" as const,
      },
      {
        fieldName: "aadhaar",
        type: "AADHAAR" as const,
      },
      {
        fieldName: "voterId",
        type: "VOTER_ID" as const,
      },
    ];

    const documents: {
      type:
        | "DRIVING_LICENSE"
        | "AADHAAR"
        | "VOTER_ID";
      url: string;
      publicId: string;
    }[] = [];

    for (const field of documentFields) {
      const file = files[field.fieldName]?.[0];

      if (!file) {
        continue;
      }

      const uploaded =
        await uploadBookingDocumentToCloudinary(
          file.buffer,
          file.mimetype
        );

      documents.push({
        type: field.type,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      });
    }

    if (documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid documents uploaded",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Documents uploaded successfully",
      data: documents,
    });
  } catch (error) {
    console.error(
      "Booking document upload error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to upload booking documents",
    });
  }
};

