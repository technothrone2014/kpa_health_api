// services/auditService.ts
import { poolPromise } from '../db/pool';

export interface AuditLogEntry {
  Id: number;
  UserId: number | null;
  Action: string;
  Entity: string | null;
  EntityId: string | null;
  OldValues: any | null;
  NewValues: any | null;
  IpAddress: string | null;
  UserAgent: string | null;
  Timestamp: Date;
}

// Helper to truncate strings to fit database column limits
const truncate = (value: string | null, maxLength: number = 100): string | null => {
  if (!value) return null;
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength - 3) + '...';
};

export const auditLog = async (
  userId: number | null,
  action: string,
  entity: string | null,
  entityId: string | null,
  oldValues: any | null,
  newValues: any | null,
  ipAddress: string | null,
  userAgent: string | null
): Promise<void> => {
  try {
    const pool = await poolPromise;
    
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
    
    await pool.query(
      `INSERT INTO "AuditLogs" 
       ("UserId", "Action", "Entity", "EntityId", "OldValues", "NewValues", "IpAddress", "UserAgent", "Timestamp")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        userId, 
        truncatedAction, 
        truncatedEntity, 
        truncatedEntityId, 
        oldValues ? JSON.stringify(oldValues) : null, 
        newValues ? JSON.stringify(newValues) : null, 
        truncatedIpAddress, 
        userAgent ? truncate(userAgent, 500) : null
      ]
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};

export const getAuditLogs = async (
  userId?: number,
  action?: string,
  startDate?: Date,
  endDate?: Date,
  limit: number = 100
): Promise<AuditLogEntry[]> => {
  try {
    const pool = await poolPromise;
    let query = `SELECT * FROM "AuditLogs" WHERE 1=1`;
    const params: any[] = [];
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
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
};

export const getUserAuditTrail = async (
  userId: number,
  limit: number = 50
): Promise<AuditLogEntry[]> => {
  return await getAuditLogs(userId, undefined, undefined, undefined, limit);
};

export const getActionAuditTrail = async (
  action: string,
  limit: number = 100
): Promise<AuditLogEntry[]> => {
  return await getAuditLogs(undefined, action, undefined, undefined, limit);
};

export const getDateRangeAuditTrail = async (
  startDate: Date,
  endDate: Date,
  limit: number = 100
): Promise<AuditLogEntry[]> => {
  return await getAuditLogs(undefined, undefined, startDate, endDate, limit);
};

export const getFailedLoginAttempts = async (
  limit: number = 50
): Promise<AuditLogEntry[]> => {
  return await getAuditLogs(undefined, 'LOGIN_FAILED', undefined, undefined, limit);
};

export const getSuccessfulLogins = async (
  limit: number = 50
): Promise<AuditLogEntry[]> => {
  return await getAuditLogs(undefined, 'LOGIN_SUCCESS', undefined, undefined, limit);
};
