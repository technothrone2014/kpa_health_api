// kpa_health_api/src/services/authService.ts

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import otpGenerator from 'otp-generator';
import { poolPromise } from '../db/pool';
import { sendEmailOTP } from './emailService.js';
import { auditLog } from './auditService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface User {
  Id: number;
  FirstName?: string;
  LastName?: string;
  Email: string;
  PhoneNumber?: string;
  UserName?: string;
  StationId?: string;
  Status: boolean;
  TwoFactorEnabled: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  refreshToken?: string;
  user?: Partial<User>;
  requiresOTP?: boolean;
  roles?: string[];
}

class AuthService {
  // Generate OTP code
  generateOTP(): string {
    return otpGenerator.generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
  }

  // Hash password (ASP.NET Core Identity compatible)
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  // Verify password
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  // Generate JWT tokens
  generateTokens(userId: number, email: string, roles: string[]): { token: string; refreshToken: string } {
    const payload = { userId, email, roles };
    const secret = String(JWT_SECRET);
    const expiresIn = String(JWT_EXPIRES_IN);
    
    const token = jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
    const refreshToken = jwt.sign(payload, secret, { expiresIn: '30d' } as jwt.SignOptions);
    
    return { token, refreshToken };
  }

  // Verify JWT token
  verifyToken(token: string): any {
    try {
      const secret = String(JWT_SECRET);
      return jwt.verify(token, secret);
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  // Find user by identifier (email, username, or phone number)
  async findUserByIdentifier(identifier: string): Promise<any> {
    console.log(`🔍 Finding user with identifier: ${identifier}`);
    const startTime = Date.now();
    
    try {
      const pool = await poolPromise;
      
      // Use a client from the pool and release it properly
      const client = await pool.connect();
      
      try {
        // Set statement timeout for this query
        await client.query('SET statement_timeout = 10000'); // 10 seconds
        
        const result = await client.query(
          `SELECT * FROM "Users" 
           WHERE ("Email" = $1 OR "UserName" = $1 OR "PhoneNumber" = $1) 
           AND "Status" = true
           AND ("LockoutEnd" IS NULL OR "LockoutEnd" < NOW())
           LIMIT 1`,
          [identifier.toLowerCase()]
        );
        
        console.log(`✅ Query completed in ${Date.now() - startTime}ms`);
        
        if (result.rows.length === 0) {
          console.log(`❌ No user found for: ${identifier}`);
          return null;
        }
        
        const user = result.rows[0];
        console.log(`✅ User found: ${user.Email}`);
        
        return user;
      } finally {
        client.release(); // Always release the client back to the pool
      }
    } catch (error: any) {
      console.error(`💥 Error finding user (${Date.now() - startTime}ms):`, error.message);
      
      // Check for specific errors
      if (error.message.includes('timeout')) {
        console.error('⏰ Query timeout - database might be slow or missing indexes');
      } else if (error.code === 'ECONNREFUSED') {
        console.error('🔌 Database connection refused');
      }
      
      throw error;
    }
  }

  // Get user roles
  async getUserRoles(userId: number): Promise<string[]> {
    try {
      const pool = await poolPromise;
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          `SELECT r."Name" FROM "UserRoles" ur
           JOIN "Roles" r ON ur."RoleId" = r."Id"
           WHERE ur."UserId" = $1`,
          [userId]
        );
        return result.rows.map(row => row.Name);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error getting user roles:', error);
      return [];
    }
  }

  // Send OTP via email using Brevo
  async sendOTPEmail(email: string, otp: string, userName?: string): Promise<boolean> {
    try {
      return await sendEmailOTP(email, otp, userName);
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      return false;
    }
  }

  // Send OTP via SMS (future implementation)
  async sendOTPSMS(phoneNumber: string, otp: string): Promise<boolean> {
    // TODO: Implement SMS sending via Celcom Africa
    console.log(`📱 SMS OTP ${otp} would be sent to ${phoneNumber}`);
    return true; // Placeholder
  }

  // Store OTP in database
  async storeOTP(userId: number, identifier: string, otp: string, type: string = 'email'): Promise<void> {
    try {
      const pool = await poolPromise;
      const client = await pool.connect();
      
      try {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
        
        await client.query(
          `INSERT INTO "OTPRecords" ("UserId", "Identifier", "OTPCode", "Type", "ExpiresAt", "CreatedAt", "Attempts")
           VALUES ($1, $2, $3, $4, $5, NOW(), 0)`,
          [userId, identifier, otp, type, expiresAt]
        );
        
        console.log(`✅ OTP stored for user ${userId}`);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to store OTP:', error);
      throw error;
    }
  }

  // Verify OTP
  async verifyOTP(identifier: string, otp: string): Promise<{ valid: boolean; userId?: number }> {
    try {
      const pool = await poolPromise;
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          `SELECT * FROM "OTPRecords" 
           WHERE "Identifier" = $1 AND "OTPCode" = $2 
           AND "ExpiresAt" > NOW()
           ORDER BY "CreatedAt" DESC LIMIT 1`,
          [identifier, otp]
        );
        
        if (result.rows.length === 0) {
          return { valid: false };
        }
        
        const record = result.rows[0];
        
        // Update attempts count
        await client.query(
          `UPDATE "OTPRecords" SET "Attempts" = "Attempts" + 1 WHERE "Id" = $1`,
          [record.Id]
        );
        
        // Delete used OTP
        await client.query(`DELETE FROM "OTPRecords" WHERE "Id" = $1`, [record.Id]);
        
        return { valid: true, userId: record.UserId };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { valid: false };
    }
  }

  // Login with password
  async loginWithPassword(identifier: string, password: string, ipAddress: string | null, userAgent: string | null): Promise<AuthResponse> {
    console.log(`🔐 Login attempt for: ${identifier}`);
    
    try {
      const user = await this.findUserByIdentifier(identifier);
      
      if (!user) {
        await auditLog(null, 'LOGIN_FAILED', 'User', identifier, null, null, ipAddress, userAgent);
        return { success: false, message: 'Invalid credentials' };
      }
      
      // Check if password hash exists
      if (!user.PasswordHash) {
        await auditLog(user.Id, 'LOGIN_FAILED', 'User', user.Email, null, null, ipAddress, userAgent);
        return { success: false, message: 'Please use OTP login for this account' };
      }
      
      // Verify password
      const isValid = await this.verifyPassword(password, user.PasswordHash);
      if (!isValid) {
        await auditLog(user.Id, 'LOGIN_FAILED', 'User', user.Email, null, null, ipAddress, userAgent);
        return { success: false, message: 'Invalid credentials' };
      }
      
      // Get user roles
      const roles = await this.getUserRoles(user.Id);
      
      // Generate OTP for 2FA
      const otp = this.generateOTP();
      await this.storeOTP(user.Id, user.Email, otp, 'email');
      await this.sendOTPEmail(user.Email, otp, user.FirstName);
      
      await auditLog(user.Id, 'OTP_SENT', 'User', user.Email, null, null, ipAddress, userAgent);
      
      return {
        success: true,
        message: 'Verification code sent to your email',
        requiresOTP: true,
        user: {
          Id: user.Id,
          Email: user.Email,
          FirstName: user.FirstName,
          LastName: user.LastName,
          PhoneNumber: user.PhoneNumber,
        },
        roles
      };
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.message || 'Login failed. Please try again.'
      };
    }
  }

