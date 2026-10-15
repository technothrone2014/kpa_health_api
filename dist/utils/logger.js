"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logHttp = exports.logDebug = exports.logWarn = exports.logError = exports.logInfo = exports.stream = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
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
winston_1.default.addColors(colors);
// Custom format for console logging
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`));
// Custom format for file logging (without colors)
const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.json());
// Determine log directory
const logDir = process.env.LOG_DIR || 'logs';
// Create transports
const transports = [
    // Console transport
    new winston_1.default.transports.Console({
        format: consoleFormat,
    }),
    // Error log file
    new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
    // Combined log file
    new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'combined.log'),
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
];
// Create the logger instance
const logger = winston_1.default.createLogger({
    level: level(),
    levels,
    transports,
    exceptionHandlers: [
        new winston_1.default.transports.File({ filename: path_1.default.join(logDir, 'exceptions.log') }),
    ],
    rejectionHandlers: [
        new winston_1.default.transports.File({ filename: path_1.default.join(logDir, 'rejections.log') }),
    ],
});
// Create a stream object for Morgan integration (if needed)
exports.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};
// Export helper methods for different log levels
const logInfo = (message, meta) => {
    if (meta) {
        logger.info(message, meta);
    }
    else {
        logger.info(message);
    }
};
exports.logInfo = logInfo;
const logError = (message, error) => {
    if (error) {
        logger.error(message, { error: error.message, stack: error.stack });
    }
    else {
        logger.error(message);
    }
};
exports.logError = logError;
const logWarn = (message, meta) => {
    if (meta) {
        logger.warn(message, meta);
    }
    else {
        logger.warn(message);
    }
};
exports.logWarn = logWarn;
const logDebug = (message, meta) => {
    if (meta) {
        logger.debug(message, meta);
    }
    else {
        logger.debug(message);
    }
};
exports.logDebug = logDebug;
const logHttp = (message, meta) => {
    if (meta) {
        logger.http(message, meta);
    }
    else {
        logger.http(message);
    }
};
exports.logHttp = logHttp;
// Export default logger
exports.default = logger;
