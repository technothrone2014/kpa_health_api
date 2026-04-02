import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Custom format for console logging
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Custom format for file logging (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.json(),
);

// Determine log directory
const logDir = process.env.LOG_DIR || 'logs';

// Create transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  // Error log file
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // Combined log file
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create the logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'rejections.log') }),
  ],
});

// Create a stream object for Morgan integration (if needed)
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Export helper methods for different log levels
export const logInfo = (message: string, meta?: any) => {
  if (meta) {
    logger.info(message, meta);
  } else {
    logger.info(message);
  }
};

export const logError = (message: string, error?: any) => {
  if (error) {
    logger.error(message, { error: error.message, stack: error.stack });
  } else {
    logger.error(message);
  }
};

export const logWarn = (message: string, meta?: any) => {
  if (meta) {
    logger.warn(message, meta);
  } else {
    logger.warn(message);
  }
};

export const logDebug = (message: string, meta?: any) => {
  if (meta) {
    logger.debug(message, meta);
  } else {
    logger.debug(message);
  }
};

export const logHttp = (message: string, meta?: any) => {
  if (meta) {
    logger.http(message, meta);
  } else {
    logger.http(message);
  }
};

// Export default logger
export default logger;
