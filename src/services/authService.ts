import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import otpGenerator from 'otp-generator';
import { poolPromise } from '../db/pool';
import { sendEmailOTP } from './emailService';
import { auditLog } from './auditService.js';

// Ensure JWT_SECRET is defined
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Validate JWT_SECRET at startup
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ WARNING: JWT_SECRET is not set in production environment!');
}

export interface User {
  Id: number;
  FirstName?: string;
  LastName?: string;
  Email: string;
  PhoneNumber?: string;
  UserName?: string;
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
    
    // Ensure JWT_SECRET is a string
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

  // Get user roles
  async getUserRoles(userId: number): Promise<string[]> {
    const pool = await poolPromise;
    const result = await pool.query(
      `SELECT r."Name" FROM "UserRoles" ur
       JOIN "Roles" r ON ur."RoleId" = r."Id"
       WHERE ur."UserId" = $1`,
      [userId]
    );
    return result.rows.map(row => row.Name);
  }

  // Send OTP via email using Brevo
  async sendOTPEmail(email: string, otp: string): Promise<boolean> {
    return await sendEmailOTP(email, otp);
  }

  // Store OTP in database
  async storeOTP(userId: number, identifier: string, otp: string, type: string = 'email'): Promise<void> {
    const pool = await poolPromise;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    
    await pool.query(
      `INSERT INTO "OTPRecords" ("UserId", "Identifier", "OTPCode", "Type", "ExpiresAt")
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, identifier, otp, type, expiresAt]
    );
  }

  // Verify OTP
  async verifyOTP(identifier: string, otp: string): Promise<{ valid: boolean; userId?: number }> {
    const pool = await poolPromise;
    
    const result = await pool.query(
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
    await pool.query(
      `UPDATE "OTPRecords" SET "Attempts" = "Attempts" + 1 WHERE "Id" = $1`,
      [record.Id]
    );
    
    // Delete used OTP
    await pool.query(`DELETE FROM "OTPRecords" WHERE "Id" = $1`, [record.Id]);
    
    return { valid: true, userId: record.UserId };
  }

  // Login with email/username and password
  async login(identifier: string, password: string, ipAddress: string, userAgent: string): Promise<AuthResponse> {
    const pool = await poolPromise;
    
    // Check by email or username
    const result = await pool.query(
      `SELECT * FROM "Users" 
       WHERE ("Email" = $1 OR "UserName" = $1) 
       AND "Status" = true
       AND ("LockoutEnd" IS NULL OR "LockoutEnd" < NOW())`,
      [identifier.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      await auditLog(null, 'LOGIN_FAILED', 'User', identifier, null, null, ipAddress, userAgent);
      return { success: false, message: 'Invalid email/username or password' };
    }
    
    const user = result.rows[0];
    
    // Check if password hash exists
    if (!user.PasswordHash) {
      await auditLog(user.Id, 'LOGIN_FAILED', 'User', user.Email, null, null, ipAddress, userAgent);
      return { success: false, message: 'Account not configured for password login' };
    }
    
    // Verify password
    const isValid = await this.verifyPassword(password, user.PasswordHash);
    if (!isValid) {
      // Increment failed attempts
      await pool.query(
        `UPDATE "Users" SET "AccessFailedCount" = "AccessFailedCount" + 1 WHERE "Id" = $1`,
        [user.Id]
      );
      
      await auditLog(user.Id, 'LOGIN_FAILED', 'User', user.Email, null, null, ipAddress, userAgent);
      return { success: false, message: 'Invalid email/username or password' };
    }
    
    // Reset failed attempts on successful password
    await pool.query(
      `UPDATE "Users" SET "AccessFailedCount" = 0 WHERE "Id" = $1`,
      [user.Id]
    );
    
    // Generate and send OTP
    const otp = this.generateOTP();
    await this.storeOTP(user.Id, user.Email, otp, 'email');
    
    // Send OTP via email
    const emailSent = await this.sendOTPEmail(user.Email, otp);
    
    if (!emailSent) {
      await auditLog(user.Id, 'OTP_FAILED', 'User', user.Email, null, null, ipAddress, userAgent);
      return { success: false, message: 'Failed to send verification code' };
    }
    
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
        TwoFactorEnabled: user.TwoFactorEnabled,
      }
    };
  }
  
  // Verify OTP and complete login
  async verifyLogin(identifier: string, otp: string, ipAddress: string, userAgent: string): Promise<AuthResponse> {
    const pool = await poolPromise;
    
    // Verify OTP
    const { valid, userId } = await this.verifyOTP(identifier, otp);
    if (!valid) {
      await auditLog(null, 'OTP_INVALID', 'User', identifier, null, null, ipAddress, userAgent);
      return { success: false, message: 'Invalid or expired verification code' };
    }
    
    // Get user
    const result = await pool.query(
      `SELECT * FROM "Users" WHERE "Id" = $1 AND "Status" = true`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return { success: false, message: 'User not found' };
    }
    
    const user = result.rows[0];
    const roles = await this.getUserRoles(user.Id);
    
    // Generate tokens
    const { token, refreshToken } = this.generateTokens(user.Id, user.Email, roles);
    
    // Store session
    await pool.query(
      `INSERT INTO "Sessions" ("UserId", "Token", "RefreshToken", "UserAgent", "IpAddress", "ExpiresAt")
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
      [user.Id, token, refreshToken, userAgent, ipAddress]
    );
    
    await auditLog(user.Id, 'LOGIN_SUCCESS', 'User', user.Email, null, null, ipAddress, userAgent);
    
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
      }
    };
  }
  
  // Logout
  async logout(token: string, userId: number, ipAddress: string, userAgent: string): Promise<void> {
    const pool = await poolPromise;
    await pool.query(`DELETE FROM "Sessions" WHERE "Token" = $1`, [token]);
    await auditLog(userId, 'LOGOUT', 'Session', token, null, null, ipAddress, userAgent);
  }
  
  // Get current user with roles
  async getCurrentUser(userId: number): Promise<any> {
    const pool = await poolPromise;
    
    const result = await pool.query(
      `SELECT "Id", "FirstName", "LastName", "Email", "UserName", "PhoneNumber", "Status"
       FROM "Users" WHERE "Id" = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const user = result.rows[0];
    const roles = await this.getUserRoles(userId);
    
    return { ...user, roles };
  }
  
  // Enable/Disable 2FA for user
  async toggleTwoFactor(userId: number, enabled: boolean): Promise<void> {
    const pool = await poolPromise;
    await pool.query(
      `UPDATE "Users" SET "TwoFactorEnabled" = $1 WHERE "Id" = $2`,
      [enabled, userId]
    );
  }
  
  // Create user from existing SQL Server data (migration helper)
  async createUserFromSqlServer(userData: any): Promise<void> {
    const pool = await poolPromise;
    
    await pool.query(
      `INSERT INTO "Users" (
        "Id", "FirstName", "LastName", "RegDate", "Status", "UserName", 
        "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed",
        "PasswordHash", "PhoneNumber", "PhoneNumberConfirmed", "TwoFactorEnabled",
        "LockoutEnabled", "AccessFailedCount"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT ("Id") DO UPDATE SET
        "FirstName" = EXCLUDED."FirstName",
        "LastName" = EXCLUDED."LastName",
        "Email" = EXCLUDED."Email",
        "PhoneNumber" = EXCLUDED."PhoneNumber"`,
      [
        userData.Id, userData.FirstName, userData.LastName, userData.RegDate,
        userData.Status, userData.UserName, userData.NormalizedUserName,
        userData.Email, userData.NormalizedEmail, userData.EmailConfirmed,
        userData.PasswordHash, userData.PhoneNumber, userData.PhoneNumberConfirmed,
        userData.TwoFactorEnabled, userData.LockoutEnabled, userData.AccessFailedCount
      ]
    );
  }
  
  // Create first admin user (run once)
  async createAdminUser(): Promise<void> {
    const pool = await poolPromise;
    
    const existingAdmin = await pool.query(`SELECT * FROM "Users" WHERE "Email" = $1`, ['admin@kpa-health.co.ke']);
    
    if (existingAdmin.rows.length === 0) {
      const hashedPassword = await this.hashPassword('Admin@123');
      await pool.query(
        `INSERT INTO "Users" ("Email", "UserName", "PasswordHash", "FirstName", "LastName", "Status", "EmailConfirmed", "RegDate")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['admin@kpa-health.co.ke', 'admin', hashedPassword, 'System', 'Administrator', true, true, new Date()]
      );
      
      // Get the admin user id
      const adminResult = await pool.query(`SELECT "Id" FROM "Users" WHERE "Email" = $1`, ['admin@kpa-health.co.ke']);
      const adminId = adminResult.rows[0].Id;
      
      // Assign admin role
      const roleResult = await pool.query(`SELECT "Id" FROM "Roles" WHERE "Name" = 'Admin'`);
      if (roleResult.rows.length > 0) {
        await pool.query(
          `INSERT INTO "UserRoles" ("UserId", "RoleId") VALUES ($1, $2)`,
          [adminId, roleResult.rows[0].Id]
        );
      }
      
      console.log('✅ Admin user created: admin@kpa-health.co.ke / Admin@123');
    }
  }
}

export default new AuthService();