  // Login with OTP only (no password required)
  async loginWithOTP(identifier: string, ipAddress: string | null, userAgent: string | null): Promise<AuthResponse> {
    console.log(`📱 OTP login requested for: ${identifier}`);
    
    try {
      const user = await this.findUserByIdentifier(identifier);
      
      if (!user) {
        await auditLog(null, 'LOGIN_FAILED', 'User', identifier, null, null, ipAddress, userAgent);
        return { success: false, message: 'User not found' };
      }
      
      // Generate OTP
      const otp = this.generateOTP();
      await this.storeOTP(user.Id, user.Email, otp, 'email');
      
      // Send OTP via email (and SMS if phone number exists)
      const emailSent = await this.sendOTPEmail(user.Email, otp, user.FirstName);
      
      if (user.PhoneNumber) {
        await this.sendOTPSMS(user.PhoneNumber, otp);
      }
      
      if (!emailSent) {
        await auditLog(user.Id, 'OTP_FAILED', 'User', user.Email, null, null, ipAddress, userAgent);
        return { success: false, message: 'Failed to send verification code' };
      }
      
      const roles = await this.getUserRoles(user.Id);
      
      await auditLog(user.Id, 'OTP_SENT', 'User', user.Email, null, null, ipAddress, userAgent);
      
      return {
        success: true,
        message: 'Verification code sent to your email' + (user.PhoneNumber ? ' and phone' : ''),
        requiresOTP: true,
        user: {
          Id: user.Id,
          Email: user.Email,
          FirstName: user.FirstName,
          LastName: user.LastName,
          PhoneNumber: user.PhoneNumber,
        },
        roles
      };
    } catch (error: any) {
      console.error('OTP login error:', error);
      return {
        success: false,
        message: error.message || 'Failed to send verification code'
      };
    }
  }

