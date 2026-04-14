// controllers/usersController.ts
import { Request, Response } from "express";
import { poolPromise } from "../db/pool";

/**
 * Get all users (optionally filter by role)
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
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
        CONCAT(u."FirstName", ' ', u."LastName") as "FullName"
      FROM "Users" u
      WHERE u."Status" = true
    `;
    
    const params: any[] = [];
    
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
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching users",
      error: error 
    });
  }
};

/**
 * Get field agents only (users with FieldAgent role)
 */
export const getFieldAgents = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    
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
  } catch (error) {
    console.error("Error fetching field agents:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching field agents",
      error: error 
    });
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
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
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching user",
      error: error 
    });
  }
};
