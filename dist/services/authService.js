"use strict";
// kpa_health_api/src/services/authService.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const otp_generator_1 = __importDefault(require("otp-generator"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pool_1 = require("../db/pool");
const whatsappService_js_1 = require("./whatsappService.js");
const emailService_js_1 = require("./emailService.js");
const auditService_js_1 = require("./auditService.js");
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes of random data');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
class AuthService {
    normalizeIdentifier(identifier) {
        const value = typeof identifier === 'string' ? identifier.trim() : '';
        if (!value)
            return { identifier: '', kind: 'username', error: 'Enter an email, username, or Kenyan mobile number.' };
        if (value.includes('@')) {
            const [local, domain, ...extra] = value.split('@');
            const localValid = local.length > 0 && local.length <= 64 &&
                !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') &&
                /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local);
            const labels = domain?.split('.') || [];
            const domainValid = domain.length > 0 && domain.length <= 253 &&
                labels.every(label => label.length <= 63 && /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i.test(label));
            if (extra.length > 0 || !localValid || !domainValid || /\s/.test(value)) {
                return { identifier: value, kind: 'email', error: 'Enter a valid email address.' };
            }
            return { identifier: value.toLowerCase(), kind: 'email' };
        }
        if (/^[+\d\s().-]+$/.test(value)) {
            let digits = value.replace(/\D/g, '');
            if (digits.startsWith('00'))
                digits = digits.slice(2);
            let nationalNumber = digits;
            if (digits.startsWith('254'))
                nationalNumber = digits.slice(3);
            else if (digits.startsWith('0'))
                nationalNumber = digits.slice(1);
            if (nationalNumber.startsWith('0'))
                nationalNumber = nationalNumber.slice(1);
            if (!/^[17]\d{8}$/.test(nationalNumber)) {
                return { identifier: value, kind: 'phone', error: 'Enter a valid Kenyan mobile number, such as 0705 172 600 or +254 705 172 600.' };
            }
            return { identifier: `+254${nationalNumber}`, kind: 'phone' };
        }
        return { identifier: value.toLowerCase(), kind: 'username' };
    }
    // Generate OTP code
    generateOTP() {
        return otp_generator_1.default.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
        });
    }
    // Hash password (ASP.NET Core Identity compatible)
    async hashPassword(password) {
        return await bcryptjs_1.default.hash(password, 10);
    }
    // Verify password
    async verifyPassword(password, hash) {
        return await bcryptjs_1.default.compare(password, hash);
    }
    // Generate JWT tokens
    generateTokens(userId, email, roles) {
        const payload = { userId, email, roles };
        const secret = JWT_SECRET;
        const expiresIn = String(JWT_EXPIRES_IN);
        const token = jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
        const refreshToken = jsonwebtoken_1.default.sign(payload, secret, { expiresIn: '30d' });
        return { token, refreshToken };
    }
    // Verify JWT token
    verifyToken(token) {
        try {
            const secret = JWT_SECRET;
            return jsonwebtoken_1.default.verify(token, secret);
        }
        catch (error) {
            console.error('Token verification failed:', error);
            return null;
        }
    }
    // Find user by identifier (email, username, or phone number)
    async findUserByIdentifier(identifier) {
        const normalized = this.normalizeIdentifier(identifier);
        if (normalized.error)
            return null;
        console.log(`🔍 Finding user with identifier type: ${normalized.kind}`);
        const startTime = Date.now();
        try {
            const pool = await pool_1.poolPromise;
            // Use a client from the pool and release it properly
            const client = await pool.connect();
            try {
                // Set statement timeout for this query
                await client.query('SET statement_timeout = 10000'); // 10 seconds
                const phoneDigits = normalized.kind === 'phone' ? normalized.identifier.slice(1) : '';
                const nationalNumber = phoneDigits.startsWith('254') ? phoneDigits.slice(3) : '';
                const phoneVariants = normalized.kind === 'phone'
                    ? [phoneDigits, nationalNumber, `0${nationalNumber}`]
                    : [];
                const result = await client.query(`SELECT * FROM "Users" 
           WHERE (LOWER(BTRIM(COALESCE("Email", ''))) = $1
             OR LOWER(BTRIM(COALESCE("UserName", ''))) = $1
             OR regexp_replace(COALESCE("PhoneNumber", ''), '[^0-9]', '', 'g') = ANY($2::text[]))
           AND "Status" = true
           AND ("LockoutEnd" IS NULL OR "LockoutEnd" < NOW())
           LIMIT 1`, [normalized.identifier, phoneVariants]);
                console.log(`✅ Query completed in ${Date.now() - startTime}ms`);
                if (result.rows.length === 0) {
                    console.log(`❌ No user found for: ${identifier}`);
                    return null;
                }
                const user = result.rows[0];
                console.log(`✅ User found: ${user.Email}`);
                return user;
            }
            finally {
                client.release(); // Always release the client back to the pool
            }
        }
        catch (error) {
            console.error(`💥 Error finding user (${Date.now() - startTime}ms):`, error.message);
            // Check for specific errors
            if (error.message.includes('timeout')) {
                console.error('⏰ Query timeout - database might be slow or missing indexes');
            }
            else if (error.code === 'ECONNREFUSED') {
                console.error('🔌 Database connection refused');
            }
            throw error;
        }
    }
    // Get user roles
    async getUserRoles(userId) {
        try {
            const pool = await pool_1.poolPromise;
            const client = await pool.connect();
            try {
                const result = await client.query(`SELECT r."Name" FROM "UserRoles" ur
           JOIN "Roles" r ON ur."RoleId" = r."Id"
           WHERE ur."UserId" = $1`, [userId]);
                return result.rows.map(row => row.Name);
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('Error getting user roles:', error);
            return [];
        }
    }
    // Send OTP via email using Brevo
    async sendOTPEmail(email, otp, userName) {
        try {
            return await (0, emailService_js_1.sendEmailOTP)(email, otp, userName);
        }
        catch (error) {
            console.error('Failed to send OTP email:', error);
            return false;
        }
    }
    // Store OTP in database
    async storeOTP(userId, identifier, otp, type = 'email') {
        try {
            const pool = await pool_1.poolPromise;
            const client = await pool.connect();
            try {
                const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
                await client.query(`INSERT INTO "OTPRecords" ("UserId", "Identifier", "OTPCode", "Type", "ExpiresAt", "CreatedAt", "Attempts")
           VALUES ($1, $2, $3, $4, $5, NOW(), 0)`, [userId, identifier, otp, type, expiresAt]);
                console.log(`✅ OTP stored for user ${userId}`);
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('Failed to store OTP:', error);
            throw error;
        }
    }
    // Verify OTP
    async verifyOTP(identifier, otp) {
        try {
            const pool = await pool_1.poolPromise;
            const client = await pool.connect();
            try {
                const result = await client.query(`SELECT * FROM "OTPRecords" 
           WHERE "Identifier" = $1 AND "OTPCode" = $2 
           AND "ExpiresAt" > NOW()
           ORDER BY "CreatedAt" DESC LIMIT 1`, [identifier, otp]);
                if (result.rows.length === 0) {
                    return { valid: false };
                }
                const record = result.rows[0];
                // Update attempts count
                await client.query(`UPDATE "OTPRecords" SET "Attempts" = "Attempts" + 1 WHERE "Id" = $1`, [record.Id]);
                // Delete used OTP
                await client.query(`DELETE FROM "OTPRecords" WHERE "Id" = $1`, [record.Id]);
                return { valid: true, userId: record.UserId };
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('Error verifying OTP:', error);
            return { valid: false };
        }
    }
    // Login with password
    async loginWithPassword(identifier, password, ipAddress, userAgent) {
        console.log(`🔐 Login attempt for: ${identifier}`);
        try {
            const user = await this.findUserByIdentifier(identifier);
            if (!user) {
                await (0, auditService_js_1.auditLog)(null, 'LOGIN_FAILED', 'User', identifier, null, null, ipAddress, userAgent);
                return { success: false, message: 'Invalid credentials' };
            }
            // Check if password hash exists
            if (!user.PasswordHash) {
                await (0, auditService_js_1.auditLog)(user.Id, 'LOGIN_FAILED', 'User', user.Email, null, null, ipAddress, userAgent);
                return { success: false, message: 'Please use OTP login for this account' };
            }
            // Verify password
            const isValid = await this.verifyPassword(password, user.PasswordHash);
            if (!isValid) {
                await (0, auditService_js_1.auditLog)(user.Id, 'LOGIN_FAILED', 'User', user.Email, null, null, ipAddress, userAgent);
                return { success: false, message: 'Invalid credentials' };
            }
            // Get user roles
            const roles = await this.getUserRoles(user.Id);
            // Generate OTP for 2FA
            const otp = this.generateOTP();
            await this.storeOTP(user.Id, user.Email, otp, 'email');
            // 📨 Deliver via email + WhatsApp in parallel
            const [emailSent, whatsappSent] = await Promise.all([
                this.sendOTPEmail(user.Email, otp, user.FirstName),
                user.PhoneNumber
                    ? (0, whatsappService_js_1.sendWhatsAppOTP)(user.PhoneNumber, otp, user.FirstName)
                    : Promise.resolve(false),
            ]);
            if (!emailSent && !whatsappSent) {
                await (0, auditService_js_1.auditLog)(user.Id, 'OTP_FAILED', 'User', user.Email, null, null, ipAddress, userAgent);
                return { success: false, message: 'Failed to send verification code. Please try again.' };
            }
            await (0, auditService_js_1.auditLog)(user.Id, 'OTP_SENT', 'User', user.Email, null, null, ipAddress, userAgent);
            const channels = [
                emailSent ? 'email' : null,
                whatsappSent ? 'WhatsApp' : null,
            ].filter(Boolean).join(' and ');
            return {
                success: true,
                message: `Verification code sent via ${channels}`,
                requiresOTP: true,
                user: {
                    Id: user.Id,
                    Email: user.Email,
                    FirstName: user.FirstName,
                    LastName: user.LastName,
                    PhoneNumber: user.PhoneNumber,
                },
                roles,
            };
        }
        catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: error.message || 'Login failed. Please try again.'
            };
        }
    }
    // Login with OTP only (no password required)
    async loginWithOTP(identifier, ipAddress, userAgent) {
        console.log(`📱 OTP login requested for: ${identifier}`);
        try {
            const user = await this.findUserByIdentifier(identifier);
            if (!user) {
                await (0, auditService_js_1.auditLog)(null, 'LOGIN_FAILED', 'User', identifier, null, null, ipAddress, userAgent);
                return { success: false, message: 'User not found' };
            }
            // Generate OTP
            const otp = this.generateOTP();
            await this.storeOTP(user.Id, user.Email, otp, 'email');
            // 📨 Deliver via email + WhatsApp in parallel
            const [emailSent, whatsappSent] = await Promise.all([
                this.sendOTPEmail(user.Email, otp, user.FirstName),
                user.PhoneNumber
                    ? (0, whatsappService_js_1.sendWhatsAppOTP)(user.PhoneNumber, otp, user.FirstName)
                    : Promise.resolve(false),
            ]);
            if (!emailSent && !whatsappSent) {
                await (0, auditService_js_1.auditLog)(user.Id, 'OTP_FAILED', 'User', user.Email, null, null, ipAddress, userAgent);
                return { success: false, message: 'Failed to send verification code. Please try again.' };
            }
            const roles = await this.getUserRoles(user.Id);
            await (0, auditService_js_1.auditLog)(user.Id, 'OTP_SENT', 'User', user.Email, null, null, ipAddress, userAgent);
            const channels = [
                emailSent ? 'email' : null,
                whatsappSent ? 'WhatsApp' : null,
            ].filter(Boolean).join(' and ');
            return {
                success: true,
                message: `Verification code sent via ${channels}`,
                requiresOTP: true,
                user: {
                    Id: user.Id,
                    Email: user.Email,
                    FirstName: user.FirstName,
                    LastName: user.LastName,
                    PhoneNumber: user.PhoneNumber,
                },
                roles,
            };
        }
        catch (error) {
            console.error('OTP login error:', error);
            return {
                success: false,
                message: error.message || 'Failed to send verification code'
            };
        }
    }
    // Verify OTP and complete login
    async verifyLogin(identifier, otp, ipAddress, userAgent) {
        console.log(`✅ Verifying OTP for: ${identifier}`);
        try {
            const matchedUser = await this.findUserByIdentifier(identifier);
            if (!matchedUser) {
                await (0, auditService_js_1.auditLog)(null, 'OTP_INVALID', 'User', identifier, null, null, ipAddress, userAgent);
                return { success: false, message: 'Invalid or expired verification code' };
            }
            // Verify OTP
            // OTPs are stored against the account email, even when login used a phone or username.
            const { valid, userId } = await this.verifyOTP(matchedUser.Email, otp);
            if (!valid || !userId) {
                await (0, auditService_js_1.auditLog)(null, 'OTP_INVALID', 'User', identifier, null, null, ipAddress, userAgent);
                return { success: false, message: 'Invalid or expired verification code' };
            }
            // Get user
            const pool = await pool_1.poolPromise;
            const client = await pool.connect();
            let user;
            try {
                const result = await client.query(`SELECT * FROM "Users" WHERE "Id" = $1 AND "Status" = true`, [userId]);
                if (result.rows.length === 0) {
                    return { success: false, message: 'User not found' };
                }
                user = result.rows[0];
            }
            finally {
                client.release();
            }
            const roles = await this.getUserRoles(user.Id);
            // Generate tokens
            const { token, refreshToken } = this.generateTokens(user.Id, user.Email, roles);
            // Store session
            const sessionClient = await pool.connect();
            try {
                await sessionClient.query(`INSERT INTO "Sessions" ("UserId", "Token", "RefreshToken", "UserAgent", "IpAddress", "ExpiresAt", "CreatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days', NOW())`, [user.Id, token, refreshToken, userAgent, ipAddress]);
            }
            finally {
                sessionClient.release();
            }
            await (0, auditService_js_1.auditLog)(user.Id, 'LOGIN_SUCCESS', 'User', user.Email, null, null, ipAddress, userAgent);
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
        }
        catch (error) {
            console.error('OTP verification error:', error);
            return {
                success: false,
                message: error.message || 'Verification failed. Please try again.'
            };
        }
    }
    // Logout
    async logout(token, userId, ipAddress, userAgent) {
        try {
            const pool = await pool_1.poolPromise;
            const client = await pool.connect();
            try {
                await client.query(`DELETE FROM "Sessions" WHERE "Token" = $1`, [token]);
                await (0, auditService_js_1.auditLog)(userId, 'LOGOUT', 'Session', token, null, null, ipAddress, userAgent);
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('Logout error:', error);
        }
    }
    // Get current user with roles
    async getCurrentUser(userId) {
        try {
            const pool = await pool_1.poolPromise;
            const client = await pool.connect();
            try {
                const result = await client.query(`SELECT "Id", "FirstName", "LastName", "Email", "UserName", "PhoneNumber", "Status"
          FROM "Users" WHERE "Id" = $1`, [userId]);
                if (result.rows.length === 0) {
                    return null;
                }
                const user = result.rows[0];
                // ✅ GET USER ROLES
                const rolesResult = await client.query(`SELECT r."Name" FROM "UserRoles" ur
          JOIN "Roles" r ON ur."RoleId" = r."Id"
          WHERE ur."UserId" = $1`, [userId]);
                const roles = rolesResult.rows.map(row => row.Name);
                console.log(`🔍 getCurrentUser: User ${userId} has roles:`, roles);
                return { ...user, roles };
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    }
    // Migrate roles from SQL Server
    async migrateRoles() {
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
            const pool = await pool_1.poolPromise;
            const client = await pool.connect();
            try {
                for (const roleName of defaultRoles) {
                    await client.query(`INSERT INTO "Roles" ("Name", "NormalizedName") 
             VALUES ($1, $2)
             ON CONFLICT ("Name") DO NOTHING`, [roleName, roleName.toUpperCase()]);
                }
                console.log('✅ Roles migrated successfully');
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('Failed to migrate roles:', error);
        }
    }
}
exports.default = new AuthService();
