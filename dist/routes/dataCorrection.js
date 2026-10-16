"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dataCorrectionController_1 = require("../controllers/dataCorrectionController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post("/correct-stations", authMiddleware_1.authMiddleware, authMiddleware_1.adminMiddleware, dataCorrectionController_1.correctStationAssignments);
exports.default = router;
