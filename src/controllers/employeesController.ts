import { Request, Response } from "express";
import { poolPromise } from "../db/pool";

/**
 * Get a filtered, paginated client directory; `all=true` is reserved for export.
 */
export const getAllEmployees = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const asList = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.map(String).filter(Boolean);
      if (typeof value === 'string' && value) return [value];
      return [];
    };

    const conditions = ['c."Deleted" = false'];
    const params: any[] = [];
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    if (search) {
      conditions.push(`(
        c."FullName" ILIKE $${params.length + 1}
        OR c."IDNumber" ILIKE $${params.length + 1}
        OR s."Title" ILIKE $${params.length + 1}
      )`);
      params.push(`%${search}%`);
    }

    if (req.query.status === 'active') conditions.push('c."Status" = true');
    if (req.query.status === 'inactive') conditions.push('c."Status" = false');

    if (typeof req.query.startDate === 'string' && req.query.startDate) {
      conditions.push(`c."PostedOn" >= $${params.length + 1}::date`);
      params.push(req.query.startDate);
    }
    if (typeof req.query.endDate === 'string' && req.query.endDate) {
      conditions.push(`c."PostedOn" < $${params.length + 1}::date + INTERVAL '1 day'`);
      params.push(req.query.endDate);
    }

    const stations = asList(req.query.stations);
    if (stations.length) {
      conditions.push(`s."Title" = ANY($${params.length + 1}::text[])`);
      params.push(stations);
    }

    const categories = asList(req.query.categories);
    if (categories.length) {
      conditions.push(`cat."Title" = ANY($${params.length + 1}::text[])`);
      params.push(categories);
    }

    if (req.query.gender === 'male' || req.query.gender === 'female') {
      conditions.push(`LOWER(g."Title") = $${params.length + 1}`);
      params.push(req.query.gender);
    }

    const sortColumns: Record<string, string> = {
      Id: 'c."Id"',
      FullName: 'c."FullName"',
      IDNumber: 'c."IDNumber"',
      CategoryTitle: 'cat."Title"',
      StationTitle: 's."Title"',
    };
    const requestedSort = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'FullName';
    const sortColumn = sortColumns[requestedSort] || sortColumns.FullName;
    const sortDirection = req.query.sortDirection === 'desc' ? 'DESC' : 'ASC';
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize || '10'), 10) || 10));
    const exportAll = req.query.all === 'true';
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countPromise = pool.query(`
      SELECT COUNT(*)::int AS total
      FROM "Clients" c
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      LEFT JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      ${whereClause}
    `, params);

    const limitClause = exportAll ? '' : `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = exportAll ? params : [...params, pageSize, (page - 1) * pageSize];
    const dataPromise = pool.query(`
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
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}, c."Id" DESC
      ${limitClause}
    `, dataParams);

    const [countResult, dataResult] = await Promise.all([countPromise, dataPromise]);
    res.status(200).json({
      data: dataResult.rows,
      total: countResult.rows[0]?.total || 0,
      page,
      pageSize: exportAll ? dataResult.rows.length : pageSize,
    });
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
      'SELECT * FROM "Clients" WHERE "Id" = $1 AND "Deleted" = false',
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
        false,  // Pinned (boolean)
        true,   // Status (boolean - active)
        false   // Deleted (boolean)
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

    // Convert Status to boolean if provided
    const statusBoolean = Status !== undefined ? (Status === true || Status === 1 || Status === '1' || Status === 'true') : true;

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
        WHERE "Id" = $11 AND "Deleted" = false
      `,
      [
        IDNumber, FullName, FirstName, LastName, GenderId,
        PhoneNumber || null, CategoryId, StationId, now,
        statusBoolean,
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
      'UPDATE "Clients" SET "Deleted" = true WHERE "Id" = $1',
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