import express from "express";
import authRoutes from "./routes/auth.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import carRoutes from "./routes/car.routes.js";
import emailRoutes from "./routes/auth.routes.js"
import bookingRoutes from "./routes/booking.routes.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import reviewRoutes from "./routes/reviews.routes.js";

const app = express();
app.use(cookieParser());

app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || process.env.FRONTEND_URL_PRODUCTION || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


app.use("/api/auth", authRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);



export default app;