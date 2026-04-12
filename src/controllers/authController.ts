import { Request, Response } from 'express';
import authService from '../services/authService';
import { getAuditLogs } from '../services/auditService.js';

export const login = async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    if (!identifier || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email/Username and password are required' 
      });
    }
    
    const result = await authService.login(identifier, password, ipAddress, userAgent);
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { identifier, otp } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    if (!identifier || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email/Username and OTP are required' 
      });
    }
    
    const result = await authService.verifyLogin(identifier, otp, ipAddress, userAgent);
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = (req as any).user?.userId;
    const ipAddress = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    if (token && userId) {
      await authService.logout(token, userId, ipAddress, userAgent);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

export const verifyToken = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = authService.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    
    res.json({ success: true, user: decoded });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = authService.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    
    const user = await authService.getCurrentUser(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAuditTrail = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = authService.verifyToken(token);
    
    if (!decoded || !decoded.roles?.includes('Admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    const { userId, action, startDate, endDate, limit } = req.query;
    
    const logs = await getAuditLogs(
      userId ? parseInt(userId as string) : undefined,
      action as string,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined,
      limit ? parseInt(limit as string) : 100
    );
    
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Get audit trail error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};