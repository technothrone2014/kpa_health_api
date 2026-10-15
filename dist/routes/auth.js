"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/auth.ts
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post('/login/password', authController_1.loginWithPassword);
router.post('/login/otp', authController_1.loginWithOTP);
router.post('/verify-otp', authController_1.verifyOTP);
router.post('/logout', authMiddleware_1.authMiddleware, authController_1.logout);
router.get('/me', authController_1.getCurrentUser); // No middleware here - token verification inside controller
exports.default = router;
