import { Request, Response } from "express";
import { poolPromise, dbSql } from "../db/pool";

/**
 * 🧩 GET all employees (clients)
 */
export const getAllEmployees = async (_req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        c.Id,
        c.UserId,
        c.IDNumber,
        c.FullName,
        c.FirstName,
        c.LastName,
        c.GenderId,
        g.Title AS GenderTitle,
        c.PhoneNumber,
        c.CategoryId,
        cat.Title AS CategoryTitle,
        c.StationId,
        s.Title AS StationTitle,
        c.PostedOn,
        c.UpdatedOn,
        c.Pinned,
        c.Status,
        c.Deleted
      FROM Clients c
      LEFT JOIN Genders g ON c.GenderId = g.Id
      LEFT JOIN Categories cat ON c.CategoryId = cat.Id
      LEFT JOIN Stations s ON c.StationId = s.Id
      WHERE c.Deleted = 0
      ORDER BY c.Id DESC;
    `);
    res.status(200).json(result.recordset);
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
    const result = await pool
      .request()
      .input("Id", dbSql.Int, id)
      .query("SELECT * FROM Clients WHERE Id = @Id AND Deleted = 0");

    if (result.recordset.length === 0)
      return res.status(404).json({ message: "Employee not found" });

    res.status(200).json(result.recordset[0]);
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

    const result = await pool
      .request()
      .input("UserId", dbSql.Int, UserId)
      .input("IDNumber", dbSql.NVarChar(20), IDNumber)
      .input("FullName", dbSql.NVarChar(40), FullName)
      .input("FirstName", dbSql.NVarChar(20), FirstName)
      .input("LastName", dbSql.NVarChar(20), LastName)
      .input("GenderId", dbSql.Int, GenderId)
      .input("PhoneNumber", dbSql.NVarChar(20), PhoneNumber || null)
      .input("CategoryId", dbSql.Int, CategoryId)
      .input("StationId", dbSql.Int, StationId)
      .input("PostedOn", dbSql.DateTime2, now)
      .input("UpdatedOn", dbSql.DateTime2, now)
      .input("Pinned", dbSql.Bit, 0)
      .input("Status", dbSql.Bit, 1)
      .input("Deleted", dbSql.Bit, 0)
      .query(`
        INSERT INTO Clients 
        (UserId, IDNumber, FullName, FirstName, LastName, GenderId, PhoneNumber, CategoryId, StationId, PostedOn, UpdatedOn, Pinned, Status, Deleted)
        VALUES 
        (@UserId, @IDNumber, @FullName, @FirstName, @LastName, @GenderId, @PhoneNumber, @CategoryId, @StationId, @PostedOn, @UpdatedOn, @Pinned, @Status, @Deleted);
        SELECT SCOPE_IDENTITY() AS Id;
      `);

    res.status(201).json({
      message: "Employee created successfully",
      Id: result.recordset[0].Id,
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

    const result = await pool
      .request()
      .input("Id", dbSql.Int, id)
      .input("IDNumber", dbSql.NVarChar(20), IDNumber)
      .input("FullName", dbSql.NVarChar(40), FullName)
      .input("FirstName", dbSql.NVarChar(20), FirstName)
      .input("LastName", dbSql.NVarChar(20), LastName)
      .input("GenderId", dbSql.Int, GenderId)
      .input("PhoneNumber", dbSql.NVarChar(20), PhoneNumber || null)
      .input("CategoryId", dbSql.Int, CategoryId)
      .input("StationId", dbSql.Int, StationId)
      .input("UpdatedOn", dbSql.DateTime2, now)
      .input("Status", dbSql.Bit, Status ?? 1)
      .query(`
        UPDATE Clients
        SET 
          IDNumber = @IDNumber,
          FullName = @FullName,
          FirstName = @FirstName,
          LastName = @LastName,
          GenderId = @GenderId,
          PhoneNumber = @PhoneNumber,
          CategoryId = @CategoryId,
          StationId = @StationId,
          UpdatedOn = @UpdatedOn,
          Status = @Status
        WHERE Id = @Id AND Deleted = 0
      `);

    if (result.rowsAffected[0] === 0)
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
    const result = await pool
      .request()
      .input("Id", dbSql.Int, id)
      .query(`
        UPDATE Clients
        SET Deleted = 1
        WHERE Id = @Id
      `);

    if (result.rowsAffected[0] === 0)
      return res.status(404).json({ message: "Employee not found" });

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error("Error deleting employee:", err);
    res.status(500).json({ message: "Error deleting employee", error: err });
  }
};
