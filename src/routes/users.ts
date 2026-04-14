// routes/users.ts
import express from "express";
import { getUsers, getFieldAgents, getUserById } from "../controllers/usersController";

const router = express.Router();

// GET /api/v1/users - Get all users (optionally filter by role)
router.get("/", getUsers);

// GET /api/v1/users/field-agents - Get field agents only
router.get("/field-agents", getFieldAgents);

// GET /api/v1/users/:id - Get user by ID
router.get("/:id", getUserById);

export default router;