  // Verify OTP and complete login
  async verifyLogin(identifier: string, otp: string, ipAddress: string | null, userAgent: string | null): Promise<AuthResponse> {
    console.log(`✅ Verifying OTP for: ${identifier}`);
    
    try {
      // Verify OTP
      const { valid, userId } = await this.verifyOTP(identifier, otp);
      if (!valid || !userId) {
        await auditLog(null, 'OTP_INVALID', 'User', identifier, null, null, ipAddress, userAgent);
        return { success: false, message: 'Invalid or expired verification code' };
      }
      
      // Get user
      const pool = await poolPromise;
      const client = await pool.connect();
      
      let user;
      try {
        const result = await client.query(
          `SELECT * FROM "Users" WHERE "Id" = $1 AND "Status" = true`,
          [userId]
        );
        
        if (result.rows.length === 0) {
          return { success: false, message: 'User not found' };
        }
        
        user = result.rows[0];
      } finally {
        client.release();
      }
      
      const roles = await this.getUserRoles(user.Id);
      
      // Generate tokens
      const { token, refreshToken } = this.generateTokens(user.Id, user.Email, roles);
      
      // Store session
      const sessionClient = await pool.connect();
      try {
        await sessionClient.query(
          `INSERT INTO "Sessions" ("UserId", "Token", "RefreshToken", "UserAgent", "IpAddress", "ExpiresAt", "CreatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days', NOW())`,
          [user.Id, token, refreshToken, userAgent, ipAddress]
        );
      } finally {
        sessionClient.release();
      }
      
      await auditLog(user.Id, 'LOGIN_SUCCESS', 'User', user.Email, null, null, ipAddress, userAgent);
      
      console.log(`✅ Login successful for: ${user.Email}, Roles: ${roles.join(', ')}`);
      
      return {
        success: true,
        message: 'Login successful',
        token,
        refreshToken,
        user: {
          Id: user.Id,
          Email: user.Email,
          FirstName: user.FirstName,
          LastName: user.LastName,
          PhoneNumber: user.PhoneNumber,
          UserName: user.UserName,
          StationId: user.StationId,
        },
        roles
      };
    } catch (error: any) {
      console.error('OTP verification error:', error);
      return {
        success: false,
        message: error.message || 'Verification failed. Please try again.'
      };
    }
  }
  
  // Logout
  async logout(token: string, userId: number, ipAddress: string | null, userAgent: string | null): Promise<void> {
    try {
      const pool = await poolPromise;
      const client = await pool.connect();
      
      try {
        await client.query(`DELETE FROM "Sessions" WHERE "Token" = $1`, [token]);
        await auditLog(userId, 'LOGOUT', 'Session', token, null, null, ipAddress, userAgent);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  // Get current user with roles
  async getCurrentUser(userId: number): Promise<any> {
    try {
      const pool = await poolPromise;
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          `SELECT "Id", "FirstName", "LastName", "Email", "UserName", "PhoneNumber", "Status", "StationId"
          FROM "Users" WHERE "Id" = $1`,
          [userId]
        );
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const user = result.rows[0];
        
        // ✅ GET USER ROLES
        const rolesResult = await client.query(
          `SELECT r."Name" FROM "UserRoles" ur
          JOIN "Roles" r ON ur."RoleId" = r."Id"
          WHERE ur."UserId" = $1`,
          [userId]
        );
        
        const roles = rolesResult.rows.map(row => row.Name);
        console.log(`🔍 getCurrentUser: User ${userId} has roles:`, roles);
        
        return { ...user, roles };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  // Migrate roles from SQL Server
  async migrateRoles(): Promise<void> {
    const defaultRoles = [
      'Administrator',
      'Support',
      'FieldAgent',
      'LabAssistant',
      'OncologyTechnician',
      'Epidemiologist',
      'Guest'
    ];
    
    try {
      const pool = await poolPromise;
      const client = await pool.connect();
      
      try {
        for (const roleName of defaultRoles) {
          await client.query(
            `INSERT INTO "Roles" ("Name", "NormalizedName") 
             VALUES ($1, $2)
             ON CONFLICT ("Name") DO NOTHING`,
            [roleName, roleName.toUpperCase()]
          );
        }
        
        console.log('✅ Roles migrated successfully');
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to migrate roles:', error);
    }
  }
}

export default new AuthService();