// routes/auth.ts
import express from 'express';
import { 
  loginWithPassword, 
  loginWithOTP, 
  verifyOTP, 
  logout, 
  getCurrentUser  // Make sure this is imported
} from '../controllers/authController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login/password', loginWithPassword);
router.post('/login/otp', loginWithOTP);
router.post('/verify-otp', verifyOTP);
router.post('/logout', authMiddleware, logout);
router.get('/me', getCurrentUser);  // No middleware here - token verification inside controller

export default router;