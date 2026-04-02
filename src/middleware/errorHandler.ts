import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Custom error class for API errors
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Interface for validation errors
interface ValidationError {
  field: string;
  message: string;
}

// Not found middleware
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(404, `Not Found - ${req.originalUrl}`);
  next(error);
};

// Global error handler middleware
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  if (err instanceof ApiError && err.isOperational) {
    logger.warn(`Operational error: ${err.message}`, {
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  } else {
    logger.error(`Unhandled error: ${err.message}`, {
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  }

  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: ValidationError[] | undefined;

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
    } else if (err.message.includes('Violation of PRIMARY KEY')) {
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

// Async handler wrapper to avoid try-catch blocks in controllers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Rate limiting error handler
export const rateLimitErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.message === 'Rate limit exceeded') {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
    });
  }
  next(err);
};

// Body parser error handler
export const bodyParserErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large',
    });
  }
  next(err);
};

// CORS error handler
export const corsErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.message === 'CORS error') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation',
    });
  }
  next(err);
};
