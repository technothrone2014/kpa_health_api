"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSuccessfulLogins = exports.getFailedLoginAttempts = exports.getDateRangeAuditTrail = exports.getActionAuditTrail = exports.getUserAuditTrail = exports.getAuditLogs = exports.auditLog = void 0;
// services/auditService.ts
const pool_1 = require("../db/pool");
// Helper to truncate strings to fit database column limits
const truncate = (value, maxLength = 100) => {
    if (!value)
        return null;
    if (value.length <= maxLength)
        return value;
    return value.substring(0, maxLength - 3) + '...';
};
const auditLog = async (userId, action, entity, entityId, oldValues, newValues, ipAddress, userAgent) => {
    try {
        const pool = await pool_1.poolPromise;
        // Truncate values to fit database constraints
        const truncatedAction = truncate(action, 50);
        const truncatedEntity = truncate(entity, 100);
        // For JWT tokens in entityId, we can either truncate or hash them
        let truncatedEntityId = entityId;
        if (entityId && entityId.length > 100) {
            // If it's a JWT token, just store a shortened version or hash
            // This keeps the reference without breaking the DB constraint
            truncatedEntityId = entityId.substring(0, 97) + '...';
        }
        const truncatedIpAddress = truncate(ipAddress, 45);
        await pool.query(`INSERT INTO "AuditLogs" 
       ("UserId", "Action", "Entity", "EntityId", "OldValues", "NewValues", "IpAddress", "UserAgent", "Timestamp")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`, [
            userId,
            truncatedAction,
            truncatedEntity,
            truncatedEntityId,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            truncatedIpAddress,
            userAgent ? truncate(userAgent, 500) : null
        ]);
    }
    catch (error) {
        console.error('Failed to write audit log:', error);
    }
};
exports.auditLog = auditLog;
const getAuditLogs = async (userId, action, startDate, endDate, limit = 100) => {
    try {
        const pool = await pool_1.poolPromise;
        let query = `SELECT * FROM "AuditLogs" WHERE 1=1`;
        const params = [];
        let paramIndex = 1;
        if (userId) {
            query += ` AND "UserId" = $${paramIndex++}`;
            params.push(userId);
        }
        if (action) {
            query += ` AND "Action" = $${paramIndex++}`;
            params.push(action);
        }
        if (startDate) {
            query += ` AND "Timestamp" >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND "Timestamp" <= $${paramIndex++}`;
            params.push(endDate);
        }
        query += ` ORDER BY "Timestamp" DESC LIMIT $${paramIndex++}`;
        params.push(limit);
        const result = await pool.query(query, params);
        return result.rows;
    }
    catch (error) {
        console.error('Failed to get audit logs:', error);
        return [];
    }
};
exports.getAuditLogs = getAuditLogs;
const getUserAuditTrail = async (userId, limit = 50) => {
    return await (0, exports.getAuditLogs)(userId, undefined, undefined, undefined, limit);
};
exports.getUserAuditTrail = getUserAuditTrail;
const getActionAuditTrail = async (action, limit = 100) => {
    return await (0, exports.getAuditLogs)(undefined, action, undefined, undefined, limit);
};
exports.getActionAuditTrail = getActionAuditTrail;
const getDateRangeAuditTrail = async (startDate, endDate, limit = 100) => {
    return await (0, exports.getAuditLogs)(undefined, undefined, startDate, endDate, limit);
};
exports.getDateRangeAuditTrail = getDateRangeAuditTrail;
const getFailedLoginAttempts = async (limit = 50) => {
    return await (0, exports.getAuditLogs)(undefined, 'LOGIN_FAILED', undefined, undefined, limit);
};
exports.getFailedLoginAttempts = getFailedLoginAttempts;
const getSuccessfulLogins = async (limit = 50) => {
    return await (0, exports.getAuditLogs)(undefined, 'LOGIN_SUCCESS', undefined, undefined, limit);
};
exports.getSuccessfulLogins = getSuccessfulLogins;
