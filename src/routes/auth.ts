import express from 'express';
import { 
  login, verifyOTP, logout, verifyToken, getCurrentUser, getAuditTrail 
} from '../controllers/authController';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/logout', authMiddleware, logout);
router.get('/verify', verifyToken);
router.get('/me', authMiddleware, getCurrentUser);
router.get('/audit', authMiddleware, adminMiddleware, getAuditTrail);

export default router;