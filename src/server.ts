import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import employeesRouter from "./routes/employees";
import dataCorrectionRoutes from "./routes/dataCorrection";

dotenv.config();

const app = express();

/**
 * 🌍 CORS Configuration
 * Allow your frontend (local or deployed) to access the API
 */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*", // e.g. http://localhost:5173 or your hosted frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());

/**
 * 🩺 Health check route
 */
app.get("/", (_req, res) => {
  res.send("🩺 KPA Health Intelligence API (TypeScript + ESM) is running...");
});

/**
 * 👩‍⚕️ Employee routes (versioned for future-proofing)
 */
app.use("/api/v1/employees", employeesRouter);

app.use("/api/data-correction", dataCorrectionRoutes);

/**
 * ❌ 404 handler
 */
app.use((_req, res) => res.status(404).json({ message: "Route not found" }));


/**
 * 💥 Global error handler
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("🔥 Server Error:", err);
  res
    .status(500)
    .json({ message: "Internal Server Error", error: err.message });
});

/**
 * 🚀 Start server
 */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server ready at http://localhost:${PORT}`));
