import express from "express";
import { correctStationAssignments } from "../controllers/dataCorrectionController";

const router = express.Router();

router.post("/correct-stations", correctStationAssignments);

export default router;
