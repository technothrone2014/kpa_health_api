"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserWithRoles = exports.toggleUserStatus = exports.updateUser = exports.createUser = exports.getAllRoles = exports.getUserById = exports.getFieldAgents = exports.getUsers = void 0;
const pool_1 = require("../db/pool");
/**
 * Get all users (optionally filter by role)
 */
const getUsers = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { role } = req.query;
        let query = `
      SELECT 
        u."Id",
        u."FirstName",
        u."LastName",
        u."Email",
        u."UserName",
        u."PhoneNumber",
        u."Status",
        CONCAT(u."FirstName", ' ', u."LastName") as "FullName",
        COALESCE(
          (SELECT json_agg(json_build_object('Id', r."Id", 'Name', r."Name"))
           FROM "UserRoles" ur
           JOIN "Roles" r ON ur."RoleId" = r."Id"
           WHERE ur."UserId" = u."Id"),
          '[]'::json
        ) AS "Roles"
      FROM "Users" u
      WHERE 1=1
    `;
        const params = [];
        // Filter by role if specified
        if (role) {
            query += `
        AND EXISTS (
          SELECT 1 FROM "UserRoles" ur
          JOIN "Roles" r ON ur."RoleId" = r."Id"
          WHERE ur."UserId" = u."Id"
          AND (r."Name" = $1 OR r."NormalizedName" = $2)
        )
      `;
            params.push(role, role.toString().toUpperCase());
        }
        query += ` ORDER BY u."FirstName", u."LastName"`;
        const result = await pool.query(query, params);
        res.json({
            success: true,
            data: result.rows,
            count: result.rowCount
        });
    }
    catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching users",
            error: error
        });
    }
};
exports.getUsers = getUsers;
/**
 * Get field agents only (users with FieldAgent role)
 */
