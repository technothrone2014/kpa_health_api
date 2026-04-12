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
    const pool = await poolPromise;
    
    // Check by email, username, or phone number
    const result = await pool.query(
      `SELECT * FROM "Users" 
       WHERE ("Email" = $1 OR "UserName" = $1 OR "PhoneNumber" = $1) 
       AND "Status" = true
       AND ("LockoutEnd" IS NULL OR "LockoutEnd" < NOW())`,
      [identifier.toLowerCase()]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
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
  async sendOTPEmail(email: string, otp: string, userName?: string): Promise<boolean> {
    return await sendEmailOTP(email, otp, userName);
  }

  // Send OTP via SMS (future implementation)
  async sendOTPSMS(phoneNumber: string, otp: string): Promise<boolean> {
    // TODO: Implement SMS sending via Celcom Africa
    console.log(`📱 SMS OTP ${otp} would be sent to ${phoneNumber}`);
    return true; // Placeholder
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

  // Login with password
  async loginWithPassword(identifier: string, password: string, ipAddress: string, userAgent: string): Promise<AuthResponse> {
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
  }

  // Login with OTP only (no password required)
  async loginWithOTP(identifier: string, ipAddress: string, userAgent: string): Promise<AuthResponse> {
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
  }

  // Verify OTP and complete login
  async verifyLogin(identifier: string, otp: string, ipAddress: string, userAgent: string): Promise<AuthResponse> {
    // Verify OTP
    const { valid, userId } = await this.verifyOTP(identifier, otp);
    if (!valid) {
      await auditLog(null, 'OTP_INVALID', 'User', identifier, null, null, ipAddress, userAgent);
      return { success: false, message: 'Invalid or expired verification code' };
    }
    
    // Get user
    const pool = await poolPromise;
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
      },
      roles
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

  // Migrate roles from SQL Server
  async migrateRoles(): Promise<void> {
    // This would be called from migration script
    const defaultRoles = [
      'Administrator',
      'Support',
      'FieldAgent',
      'LabAssistant',
      'OncologyTechnician',
      'Epidemiologist',
      'Guest'
    ];
    
    const pool = await poolPromise;
    
    for (const roleName of defaultRoles) {
      await pool.query(
        `INSERT INTO "Roles" ("Name", "NormalizedName") 
         VALUES ($1, $2)
         ON CONFLICT ("Name") DO NOTHING`,
        [roleName, roleName.toUpperCase()]
      );
    }
    
    console.log('✅ Roles migrated successfully');
  }
}

export default new AuthService();