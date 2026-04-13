import { Request, Response } from 'express';
import { poolPromise } from '../db/pool';
import { auditLog } from '../services/auditService';

// Helper functions for safe parameter passing
const getClientIp = (req: Request): string | null => {
  const ip = req.ip || req.socket?.remoteAddress || null;
  if (ip === '::1') return '127.0.0.1';
  if (ip === '::ffff:127.0.0.1') return '127.0.0.1';
  return ip;
};

const getUserAgent = (req: Request): string | null => {
  return req.headers['user-agent'] || null;
};

// ==================== CLIENT MANAGEMENT ====================

// Register a new client
export const registerClient = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
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
      DateOfBirth,
      Age
    } = req.body;

    // Validate required fields
    if (!IDNumber || !FirstName || !LastName || !DateOfBirth || !PhoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: IDNumber, FirstName, LastName, DateOfBirth, PhoneNumber'
      });
    }

    // Check if client already exists
    const existingClient = await pool.query(
      `SELECT "Id" FROM "Clients" WHERE "IDNumber" = $1 OR "PhoneNumber" = $2`,
      [IDNumber, PhoneNumber]
    );

    if (existingClient.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Client with this ID Number or Phone Number already exists'
      });
    }

    const now = new Date();

    const result = await pool.query(
      `INSERT INTO "Clients" (
        "UserId", "IDNumber", "FullName", "FirstName", "LastName", "GenderId",
        "PhoneNumber", "CategoryId", "StationId", "DateOfBirth", "Age",
        "PostedOn", "UpdatedOn", "Pinned", "Status", "Deleted"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING "Id"`,
      [
        UserId || 1, IDNumber, FullName || `${FirstName} ${LastName}`, FirstName, LastName,
        GenderId || 1, PhoneNumber, CategoryId || 1, StationId || 1,
        DateOfBirth, Age || 0, now, now, false, true, false
      ]
    );

    await auditLog(
      UserId || 1,
      'CLIENT_REGISTERED',
      'Clients',
      result.rows[0].Id.toString(),
      null,
      { IDNumber, FullName, PhoneNumber },
      getClientIp(req),
      getUserAgent(req)
    );

    res.status(201).json({
      success: true,
      message: 'Client registered successfully',
      Id: result.rows[0].Id
    });
  } catch (error) {
    console.error('Error registering client:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Search clients by ID Number, Name, or Phone Number
export const searchClients = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    const searchTerm = `%${q.toLowerCase()}%`;

    const result = await pool.query(
      `SELECT 
        c."Id", c."IDNumber", c."FullName", c."FirstName", c."LastName",
        c."PhoneNumber", c."GenderId", c."CategoryId", c."StationId",
        c."DateOfBirth", c."Age", c."Status",
        cat."Title" as "CategoryTitle",
        s."Title" as "StationTitle",
        g."Title" as "GenderTitle"
      FROM "Clients" c
      LEFT JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE c."Deleted" = false
        AND (
          LOWER(c."IDNumber") LIKE $1
          OR LOWER(c."FullName") LIKE $1
          OR LOWER(c."FirstName") LIKE $1
          OR LOWER(c."LastName") LIKE $1
          OR c."PhoneNumber" LIKE $1
        )
      ORDER BY c."FullName"
      LIMIT 50`,
      [searchTerm]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get client by ID
export const getClientById = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        c."Id", c."IDNumber", c."FullName", c."FirstName", c."LastName",
        c."PhoneNumber", c."GenderId", c."CategoryId", c."StationId",
        c."DateOfBirth", c."Age", c."Status", c."PostedOn", c."UpdatedOn",
        cat."Title" as "CategoryTitle",
        s."Title" as "StationTitle",
        g."Title" as "GenderTitle"
      FROM "Clients" c
      LEFT JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE c."Id" = $1 AND c."Deleted" = false`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Check if client has field findings
export const checkFieldFindings = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT COUNT(*) as count FROM "Tallies" WHERE "ClientId" = $1 AND "Deleted" = false`,
      [id]
    );

    res.json({ hasFindings: parseInt(result.rows[0].count) > 0 });
  } catch (error) {
    console.error('Error checking field findings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== FIELD FINDINGS (TALLIES) ====================

// Save field findings (Tallies)
export const saveFieldFindings = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const {
      ClientId,
      StationId,
      Age,
      Weight,
      Height,
      BMIValue,
      BMIINTValueId,
      Waist,
      Hip,
      WHRatio,
      Systolic,
      Diastolic,
      BPINTValueId,
      RBSValue,
      RBSINTValueId,
      BMD,
      CancerSCN,
      DentalSCN,
      ECG,
      EyeSCN,
      FBS,
      HBA1C,
      HepatitisBC,
      Lipid,
      Microalbumin,
      NutritionCounselling,
      PSA
    } = req.body;

    const userId = (req as any).user?.userId || 1;
    const now = new Date();

    // Get client's gender and category
    const clientInfo = await pool.query(
      `SELECT "GenderId", "CategoryId" FROM "Clients" WHERE "Id" = $1`,
      [ClientId]
    );

    if (clientInfo.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const result = await pool.query(
      `INSERT INTO "Tallies" (
        "UserId", "ClientId", "GenderId", "CategoryId", "StationId",
        "Age", "Weight", "Height", "BMIValue", "BMIINTValueId",
        "Waist", "Hip", "WHRatio", "Systolic", "Diastolic", "BPINTValueId",
        "RBSValue", "RBSINTValueId", "BMD", "CancerSCN", "DentalSCN",
        "ECG", "EyeSCN", "FBS", "HBA1C", "HepatitisBC", "Lipid",
        "Microalbumin", "NutritionCounselling", "PSA",
        "PostedOn", "UpdatedOn", "Pinned", "Status", "Deleted"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
      RETURNING "Id"`,
      [
        userId, ClientId, clientInfo.rows[0].GenderId, clientInfo.rows[0].CategoryId, StationId,
        Age, Weight, Height, BMIValue, BMIINTValueId,
        Waist, Hip, WHRatio, Systolic, Diastolic, BPINTValueId,
        RBSValue, RBSINTValueId, BMD || false, CancerSCN || false, DentalSCN || false,
        ECG || false, EyeSCN || false, FBS || false, HBA1C || false, HepatitisBC || false,
        Lipid || false, Microalbumin || false, NutritionCounselling || false, PSA || false,
        now, now, false, true, false
      ]
    );

    await auditLog(
      userId,
      'FIELD_FINDINGS_SAVED',
      'Tallies',
      result.rows[0].Id.toString(),
      null,
      { ClientId, StationId },
      getClientIp(req),
      getUserAgent(req)
    );

    res.status(201).json({
      success: true,
      message: 'Field findings saved successfully',
      Id: result.rows[0].Id
    });
  } catch (error) {
    console.error('Error saving field findings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== LAB FINDINGS ====================

// Save lab findings
export const saveLabFindings = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const {
      ClientId,
      StationId,
      FBSValue,
      FBSINTValueId,
      HBA1CValue,
      HBA1CINTValueId,
      LipidId,
      MicroalbuminValue,
      MicroalbuminINTValueId,
      BMDValue,
      BMDINTValueId,
      PSAValue,
      PSAINTValueId,
      HepatitisBValueId,
      HepatitisCValueId
    } = req.body;

    const userId = (req as any).user?.userId || 1;
    const now = new Date();

    // Verify client has field findings first
    const hasFindings = await pool.query(
      `SELECT COUNT(*) FROM "Tallies" WHERE "ClientId" = $1 AND "Deleted" = false`,
      [ClientId]
    );

    if (parseInt(hasFindings.rows[0].count) === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client must have field findings recorded before lab findings'
      });
    }

    // Get client's gender and category
    const clientInfo = await pool.query(
      `SELECT "GenderId", "CategoryId" FROM "Clients" WHERE "Id" = $1`,
      [ClientId]
    );

    const result = await pool.query(
      `INSERT INTO "Findings" (
        "UserId", "ClientId", "GenderId", "CategoryId", "StationId",
        "FBSValue", "FBSINTValueId", "HBA1CValue", "HBA1CINTValueId",
        "LipidId", "MicroalbuminValue", "MicroalbuminINTValueId",
        "BMDValue", "BMDINTValueId", "PSAValue", "PSAINTValueId",
        "HepatitisBValueId", "HepatitisCValueId",
        "PostedOn", "UpdatedOn", "Pinned", "Status", "Deleted"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING "Id"`,
      [
        userId, ClientId, clientInfo.rows[0].GenderId, clientInfo.rows[0].CategoryId, StationId,
        FBSValue, FBSINTValueId, HBA1CValue, HBA1CINTValueId,
        LipidId, MicroalbuminValue, MicroalbuminINTValueId,
        BMDValue, BMDINTValueId, PSAValue, PSAINTValueId,
        HepatitisBValueId, HepatitisCValueId,
        now, now, false, true, false
      ]
    );

    await auditLog(
      userId,
      'LAB_FINDINGS_SAVED',
      'Findings',
      result.rows[0].Id.toString(),
      null,
      { ClientId, StationId },
      getClientIp(req),
      getUserAgent(req)
    );

    res.status(201).json({
      success: true,
      message: 'Lab findings saved successfully',
      Id: result.rows[0].Id
    });
  } catch (error) {
    console.error('Error saving lab findings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== ONCOLOGY FINDINGS ====================

// Save oncology findings
export const saveOncologyFindings = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const {
      ClientId,
      StationId,
      BreastExamId,
      PAPSmearId,
      ViaVilliId
    } = req.body;

    const userId = (req as any).user?.userId || 1;
    const now = new Date();

    // Verify client has field findings first
    const hasFindings = await pool.query(
      `SELECT COUNT(*) FROM "Tallies" WHERE "ClientId" = $1 AND "Deleted" = false`,
      [ClientId]
    );

    if (parseInt(hasFindings.rows[0].count) === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client must have field findings recorded before oncology screening'
      });
    }

    // Get client's gender and category
    const clientInfo = await pool.query(
      `SELECT "GenderId", "CategoryId" FROM "Clients" WHERE "Id" = $1`,
      [ClientId]
    );

    const result = await pool.query(
      `INSERT INTO "Oncologies" (
        "UserId", "ClientId", "GenderId", "CategoryId", "StationId",
        "BreastExamId", "PAPSmearId", "ViaVilliId",
        "PostedOn", "UpdatedOn", "Pinned", "Status", "Deleted"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING "Id"`,
      [
        userId, ClientId, clientInfo.rows[0].GenderId, clientInfo.rows[0].CategoryId, StationId,
        BreastExamId, PAPSmearId, ViaVilliId,
        now, now, false, true, false
      ]
    );

    await auditLog(
      userId,
      'ONCOLOGY_FINDINGS_SAVED',
      'Oncologies',
      result.rows[0].Id.toString(),
      null,
      { ClientId, StationId },
      getClientIp(req),
      getUserAgent(req)
    );

    res.status(201).json({
      success: true,
      message: 'Oncology findings saved successfully',
      Id: result.rows[0].Id
    });
  } catch (error) {
    console.error('Error saving oncology findings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== LOOKUP VALUES ====================

// Get lookup values by type
export const getLookupValues = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { type } = req.params;

    const tableMap: Record<string, string> = {
      'breast-exam-values': 'BreastExams',
      'pap-smear-values': 'PAPSmears',
      'via-villi-values': 'ViaVillies',
      'fbs-values': 'FBSINTValues',
      'hba1c-values': 'HBA1CINTValues',
      'lipid-values': 'Lipids',
      'microalbumin-values': 'MicroalbuminINTValues',
      'bmd-values': 'BMDINTValues',
      'psa-values': 'PSAINTValues',
      'hepatitis-b-values': 'HepatitisBValues',
      'hepatitis-c-values': 'HepatitisCValues'
    };

    const tableName = tableMap[type];
    if (!tableName) {
      return res.status(400).json({ success: false, message: 'Invalid lookup type' });
    }

    const result = await pool.query(
      `SELECT "Id", "Title" FROM "${tableName}" WHERE "Deleted" = false ORDER BY "Id"`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lookup values:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== UPDATE FUNCTIONS ====================

// Update field findings
export const updateFieldFindings = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const updates = req.body;
    const userId = (req as any).user?.userId || 1;
    const now = new Date();

    // Build dynamic update query
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'Id' && key !== 'ClientId') {
        setClauses.push(`"${key}" = $${paramIndex++}`);
        values.push(value);
      }
    }

    setClauses.push(`"UpdatedOn" = $${paramIndex++}`);
    values.push(now);
    values.push(id);

    const query = `
      UPDATE "Tallies" 
      SET ${setClauses.join(', ')}
      WHERE "Id" = $${paramIndex} AND "Deleted" = false
      RETURNING "Id"
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Field findings not found' });
    }

    await auditLog(
      userId,
      'FIELD_FINDINGS_UPDATED',
      'Tallies',
      id,
      null,
      updates,
      getClientIp(req),
      getUserAgent(req)
    );

    res.json({
      success: true,
      message: 'Field findings updated successfully',
      Id: result.rows[0].Id
    });
  } catch (error) {
    console.error('Error updating field findings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update lab findings
export const updateLabFindings = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const updates = req.body;
    const userId = (req as any).user?.userId || 1;
    const now = new Date();

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'Id' && key !== 'ClientId') {
        setClauses.push(`"${key}" = $${paramIndex++}`);
        values.push(value);
      }
    }

    setClauses.push(`"UpdatedOn" = $${paramIndex++}`);
    values.push(now);
    values.push(id);

    const query = `
      UPDATE "Findings" 
      SET ${setClauses.join(', ')}
      WHERE "Id" = $${paramIndex} AND "Deleted" = false
      RETURNING "Id"
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lab findings not found' });
    }

    await auditLog(
      userId,
      'LAB_FINDINGS_UPDATED',
      'Findings',
      id,
      null,
      updates,
      getClientIp(req),
      getUserAgent(req)
    );

    res.json({
      success: true,
      message: 'Lab findings updated successfully',
      Id: result.rows[0].Id
    });
  } catch (error) {
    console.error('Error updating lab findings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update oncology findings
export const updateOncologyFindings = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const updates = req.body;
    const userId = (req as any).user?.userId || 1;
    const now = new Date();

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'Id' && key !== 'ClientId') {
        setClauses.push(`"${key}" = $${paramIndex++}`);
        values.push(value);
      }
    }

    setClauses.push(`"UpdatedOn" = $${paramIndex++}`);
    values.push(now);
    values.push(id);

    const query = `
      UPDATE "Oncologies" 
      SET ${setClauses.join(', ')}
      WHERE "Id" = $${paramIndex} AND "Deleted" = false
      RETURNING "Id"
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Oncology findings not found' });
    }

    await auditLog(
      userId,
      'ONCOLOGY_FINDINGS_UPDATED',
      'Oncologies',
      id,
      null,
      updates,
      getClientIp(req),
      getUserAgent(req)
    );

    res.json({
      success: true,
      message: 'Oncology findings updated successfully',
      Id: result.rows[0].Id
    });
  } catch (error) {
    console.error('Error updating oncology findings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== DELETE FUNCTIONS (Soft Delete) ====================

// Soft delete field findings
export const deleteFieldFindings = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const userId = (req as any).user?.userId || 1;
    const now = new Date();

    const result = await pool.query(
      `UPDATE "Tallies" SET "Deleted" = true, "UpdatedOn" = $1 WHERE "Id" = $2 RETURNING "Id"`,
      [now, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Field findings not found' });
    }

    await auditLog(
      userId,
      'FIELD_FINDINGS_DELETED',
      'Tallies',
      id,
      null,
      null,
      getClientIp(req),
      getUserAgent(req)
    );

    res.json({ success: true, message: 'Field findings deleted successfully' });
  } catch (error) {
    console.error('Error deleting field findings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
