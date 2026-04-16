// middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = authService.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    
    (req as any).user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  
  if (!user || !user.roles?.includes('Admin')) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  
  next();
};

/**
 * Role-based authorization middleware
 * @param allowedRoles - Array of role names that are allowed to access the route
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized - Please log in' 
      });
    }
    
    const userRoles = user.roles || [];
    
    // Normalize roles to lowercase for comparison
    const normalizedUserRoles = userRoles.map((role: string) => role.toLowerCase());
    const normalizedAllowedRoles = allowedRoles.map(role => role.toLowerCase());
    
    // Check if user has any of the allowed roles
    const hasAllowedRole = normalizedUserRoles.some((role: string) => 
      normalizedAllowedRoles.includes(role)
    );
    
    if (!hasAllowedRole) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}` 
      });
    }
    
    next();
  };
};
