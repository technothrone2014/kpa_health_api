
import { Request, Response } from 'express';
import { poolPromise } from '../db/pool';

// Helper function to build date filters for PostgreSQL
const addDateFilters = (query: string, params: any[], startDate?: any, endDate?: any) => {
  let modifiedQuery = query;
  if (startDate) {
    modifiedQuery += ` AND t."PostedOn" >= $${params.length + 1}`;
    params.push(startDate);
  }
  if (endDate) {
    modifiedQuery += ` AND t."PostedOn" <= $${params.length + 1}`;
    params.push(endDate);
  }
  return modifiedQuery;
};

// ==================== CLIENT SUMMARY ENDPOINTS ====================

// SUMMARY OF CLIENTS SEEN PER CATEGORY
export const getClientsPerCategory = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        cat."Title" AS "Category",
        COUNT(t."Id") AS "Count"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      WHERE cat."Title" IN ('EMPLOYEE', 'DEPENDENT', 'PORT USER')
        AND t."Deleted" = false
        AND c."Deleted" = false
        AND cat."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND t."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND t."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY cat."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getClientsPerCategory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF CLIENTS SEEN PER CATEGORY PER GENDER
export const getClientsPerCategoryPerGender = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        sex."Title" AS "Gender",
        COALESCE(SUM(CASE WHEN cat."Title" = 'EMPLOYEE' THEN 1 ELSE 0 END), 0) AS "EMPLOYEES",
        COALESCE(SUM(CASE WHEN cat."Title" = 'DEPENDENT' THEN 1 ELSE 0 END), 0) AS "DEPENDANTS",
        COALESCE(SUM(CASE WHEN cat."Title" = 'PORT USER' THEN 1 ELSE 0 END), 0) AS "PORT_USERS",
        COUNT(t."Id") AS "TOTAL"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "Genders" sex ON c."GenderId" = sex."Id"
      WHERE cat."Title" IN ('EMPLOYEE', 'DEPENDENT', 'PORT USER')
        AND sex."Title" IN ('Male', 'Female')
        AND t."Deleted" = false
        AND c."Deleted" = false
        AND cat."Deleted" = false
        AND sex."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND t."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND t."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY sex."Title"
      UNION ALL
      SELECT 
        'TOTAL' AS "Gender",
        SUM(COALESCE(SUM(CASE WHEN cat."Title" = 'EMPLOYEE' THEN 1 ELSE 0 END), 0)) OVER() AS "EMPLOYEES",
        SUM(COALESCE(SUM(CASE WHEN cat."Title" = 'DEPENDENT' THEN 1 ELSE 0 END), 0)) OVER() AS "DEPENDANTS",
        SUM(COALESCE(SUM(CASE WHEN cat."Title" = 'PORT USER' THEN 1 ELSE 0 END), 0)) OVER() AS "PORT_USERS",
        SUM(COUNT(t."Id")) OVER() AS "TOTAL"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "Genders" sex ON c."GenderId" = sex."Id"
      WHERE cat."Title" IN ('EMPLOYEE', 'DEPENDENT', 'PORT USER')
        AND sex."Title" IN ('Male', 'Female')
        AND t."Deleted" = false
        AND c."Deleted" = false
        AND cat."Deleted" = false
        AND sex."Deleted" = false
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getClientsPerCategoryPerGender:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF CLIENTS SEEN PER CATEGORY PER STATION
export const getClientsPerCategoryPerStation = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        stat."Title" AS "Station",
        COALESCE(SUM(CASE WHEN cat."Title" = 'EMPLOYEE' THEN 1 ELSE 0 END), 0) AS "EMP",
        COALESCE(SUM(CASE WHEN cat."Title" = 'DEPENDENT' THEN 1 ELSE 0 END), 0) AS "DEP",
        COALESCE(SUM(CASE WHEN cat."Title" = 'PORT USER' THEN 1 ELSE 0 END), 0) AS "PU",
        COUNT(t."Id") AS "TOTAL"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "Stations" stat ON c."StationId" = stat."Id"
      WHERE cat."Title" IN ('EMPLOYEE', 'DEPENDENT', 'PORT USER')
        AND t."Deleted" = false
        AND c."Deleted" = false
        AND stat."Deleted" = false
        AND cat."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND t."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND t."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY stat."Title"
      ORDER BY stat."Title"
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getClientsPerCategoryPerStation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== EMPLOYEE HEALTH METRICS ENDPOINTS ====================

