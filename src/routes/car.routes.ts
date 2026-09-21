import { Router } from "express";

import {
  createCarController,
  getCarsController,
  getCarController,
  updateCarController,
  deleteCarController,
} from "../controllers/car.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

import { UserRole } from "@prisma/client";

const router = Router();

// Public
router.get("/", getCarsController);
router.get("/:id", getCarController);

// Admin / Fleet Manager
router.post(
  "/",
  authenticate,
  authorize(UserRole.ADMIN, UserRole.FLEET_MANAGER),
  createCarController
);

router.patch(
  "/:id",
  authenticate,
  authorize(UserRole.ADMIN, UserRole.FLEET_MANAGER),
  updateCarController
);

// Admin only
router.delete(
  "/:id",
  authenticate,
  authorize(UserRole.ADMIN),
  deleteCarController
);

export default router;