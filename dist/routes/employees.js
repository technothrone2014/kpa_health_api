"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const employeesController_1 = require("../controllers/employeesController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.use(authMiddleware_1.authMiddleware);
router.get("/", employeesController_1.getAllEmployees);
router.get("/:id", employeesController_1.getEmployeeById);
router.post("/", authMiddleware_1.adminMiddleware, employeesController_1.createEmployee);
router.put("/:id", authMiddleware_1.adminMiddleware, employeesController_1.updateEmployee);
router.delete("/:id", authMiddleware_1.adminMiddleware, employeesController_1.deleteEmployee);
exports.default = router;