// Helper function for health metrics with proper boolean handling
const getHealthMetrics = async (req: Request, res: Response, valueColumn: string, valueTable: string, joinCondition: string) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        v."Title" AS "${valueColumn}",
        COUNT(t."Id") AS "Count"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "${valueTable}" v ON t."${joinCondition}" = v."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND t."Deleted" = false
        AND c."Deleted" = false
        AND v."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND t."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND t."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY v."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(`Error in getEmployee${valueColumn}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES BLOOD PRESSURE RESULTS
export const getEmployeeBloodPressureResults = async (req: Request, res: Response) => {
  return getHealthMetrics(req, res, 'BloodPressureCategory', 'BPINTValues', 'BPINTValueId');
};

// SUMMARY OF EMPLOYEES BMI RESULTS
export const getEmployeeBMIResults = async (req: Request, res: Response) => {
  return getHealthMetrics(req, res, 'BMICategory', 'BMIINTValues', 'BMIINTValueId');
};

// SUMMARY OF EMPLOYEES RANDOM BLOOD SUGAR RESULTS
export const getEmployeeRandomBloodSugarResults = async (req: Request, res: Response) => {
  return getHealthMetrics(req, res, 'RandomBloodSugarCategory', 'RBSINTValues', 'RBSINTValueId');
};

// SUMMARY OF EMPLOYEES BMD RESULTS
export const getEmployeeBMDResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        b."Title" AS "BMDResult",
        COUNT(f."Id") AS "Count"
      FROM "Findings" f
      JOIN "Clients" c ON f."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "BMDINTValues" b ON f."BMDINTValueId" = b."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND f."Deleted" = false
        AND c."Deleted" = false
        AND b."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND f."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND f."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY b."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getEmployeeBMDResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES FBS RESULTS
export const getEmployeeFBSResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        fbs."Title" AS "FBSResult",
        COUNT(f."Id") AS "Count"
      FROM "Findings" f
      JOIN "Clients" c ON f."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "FBSINTValues" fbs ON f."FBSINTValueId" = fbs."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND f."Deleted" = false
        AND c."Deleted" = false
        AND fbs."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND f."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND f."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY fbs."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getEmployeeFBSResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES HBA1C RESULTS
export const getEmployeeHBA1CResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        h."Title" AS "HBA1CResult",
        COUNT(f."Id") AS "Count"
      FROM "Findings" f
      JOIN "Clients" c ON f."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "HBA1CINTValues" h ON f."HBA1CINTValueId" = h."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND f."Deleted" = false
        AND c."Deleted" = false
        AND h."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND f."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND f."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY h."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getEmployeeHBA1CResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES LIPID PROFILE RESULTS
export const getEmployeeLipidProfileResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        l."Title" AS "LipidResult",
        COUNT(f."Id") AS "Count"
      FROM "Findings" f
      JOIN "Clients" c ON f."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "Lipids" l ON f."LipidId" = l."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND f."Deleted" = false
        AND c."Deleted" = false
        AND l."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND f."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND f."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY l."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getEmployeeLipidProfileResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== CONTINUED: EMPLOYEE HEALTH METRICS ENDPOINTS ====================

// SUMMARY OF EMPLOYEES MICROALBUMIN RESULTS
export const getEmployeeMicroalbuminResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        m."Title" AS "MicroalbuminResult",
        COUNT(f."Id") AS "Count"
      FROM "Findings" f
      JOIN "Clients" c ON f."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "MicroalbuminINTValues" m ON f."MicroalbuminINTValueId" = m."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND f."Deleted" = false
        AND c."Deleted" = false
        AND m."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND f."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND f."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY m."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getEmployeeMicroalbuminResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES PSA RESULTS
export const getEmployeePSAResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        psa."Title" AS "PSAResult",
        COUNT(f."Id") AS "Count"
      FROM "Findings" f
      JOIN "Clients" c ON f."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "PSAINTValues" psa ON f."PSAINTValueId" = psa."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND f."Deleted" = false
        AND c."Deleted" = false
        AND psa."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND f."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND f."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY psa."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getEmployeePSAResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES HEPATITIS B & C RESULTS
export const getEmployeeHepatitisResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    // Hepatitis B query
    let hepBQuery = `
      SELECT 
        'Hepatitis B' AS "TestType",
        hb."Title" AS "Result",
        COUNT(f."Id") AS "Count"
      FROM "Findings" f
      JOIN "Clients" c ON f."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "HepatitisBValues" hb ON f."HepatitisBValueId" = hb."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND f."Deleted" = false
        AND c."Deleted" = false
        AND hb."Deleted" = false
    `;
    
    // Hepatitis C query
    let hepCQuery = `
      SELECT 
        'Hepatitis C' AS "TestType",
        hc."Title" AS "Result",
        COUNT(f."Id") AS "Count"
      FROM "Findings" f
      JOIN "Clients" c ON f."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "HepatitisCValues" hc ON f."HepatitisCValueId" = hc."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND f."Deleted" = false
        AND c."Deleted" = false
        AND hc."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      hepBQuery += ` AND f."PostedOn" >= $${params.length + 1}`;
      hepCQuery += ` AND f."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      hepBQuery += ` AND f."PostedOn" <= $${params.length + 1}`;
      hepCQuery += ` AND f."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    hepBQuery += ` GROUP BY hb."Title"`;
    hepCQuery += ` GROUP BY hc."Title"`;
    
    // Execute both queries
    const [hepBResult, hepCResult] = await Promise.all([
      pool.query(hepBQuery, params),
      pool.query(hepCQuery, params)
    ]);
    
    // Combine results
    const combinedResults = [...hepBResult.rows, ...hepCResult.rows];
    combinedResults.sort((a, b) => {
      if (a.TestType !== b.TestType) return a.TestType.localeCompare(b.TestType);
      return b.Count - a.Count;
    });
    
    res.json(combinedResults);
  } catch (error) {
    console.error('Error in getEmployeeHepatitisResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== ONCOLOGY ENDPOINTS ====================

// SUMMARY OF EMPLOYEES BREAST EXAM RESULTS
export const getEmployeeBreastExamResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        be."Title" AS "BreastExamResult",
        COUNT(o."Id") AS "Count"
      FROM "Oncologies" o
      JOIN "Clients" c ON o."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "BreastExams" be ON o."BreastExamId" = be."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND o."Deleted" = false
        AND c."Deleted" = false
        AND be."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND o."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND o."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY be."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getEmployeeBreastExamResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES PAPSMEAR RESULTS
export const getEmployeePAPSmearResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        pap."Title" AS "PAPSmearResult",
        COUNT(o."Id") AS "Count"
      FROM "Oncologies" o
      JOIN "Clients" c ON o."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "PAPSmears" pap ON o."PAPSmearId" = pap."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND o."Deleted" = false
        AND c."Deleted" = false
        AND pap."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND o."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND o."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY pap."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getEmployeePAPSmearResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES VIAVILLI RESULTS
export const getEmployeeViaVilliResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        vv."Title" AS "ViaVilliesResult",
        COUNT(o."Id") AS "Count"
      FROM "Oncologies" o
      JOIN "Clients" c ON o."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "ViaVillies" vv ON o."ViaVilliId" = vv."Id"
      WHERE cat."Title" = 'EMPLOYEE'
        AND o."Deleted" = false
        AND c."Deleted" = false
        AND vv."Deleted" = false
    `;
    
    const params: any[] = [];
    if (startDate) {
      query += ` AND o."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND o."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    query += `
      GROUP BY vv."Title"
      ORDER BY "Count" DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getEmployeeViaVilliResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== DASHBOARD OVERVIEW ====================
export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    // Get total clients seen
    let clientsQuery = `
      SELECT COUNT(DISTINCT c."Id") AS "TotalClients"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      WHERE t."Deleted" = false AND c."Deleted" = false
    `;
    
    // Get total tallies (visits)
    let talliesQuery = `
      SELECT COUNT("Id") AS "TotalVisits"
      FROM "Tallies"
      WHERE "Deleted" = false
    `;
    
    // Get category distribution
    let categoryQuery = `
      SELECT cat."Title" AS "Category", COUNT(t."Id") AS "Count"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      WHERE cat."Title" IN ('EMPLOYEE', 'DEPENDENT', 'PORT USER')
        AND t."Deleted" = false AND c."Deleted" = false AND cat."Deleted" = false
      GROUP BY cat."Title"
    `;
    
    const params: any[] = [];
    if (startDate) {
      clientsQuery += ` AND t."PostedOn" >= $${params.length + 1}`;
      talliesQuery += ` AND "PostedOn" >= $${params.length + 1}`;
      categoryQuery += ` AND t."PostedOn" >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      clientsQuery += ` AND t."PostedOn" <= $${params.length + 1}`;
      talliesQuery += ` AND "PostedOn" <= $${params.length + 1}`;
      categoryQuery += ` AND t."PostedOn" <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    const [clientsResult, talliesResult, categoryResult] = await Promise.all([
      pool.query(clientsQuery, params),
      pool.query(talliesQuery, params),
      pool.query(categoryQuery, params)
    ]);
    
    res.json({
      totalClients: clientsResult.rows[0]?.TotalClients || 0,
      totalVisits: talliesResult.rows[0]?.TotalVisits || 0,
      categoryDistribution: categoryResult.rows
    });
  } catch (error) {
    console.error('Error in getDashboardOverview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};