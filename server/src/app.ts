import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { notFound } from "./middleware/not-found";
import { errorHandler } from "./middleware/error-handler";
import { requireSameOriginForMutations } from "./middleware/same-origin";
import accountingRoutes from "./modules/accounting/accounting.routes";
import auditRoutes from "./modules/audit/audit.routes";
import authRoutes from "./modules/auth/auth.routes";
import companyRoutes from "./modules/company/company.routes";
import commercialMasterRoutes from "./modules/commercial-masters/commercial-masters.routes";
import financialYearRoutes from "./modules/financial-year/financial-year.routes";
import inventoryRoutes from "./modules/inventory/inventory.routes";
import mastersRoutes from "./modules/masters/masters.routes";
import notesRoutes from "./modules/notes/notes.routes";
import numberSeriesRoutes from "./modules/number-series/number-series.routes";
import paymentRoutes from "./modules/payments/payments.routes";
import purchaseRoutes from "./modules/purchase/purchase.routes";
import salesRoutes from "./modules/sales/sales.routes";
import systemRoutes from "./modules/system/system.routes";
import workshopRoutes from "./modules/workshop/workshop.routes";

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
app.use(requireSameOriginForMutations);

app.use("/api", authRoutes);
app.use("/api", systemRoutes);
app.use("/api/system", systemRoutes);
app.use("/api", accountingRoutes);
app.use("/api", auditRoutes);
app.use("/api", companyRoutes);
app.use("/api", commercialMasterRoutes);
app.use("/api", financialYearRoutes);
app.use("/api", inventoryRoutes);
app.use("/api", mastersRoutes);
app.use("/api", notesRoutes);
app.use("/api", numberSeriesRoutes);
app.use("/api", paymentRoutes);
app.use("/api", purchaseRoutes);
app.use("/api", salesRoutes);
app.use("/api", workshopRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
