"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsErrorHandler = exports.bodyParserErrorHandler = exports.rateLimitErrorHandler = exports.asyncHandler = exports.errorHandler = exports.notFound = exports.ApiError = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
// Custom error class for API errors
class ApiError extends Error {
    constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
// Not found middleware
const notFound = (req, res, next) => {
    const error = new ApiError(404, `Not Found - ${req.originalUrl}`);
    next(error);
};
exports.notFound = notFound;
// Global error handler middleware
const errorHandler = (err, req, res, next) => {
    // Log error
    if (err instanceof ApiError && err.isOperational) {
        logger_1.default.warn(`Operational error: ${err.message}`, {
            statusCode: err.statusCode,
            path: req.path,
            method: req.method,
            ip: req.ip,
        });
    }
    else {
        logger_1.default.error(`Unhandled error: ${err.message}`, {
            stack: err.stack,
            path: req.path,
            method: req.method,
            ip: req.ip,
        });
    }
    // Default error values
    let statusCode = 500;
    let message = 'Internal Server Error';
    let errors;
    // Handle specific error types
    if (err instanceof ApiError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    // Handle SQL Server errors
    else if (err.name === 'RequestError') {
        statusCode = 400;
        message = 'Database query error';
        // You can add specific SQL error handling here
        if (err.message.includes('Invalid column name')) {
            message = 'Invalid database field requested';
        }
        else if (err.message.includes('Violation of PRIMARY KEY')) {
            statusCode = 409;
            message = 'Duplicate entry detected';
        }
    }
    // Handle validation errors (you can expand this)
    else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
        errors = [{ field: 'general', message: err.message }];
    }
    // Handle JWT errors
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }
    // Handle duplicate key errors
    else if (err.message.includes('duplicate key')) {
        statusCode = 409;
        message = 'Duplicate entry';
    }
    // Send response
    res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        ...(errors && { errors }),
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            originalError: err.message,
        }),
    });
};
exports.errorHandler = errorHandler;
// Async handler wrapper to avoid try-catch blocks in controllers
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// Rate limiting error handler
const rateLimitErrorHandler = (err, req, res, next) => {
    if (err.message === 'Rate limit exceeded') {
        return res.status(429).json({
            success: false,
            message: 'Too many requests, please try again later.',
        });
    }
    next(err);
};
exports.rateLimitErrorHandler = rateLimitErrorHandler;
// Body parser error handler
const bodyParserErrorHandler = (err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'Request entity too large',
        });
    }
    next(err);
};
exports.bodyParserErrorHandler = bodyParserErrorHandler;
// CORS error handler
const corsErrorHandler = (err, req, res, next) => {
    if (err.message === 'CORS error') {
        return res.status(403).json({
            success: false,
            message: 'CORS policy violation',
        });
    }
    next(err);
};
exports.corsErrorHandler = corsErrorHandler;
