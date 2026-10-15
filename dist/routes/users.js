"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/users.ts
const express_1 = __importDefault(require("express"));
const usersController_1 = require("../controllers/usersController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// All routes require auth
router.use(authMiddleware_1.authMiddleware);
// Read-only endpoints (available to any authenticated staff)
router.get("/", usersController_1.getUsers);
router.get("/field-agents", usersController_1.getFieldAgents);
router.get("/:id", usersController_1.getUserById);
// Admin-only endpoints
router.get("/roles/all", usersController_1.getAllRoles);
router.get("/:id/details", usersController_1.getUserWithRoles);
router.post("/", authMiddleware_1.adminMiddleware, usersController_1.createUser);
router.put("/:id", authMiddleware_1.adminMiddleware, usersController_1.updateUser);
router.patch("/:id/status", authMiddleware_1.adminMiddleware, usersController_1.toggleUserStatus);
exports.default = router;
