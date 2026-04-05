import { Request, Response } from "express";
import { poolPromise } from "../db/pool";

/**
 * 🧩 GET all employees (clients)
 */
export const getAllEmployees = async (_req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT 
        c."Id",
        c."UserId",
        c."IDNumber",
        c."FullName",
        c."FirstName",
        c."LastName",
        c."GenderId",
        g."Title" AS "GenderTitle",
        c."PhoneNumber",
        c."CategoryId",
        cat."Title" AS "CategoryTitle",
        c."StationId",
        s."Title" AS "StationTitle",
        c."PostedOn",
        c."UpdatedOn",
        c."Pinned",
        c."Status",
        c."Deleted"
      FROM "Clients" c
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      LEFT JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      WHERE c."Deleted" = 0
      ORDER BY c."Id" DESC;
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ message: "Error fetching employees", error: err });
  }
};

/**
 * 🧩 GET employee by ID
 */
export const getEmployeeById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.query(
      'SELECT * FROM "Clients" WHERE "Id" = $1 AND "Deleted" = 0',
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Employee not found" });

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching employee:", err);
    res.status(500).json({ message: "Error fetching employee", error: err });
  }
};

/**
 * 🧩 CREATE new employee
 */
export const createEmployee = async (req: Request, res: Response) => {
  const {
    UserId,
    IDNumber,
    FullName,
    FirstName,
    LastName,
    GenderId,
    PhoneNumber,
    CategoryId,
    StationId,
  } = req.body;

  try {
    const pool = await poolPromise;
    const now = new Date();

    const result = await pool.query(
      `
        INSERT INTO "Clients" 
        ("UserId", "IDNumber", "FullName", "FirstName", "LastName", "GenderId", 
         "PhoneNumber", "CategoryId", "StationId", "PostedOn", "UpdatedOn", 
         "Pinned", "Status", "Deleted")
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING "Id"
      `,
      [
        UserId, IDNumber, FullName, FirstName, LastName, GenderId,
        PhoneNumber || null, CategoryId, StationId, now, now,
        0,  // Pinned
        1,  // Status
        0   // Deleted
      ]
    );

    res.status(201).json({
      message: "Employee created successfully",
      Id: result.rows[0].Id,
    });
  } catch (err) {
    console.error("Error creating employee:", err);
    res.status(500).json({ message: "Error creating employee", error: err });
  }
};

/**
 * 🧩 UPDATE employee
 */
export const updateEmployee = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    IDNumber,
    FullName,
    FirstName,
    LastName,
    GenderId,
    PhoneNumber,
    CategoryId,
    StationId,
    Status,
  } = req.body;

  try {
    const pool = await poolPromise;
    const now = new Date();

    const result = await pool.query(
      `
        UPDATE "Clients"
        SET 
          "IDNumber" = $1,
          "FullName" = $2,
          "FirstName" = $3,
          "LastName" = $4,
          "GenderId" = $5,
          "PhoneNumber" = $6,
          "CategoryId" = $7,
          "StationId" = $8,
          "UpdatedOn" = $9,
          "Status" = $10
        WHERE "Id" = $11 AND "Deleted" = 0
      `,
      [
        IDNumber, FullName, FirstName, LastName, GenderId,
        PhoneNumber || null, CategoryId, StationId, now,
        Status !== undefined ? Status : 1,
        id
      ]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "Employee not found" });

    res.status(200).json({ message: "Employee updated successfully" });
  } catch (err) {
    console.error("Error updating employee:", err);
    res.status(500).json({ message: "Error updating employee", error: err });
  }
};

/**
 * 🧩 DELETE (soft delete)
 */
export const deleteEmployee = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    const result = await pool.query(
      'UPDATE "Clients" SET "Deleted" = 1 WHERE "Id" = $1',
      [id]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "Employee not found" });

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error("Error deleting employee:", err);
    res.status(500).json({ message: "Error deleting employee", error: err });
  }
};