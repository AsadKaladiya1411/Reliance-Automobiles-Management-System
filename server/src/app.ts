import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { notFound } from "./middleware/not-found";
import { errorHandler } from "./middleware/error-handler";
import authRoutes from "./modules/auth/auth.routes";
import systemRoutes from "./modules/system/system.routes";

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use("/api", authRoutes);
app.use("/api", systemRoutes);
app.use("/api/system", systemRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
