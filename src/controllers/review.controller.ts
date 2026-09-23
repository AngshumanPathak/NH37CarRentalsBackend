// controllers/reviewController.js
import { fetchGoogleReviews } from "../services/reviews.service.js";
import { Request, Response } from "express";

export const getReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await fetchGoogleReviews();
    // Returns an array directly so your frontend `return data;` works as expected
    return res.status(200).json(reviews);
  } catch (error: any) {
    console.error("Controller Error - getReviews:", error.message);
      const newLocal = "Failed to retrieve Google reviews.";
    return res.status(500).json({
      message: newLocal,
      error: error.message,
    });
  }
};