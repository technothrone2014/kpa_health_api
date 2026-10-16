import express from "express";
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employeesController";
import { authMiddleware, adminMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.use(authMiddleware);
router.get("/", getAllEmployees);
router.get("/:id", getEmployeeById);
router.post("/", adminMiddleware, createEmployee);
router.put("/:id", adminMiddleware, updateEmployee);
router.delete("/:id", adminMiddleware, deleteEmployee);

export default router;