const getFieldAgents = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const result = await pool.query(`
      SELECT DISTINCT
        u."Id",
        u."FirstName",
        u."LastName",
        u."Email",
        u."UserName",
        u."PhoneNumber",
        CONCAT(u."FirstName", ' ', u."LastName") as "FullName"
      FROM "Users" u
      JOIN "UserRoles" ur ON u."Id" = ur."UserId"
      JOIN "Roles" r ON ur."RoleId" = r."Id"
      WHERE u."Status" = true
        AND (r."Name" = 'FieldAgent' OR r."NormalizedName" = 'FIELDAGENT')
      ORDER BY u."FirstName", u."LastName"
    `);
        res.json({
            success: true,
            data: result.rows,
            count: result.rowCount
        });
    }
    catch (error) {
        console.error("Error fetching field agents:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching field agents",
            error: error
        });
    }
};
exports.getFieldAgents = getFieldAgents;
/**
 * Get user by ID
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await pool_1.poolPromise;
        const result = await pool.query(`
      SELECT 
        u."Id",
        u."FirstName",
        u."LastName",
        u."Email",
        u."UserName",
        u."PhoneNumber",
        u."Status",
        CONCAT(u."FirstName", ' ', u."LastName") as "FullName"
      FROM "Users" u
      WHERE u."Id" = $1
    `, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        res.json({
            success: true,
            data: result.rows[0]
        });
    }
    catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching user",
            error: error
        });
    }
};
exports.getUserById = getUserById;
// ============================================
// Get all roles (for role assignment dropdown)
// ============================================
const getAllRoles = async (_req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const result = await pool.query(`SELECT "Id", "Name", "NormalizedName"
       FROM "Roles"
       ORDER BY "Id"`);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        console.error("Error fetching roles:", error);
        res.status(500).json({ success: false, message: "Error fetching roles" });
    }
};
exports.getAllRoles = getAllRoles;
// ============================================
// Create user (with password hash + role assignment)
// ============================================
const createUser = async (req, res) => {
    const pool = await pool_1.poolPromise;
    const client = await pool.connect();
    try {
        const { FirstName, LastName, Email, PhoneNumber, UserName, Password, RoleIds = [], } = req.body;
        // Validation
        if (!FirstName || !LastName || !Email || !PhoneNumber || !Password) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: FirstName, LastName, Email, PhoneNumber, Password",
            });
        }
        if (Password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters",
            });
        }
        // Check duplicate email
        const dup = await pool.query(`SELECT "Id" FROM "Users" WHERE LOWER("Email") = LOWER($1) LIMIT 1`, [Email]);
        if (dup.rows.length > 0) {
            return res.status(409).json({ success: false, message: "A user with this email already exists" });
        }
        // Hash password
        const bcrypt = await import("bcryptjs");
        const passwordHash = await bcrypt.default.hash(Password, 10);
        const now = new Date();
        const finalUserName = (UserName || Email.split("@")[0]).toLowerCase();
        const normalizedEmail = Email.toUpperCase();
        const normalizedUserName = finalUserName.toUpperCase();
        await client.query("BEGIN");
        // Insert user
        const userResult = await client.query(`INSERT INTO "Users" (
        "FirstName", "LastName", "RegDate", "Status", "UserName", "NormalizedUserName",
        "Email", "NormalizedEmail", "EmailConfirmed", "PasswordHash",
        "SecurityStamp", "ConcurrencyStamp", "PhoneNumber", "PhoneNumberConfirmed",
        "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING "Id"`, [
            FirstName, LastName, now, true, finalUserName, normalizedUserName,
            Email, normalizedEmail, false, passwordHash,
            crypto.randomUUID(), crypto.randomUUID(), PhoneNumber, false,
            false, false, 0,
        ]);
        const newUserId = userResult.rows[0].Id;
        // Assign roles
        if (Array.isArray(RoleIds) && RoleIds.length > 0) {
            const placeholders = RoleIds.map((_, i) => `($1, $${i + 2})`).join(", ");
            await client.query(`INSERT INTO "UserRoles" ("UserId", "RoleId") VALUES ${placeholders}`, [newUserId, ...RoleIds.map(Number)]);
        }
        await client.query("COMMIT");
        res.status(201).json({
            success: true,
            message: "User created successfully",
            Id: newUserId,
        });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating user:", error);
        res.status(500).json({ success: false, message: error.message || "Error creating user" });
    }
    finally {
        client.release();
    }
};
exports.createUser = createUser;
// ============================================
// Update user (basic info + roles)
// ============================================
const updateUser = async (req, res) => {
    const pool = await pool_1.poolPromise;
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { FirstName, LastName, Email, PhoneNumber, UserName, RoleIds } = req.body;
        if (!FirstName || !LastName || !Email || !PhoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: FirstName, LastName, Email, PhoneNumber",
            });
        }
        // Check email uniqueness (excluding self)
        const dup = await pool.query(`SELECT "Id" FROM "Users" WHERE LOWER("Email") = LOWER($1) AND "Id" <> $2 LIMIT 1`, [Email, id]);
        if (dup.rows.length > 0) {
            return res.status(409).json({ success: false, message: "A user with this email already exists" });
        }
        await client.query("BEGIN");
        await client.query(`UPDATE "Users"
       SET "FirstName" = $1, "LastName" = $2, "Email" = $3, "NormalizedEmail" = $4,
           "PhoneNumber" = $5, "UserName" = $6, "NormalizedUserName" = $7
       WHERE "Id" = $8`, [
            FirstName, LastName, Email, Email.toUpperCase(),
            PhoneNumber, UserName || Email.split("@")[0],
            (UserName || Email.split("@")[0]).toUpperCase(),
            id,
        ]);
        // Replace roles
        if (Array.isArray(RoleIds)) {
            await client.query(`DELETE FROM "UserRoles" WHERE "UserId" = $1`, [id]);
            if (RoleIds.length > 0) {
                const placeholders = RoleIds.map((_, i) => `($1, $${i + 2})`).join(", ");
                await client.query(`INSERT INTO "UserRoles" ("UserId", "RoleId") VALUES ${placeholders}`, [id, ...RoleIds.map(Number)]);
            }
        }
        await client.query("COMMIT");
        res.json({ success: true, message: "User updated successfully", Id: id });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating user:", error);
        res.status(500).json({ success: false, message: error.message || "Error updating user" });
    }
    finally {
        client.release();
    }
};
exports.updateUser = updateUser;
// ============================================
// Toggle user status (activate/deactivate)
// ============================================
const toggleUserStatus = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { id } = req.params;
        const { Status } = req.body;
        if (typeof Status !== "boolean") {
            return res.status(400).json({ success: false, message: "Body must include { Status: true|false }" });
        }
        const result = await pool.query(`UPDATE "Users" SET "Status" = $1 WHERE "Id" = $2 RETURNING "Id", "Status"`, [Status, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({
            success: true,
            message: Status ? "User activated" : "User deactivated",
            data: result.rows[0],
        });
    }
    catch (error) {
        console.error("Error toggling user status:", error);
        res.status(500).json({ success: false, message: "Error toggling user status" });
    }
};
exports.toggleUserStatus = toggleUserStatus;
// ============================================
// Get user with roles (enhanced version of getUserById)
// ============================================
const getUserWithRoles = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { id } = req.params;
        const result = await pool.query(`SELECT 
        u."Id", u."FirstName", u."LastName", u."Email", u."UserName",
        u."PhoneNumber", u."Status",
        COALESCE(
          (SELECT json_agg(json_build_object('Id', r."Id", 'Name', r."Name"))
           FROM "UserRoles" ur
           JOIN "Roles" r ON ur."RoleId" = r."Id"
           WHERE ur."UserId" = u."Id"),
          '[]'::json
        ) AS "Roles"
       FROM "Users" u
       WHERE u."Id" = $1`, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ success: false, message: "Error fetching user" });
    }
};
exports.getUserWithRoles = getUserWithRoles;
