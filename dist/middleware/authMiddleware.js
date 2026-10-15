"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.adminMiddleware = exports.authMiddleware = void 0;
const authService_1 = __importDefault(require("../services/authService"));
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        const decoded = authService_1.default.verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
exports.authMiddleware = authMiddleware;
const adminMiddleware = async (req, res, next) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const roles = (user.roles || []).map((r) => String(r).toLowerCase());
    const isAdmin = roles.some((r) => r === 'administrator' || r === 'admin');
    if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};
exports.adminMiddleware = adminMiddleware;
/**
 * Role-based authorization middleware
 * @param allowedRoles - Array of role names that are allowed to access the route
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized - Please log in'
            });
        }
        const userRoles = user.roles || [];
        // Normalize roles to lowercase for comparison
        const normalizedUserRoles = userRoles.map((role) => role.toLowerCase());
        const normalizedAllowedRoles = allowedRoles.map(role => role.toLowerCase());
        // Check if user has any of the allowed roles
        const hasAllowedRole = normalizedUserRoles.some((role) => normalizedAllowedRoles.includes(role));
        if (!hasAllowedRole) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
            });
        }
        next();
    };
};
exports.requireRole = requireRole;
