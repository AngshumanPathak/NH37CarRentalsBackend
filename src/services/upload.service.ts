
import cloudinary from "../config/couldinary.js";

export const uploadImageToCloudinary = (
  fileBuffer: Buffer,
  folder: string = "car-rentals/cars"
): Promise<{
  secure_url: string;
  public_id: string;
}> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          return reject(error);
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

export const uploadBookingDocumentToCloudinary = (
  fileBuffer: Buffer,
  mimeType: string
): Promise<{
  secure_url: string;
  public_id: string;
}> => {
  return new Promise((resolve, reject) => {
    const resourceType = mimeType === "application/pdf"
      ? "raw"
      : "image";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "car-rentals/bookings/documents",
        resource_type: resourceType,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error);
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

