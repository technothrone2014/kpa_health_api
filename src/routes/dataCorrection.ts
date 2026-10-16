import express from "express";
import { correctStationAssignments } from "../controllers/dataCorrectionController";
import { adminMiddleware, authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/correct-stations", authMiddleware, adminMiddleware, correctStationAssignments);

export default router;
