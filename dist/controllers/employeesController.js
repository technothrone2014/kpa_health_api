"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEmployee = exports.updateEmployee = exports.createEmployee = exports.getEmployeeById = exports.getAllEmployees = void 0;
const pool_1 = require("../db/pool");
/**
 * 🧩 GET all employees (clients)
 */
const getAllEmployees = async (_req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
      WHERE c."Deleted" = false
      ORDER BY c."Id" DESC;
    `);
        res.status(200).json(result.rows);
    }
    catch (err) {
        console.error("Error fetching employees:", err);
        res.status(500).json({ message: "Error fetching employees", error: err });
    }
};
exports.getAllEmployees = getAllEmployees;
/**
 * 🧩 GET employee by ID
 */
const getEmployeeById = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await pool_1.poolPromise;
        const result = await pool.query('SELECT * FROM "Clients" WHERE "Id" = $1 AND "Deleted" = false', [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ message: "Employee not found" });
        res.status(200).json(result.rows[0]);
    }
    catch (err) {
        console.error("Error fetching employee:", err);
        res.status(500).json({ message: "Error fetching employee", error: err });
    }
};
exports.getEmployeeById = getEmployeeById;
/**
 * 🧩 CREATE new employee
 */
const createEmployee = async (req, res) => {
    const { UserId, IDNumber, FullName, FirstName, LastName, GenderId, PhoneNumber, CategoryId, StationId, } = req.body;
    try {
        const pool = await pool_1.poolPromise;
        const now = new Date();
        const result = await pool.query(`
        INSERT INTO "Clients" 
        ("UserId", "IDNumber", "FullName", "FirstName", "LastName", "GenderId", 
         "PhoneNumber", "CategoryId", "StationId", "PostedOn", "UpdatedOn", 
         "Pinned", "Status", "Deleted")
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING "Id"
      `, [
            UserId, IDNumber, FullName, FirstName, LastName, GenderId,
            PhoneNumber || null, CategoryId, StationId, now, now,
            false, // Pinned (boolean)
            true, // Status (boolean - active)
            false // Deleted (boolean)
        ]);
        res.status(201).json({
            message: "Employee created successfully",
            Id: result.rows[0].Id,
        });
    }
    catch (err) {
        console.error("Error creating employee:", err);
        res.status(500).json({ message: "Error creating employee", error: err });
    }
};
exports.createEmployee = createEmployee;
/**
 * 🧩 UPDATE employee
 */
const updateEmployee = async (req, res) => {
    const { id } = req.params;
    const { IDNumber, FullName, FirstName, LastName, GenderId, PhoneNumber, CategoryId, StationId, Status, } = req.body;
    try {
        const pool = await pool_1.poolPromise;
        const now = new Date();
        // Convert Status to boolean if provided
        const statusBoolean = Status !== undefined ? (Status === true || Status === 1 || Status === '1' || Status === 'true') : true;
        const result = await pool.query(`
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
        WHERE "Id" = $11 AND "Deleted" = false
      `, [
            IDNumber, FullName, FirstName, LastName, GenderId,
            PhoneNumber || null, CategoryId, StationId, now,
            statusBoolean,
            id
        ]);
        if (result.rowCount === 0)
            return res.status(404).json({ message: "Employee not found" });
        res.status(200).json({ message: "Employee updated successfully" });
    }
    catch (err) {
        console.error("Error updating employee:", err);
        res.status(500).json({ message: "Error updating employee", error: err });
    }
};
exports.updateEmployee = updateEmployee;
/**
 * 🧩 DELETE (soft delete)
 */
const deleteEmployee = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await pool_1.poolPromise;
        const result = await pool.query('UPDATE "Clients" SET "Deleted" = true WHERE "Id" = $1', [id]);
        if (result.rowCount === 0)
            return res.status(404).json({ message: "Employee not found" });
        res.status(200).json({ message: "Employee deleted successfully" });
    }
    catch (err) {
        console.error("Error deleting employee:", err);
        res.status(500).json({ message: "Error deleting employee", error: err });
    }
};
exports.deleteEmployee = deleteEmployee;
