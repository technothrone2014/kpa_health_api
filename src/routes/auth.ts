import express from 'express';
import { 
  loginWithPassword,
  loginWithOTP,
  verifyOTP, 
  logout, 
  verifyToken, 
  getCurrentUser, 
  getAuditTrail 
} from '../controllers/authController.js';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login/password', loginWithPassword);
router.post('/login/otp', loginWithOTP);
router.post('/verify-otp', verifyOTP);
router.get('/verify', verifyToken);

// Protected routes (require authentication)
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getCurrentUser);

// Admin only routes
router.get('/audit', authMiddleware, adminMiddleware, getAuditTrail);

export default router;
