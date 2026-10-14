// routes/users.ts
import express from "express";
import {
  getUsers,
  getFieldAgents,
  getUserById,
  getUserWithRoles,
  createUser,
  updateUser,
  toggleUserStatus,
  getAllRoles,
} from "../controllers/usersController";
import { authMiddleware, adminMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

// All routes require auth
router.use(authMiddleware);

// Read-only endpoints (available to any authenticated staff)
router.get("/", getUsers);
router.get("/field-agents", getFieldAgents);
router.get("/:id", getUserById);

// Admin-only endpoints
router.get("/roles/all", getAllRoles);
router.get("/:id/details", getUserWithRoles);
router.post("/", adminMiddleware, createUser);
router.put("/:id", adminMiddleware, updateUser);
router.patch("/:id/status", adminMiddleware, toggleUserStatus);

export default router;