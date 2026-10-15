"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditTrail = exports.getCurrentUser = exports.verifyToken = exports.logout = exports.verifyOTP = exports.loginWithOTP = exports.loginWithPassword = void 0;
const authService_js_1 = __importDefault(require("../services/authService.js"));
const auditService_js_1 = require("../services/auditService.js");
const loginWithPassword = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const ipAddress = req.ip || req.socket.remoteAddress || null;
        const userAgent = req.headers['user-agent'] || null;
        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email/Username/Phone and password are required'
            });
        }
        const result = await authService_js_1.default.loginWithPassword(identifier, password, ipAddress, userAgent);
        if (!result.success) {
            return res.status(401).json(result);
        }
        res.json(result);
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
exports.loginWithPassword = loginWithPassword;
const loginWithOTP = async (req, res) => {
    try {
        const { identifier } = req.body;
        const ipAddress = req.ip || req.socket.remoteAddress || null;
        const userAgent = req.headers['user-agent'] || null;
        if (!identifier) {
            return res.status(400).json({
                success: false,
                message: 'Email/Username/Phone is required'
            });
        }
        const result = await authService_js_1.default.loginWithOTP(identifier, ipAddress, userAgent);
        if (!result.success) {
            return res.status(401).json(result);
        }
        res.json(result);
    }
    catch (error) {
        console.error('OTP login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
exports.loginWithOTP = loginWithOTP;
const verifyOTP = async (req, res) => {
    try {
        const { identifier, otp } = req.body;
        const ipAddress = req.ip || req.socket.remoteAddress || null;
        const userAgent = req.headers['user-agent'] || null;
        if (!identifier || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Identifier and OTP are required'
            });
        }
        const result = await authService_js_1.default.verifyLogin(identifier, otp, ipAddress, userAgent);
        if (!result.success) {
            return res.status(401).json(result);
        }
        res.json(result);
    }
    catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
exports.verifyOTP = verifyOTP;
const logout = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const userId = req.user?.userId;
        const ipAddress = req.ip || req.socket.remoteAddress || null;
        const userAgent = req.headers['user-agent'] || null;
        if (token && userId) {
            await authService_js_1.default.logout(token, userId, ipAddress, userAgent);
        }
        res.json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
exports.logout = logout;
const verifyToken = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        const decoded = authService_js_1.default.verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }
        res.json({ success: true, user: decoded });
    }
    catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
exports.verifyToken = verifyToken;
const getCurrentUser = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        const decoded = authService_js_1.default.verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }
        const user = await authService_js_1.default.getCurrentUser(decoded.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        console.log('✅ User data being returned:', user);
        // Return in the format expected by the frontend
        res.json({
            success: true,
            user: {
                Id: user.Id,
                Email: user.Email,
                FirstName: user.FirstName,
                LastName: user.LastName,
                PhoneNumber: user.PhoneNumber,
                UserName: user.UserName,
                roles: user.roles || []
            }
        });
    }
    catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
exports.getCurrentUser = getCurrentUser;
const getAuditTrail = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const decoded = authService_js_1.default.verifyToken(token);
        if (!decoded || !decoded.roles?.includes('Administrator')) {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        const { userId, action, startDate, endDate, limit } = req.query;
        const logs = await (0, auditService_js_1.getAuditLogs)(userId ? parseInt(userId) : undefined, action, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined, limit ? parseInt(limit) : 100);
        res.json({ success: true, logs });
    }
    catch (error) {
        console.error('Get audit trail error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
exports.getAuditTrail = getAuditTrail;
