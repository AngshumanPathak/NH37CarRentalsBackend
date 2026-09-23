// routes/reviewRoutes.js
import express from "express";
import { getReviews } from "../controllers/review.controller.js";

const router = express.Router();

// Defines the GET /reviews endpoint
router.get("/reviews", getReviews);

export default router;