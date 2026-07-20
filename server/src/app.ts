import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import prisma from "./lib/prisma";
import { notFound } from "./middleware/not-found";
import { errorHandler } from "./middleware/error-handler";

const app = express();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health Check Route
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      database: "Connected",
      message: "RAMS Backend is Running 🚀",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      database: "Disconnected",
      error,
    });
  }
});

app.use(notFound);
app.use(errorHandler);

export default app;