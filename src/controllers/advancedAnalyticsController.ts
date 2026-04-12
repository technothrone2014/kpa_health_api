import { Request, Response } from 'express';
import { poolPromise } from '../db/pool';

// Dynamic filtering interface
interface FilterParams {
  startDate?: string;
  endDate?: string;
  categories?: string[];
  stations?: string[];
  ageRange?: { min: number; max: number };
  gender?: string;
  conditions?: string[];
  consecutiveTests?: number;
  threshold?: number;
}

// Build dynamic WHERE clause
const buildWhereClause = (params: FilterParams): { sql: string; values: any[] } => {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (params.startDate) {
    conditions.push(`t."PostedOn" >= $${paramIndex++}`);
    values.push(params.startDate);
  }
  if (params.endDate) {
    conditions.push(`t."PostedOn" <= $${paramIndex++}`);
    values.push(params.endDate);
  }
  if (params.categories && params.categories.length) {
    conditions.push(`cat."Title" = ANY($${paramIndex++})`);
    values.push(params.categories);
  }
  if (params.stations && params.stations.length) {
    conditions.push(`s."Title" = ANY($${paramIndex++})`);
    values.push(params.stations);
  }
  if (params.gender) {
    conditions.push(`g."Title" = $${paramIndex++}`);
    values.push(params.gender);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { sql: whereClause, values };
};

// Get health trends with dynamic filtering
export const getHealthTrends = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate, category, station } = req.query;
    
    let query = `
      SELECT 
        DATE(t."PostedOn") as date,
        COUNT(CASE WHEN bp."Title" = 'NORMAL' THEN 1 END) as normal_bp,
        COUNT(CASE WHEN bp."Title" = 'PRE-HYPERTENSION' THEN 1 END) as pre_hypertension,
        COUNT(CASE WHEN bp."Title" LIKE '%HYPERTENSION%' THEN 1 END) as hypertension,
        COUNT(CASE WHEN bmi."Title" = 'NORMAL' THEN 1 END) as normal_bmi,
        COUNT(CASE WHEN bmi."Title" = 'OVERWEIGHT' THEN 1 END) as overweight,
        COUNT(CASE WHEN bmi."Title" = 'OBESE' THEN 1 END) as obese,
        COUNT(*) as total_readings
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "BPINTValues" bp ON t."BPINTValueId" = bp."Id"
      JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
      JOIN "Stations" s ON c."StationId" = s."Id"
      WHERE t."Deleted" = false
        AND c."Deleted" = false
        AND cat."Deleted" = false
        AND t."PostedOn" IS NOT NULL
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    // Use the actual data range if no dates provided
    if (startDate && startDate !== '') {
      query += ` AND t."PostedOn" >= $${paramIndex++}`;
      params.push(startDate);
    }
    if (endDate && endDate !== '') {
      query += ` AND t."PostedOn" <= $${paramIndex++}`;
      params.push(endDate);
    }
    
    // If no date range provided, get data from the last 6 months
    if (!startDate && !endDate) {
      query += ` AND t."PostedOn" >= NOW() - INTERVAL '6 months'`;
    }
    
    if (category && category !== 'all') {
      query += ` AND cat."Title" = $${paramIndex++}`;
      params.push(category);
    }
    if (station && station !== 'all') {
      query += ` AND s."Title" = $${paramIndex++}`;
      params.push(station);
    }
    
    query += ` GROUP BY DATE(t."PostedOn") ORDER BY date DESC LIMIT 100`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getHealthTrends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Identify high-risk patients with consecutive abnormal readings
export const getHighRiskPatients = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { condition = 'hypertension', consecutiveCount = 2, threshold = 50 } = req.query;
    
    let conditionFilter = '';
    if (condition === 'hypertension') {
      conditionFilter = `bp."Title" IN ('STAGE I HYPERTENSION', 'STAGE II HYPERTENSION')`;
    } else if (condition === 'pre_hypertension') {
      conditionFilter = `bp."Title" = 'PRE-HYPERTENSION'`;
    } else if (condition === 'obesity') {
      conditionFilter = `bmi."Title" = 'OBESE'`;
    }
    
    const query = `
      SELECT 
        c."Id" as client_id,
        c."FullName",
        c."IDNumber",
        c."PhoneNumber",
        cat."Title" as "CategoryTitle",
        s."Title" as "StationTitle",
        COUNT(*) as total_readings,
        SUM(CASE WHEN ${conditionFilter} THEN 1 ELSE 0 END) as abnormal_count,
        ROUND((SUM(CASE WHEN ${conditionFilter} THEN 1 ELSE 0 END) * 100.0 / COUNT(*))::numeric, 2) as abnormal_percentage
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "Stations" s ON c."StationId" = s."Id"
      JOIN "BPINTValues" bp ON t."BPINTValueId" = bp."Id"
      JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
      JOIN "RBSINTValues" rbs ON t."RBSINTValueId" = rbs."Id"
      WHERE t."Deleted" = false
        AND c."Deleted" = false
        AND cat."Deleted" = false
        AND s."Deleted" = false
      GROUP BY c."Id", c."FullName", c."IDNumber", c."PhoneNumber", cat."Title", s."Title"
      HAVING SUM(CASE WHEN ${conditionFilter} THEN 1 ELSE 0 END) >= $1
        AND (SUM(CASE WHEN ${conditionFilter} THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) >= $2
      ORDER BY abnormal_percentage DESC
      LIMIT 50
    `;
    
    const result = await pool.query(query, [consecutiveCount, threshold]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in getHighRiskPatients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export reports in various formats
export const exportReport = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { format = 'json', startDate, endDate, type = 'summary' } = req.query;
    
    let data: any[] = [];
    
    if (type === 'summary') {
      const result = await pool.query(`
        SELECT 
          DATE(t."PostedOn") as date,
          COUNT(DISTINCT c."Id") as unique_patients,
          COUNT(*) as total_readings,
          COUNT(CASE WHEN bp."Title" = 'NORMAL' THEN 1 END) as normal_bp,
          COUNT(CASE WHEN bp."Title" = 'PRE-HYPERTENSION' THEN 1 END) as pre_hypertension,
          COUNT(CASE WHEN bp."Title" LIKE '%HYPERTENSION%' THEN 1 END) as hypertension,
          COUNT(CASE WHEN bmi."Title" = 'NORMAL' THEN 1 END) as normal_bmi,
          COUNT(CASE WHEN bmi."Title" = 'OVERWEIGHT' THEN 1 END) as overweight,
          COUNT(CASE WHEN bmi."Title" = 'OBESE' THEN 1 END) as obese
        FROM "Tallies" t
        JOIN "Clients" c ON t."ClientId" = c."Id"
        JOIN "BPINTValues" bp ON t."BPINTValueId" = bp."Id"
        JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
        WHERE t."Deleted" = false
        ${startDate ? `AND t."PostedOn" >= '${startDate}'` : ''}
        ${endDate ? `AND t."PostedOn" <= '${endDate}'` : ''}
        GROUP BY DATE(t."PostedOn")
        ORDER BY date DESC
      `);
      data = result.rows;
    }
    
    // Handle different export formats
    switch (format) {
      case 'csv':
        const csvHeaders = Object.keys(data[0] || {}).join(',');
        const csvRows = data.map(row => Object.values(row).join(','));
        const csv = [csvHeaders, ...csvRows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=report_${Date.now()}.csv`);
        res.send(csv);
        break;
        
      case 'json':
      default:
        res.json(data);
    }
  } catch (error) {
    console.error('Error in exportReport:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// AI-powered natural language query
export const naturalLanguageQuery = async (req: Request, res: Response) => {
  try {
    const { query, userId } = req.body;
    
    // Parse natural language to SQL (simplified example)
    const parsedQuery = parseNaturalLanguage(query);
    
    const pool = await poolPromise;
    const result = await pool.query(parsedQuery.sql, parsedQuery.params);
    
    // Log the query for learning
    await logQueryHistory(userId, query, result.rows);
    
    res.json({
      query,
      result: result.rows,
      insight: generateInsight(result.rows, query)
    });
  } catch (error) {
    console.error('Error in naturalLanguageQuery:', error);
    res.status(500).json({ error: 'Query processing failed' });
  }
};

// Helper: Parse natural language to SQL
const parseNaturalLanguage = (query: string): { sql: string; params: any[] } => {
  const lowerQuery = query.toLowerCase();
  let sql = '';
  const params: any[] = [];
  
  if (lowerQuery.includes('high blood pressure') || lowerQuery.includes('hypertension')) {
    sql = `
      SELECT c."FullName", c."IDNumber", bp."Title" as blood_pressure, t."PostedOn"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "BPINTValues" bp ON t."BPINTValueId" = bp."Id"
      WHERE bp."Title" LIKE '%HYPERTENSION%'
      ORDER BY t."PostedOn" DESC
      LIMIT 50
    `;
  } else if (lowerQuery.includes('obese') || lowerQuery.includes('overweight')) {
    sql = `
      SELECT c."FullName", c."IDNumber", bmi."Title" as bmi_status, t."PostedOn"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
      WHERE bmi."Title" IN ('OVERWEIGHT', 'OBESE')
      ORDER BY t."PostedOn" DESC
      LIMIT 50
    `;
  } else if (lowerQuery.includes('total employees') || lowerQuery.includes('headcount')) {
    sql = `SELECT COUNT(*) as total FROM "Clients" WHERE "Deleted" = false`;
  } else {
    sql = `
      SELECT * FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      LIMIT 100
    `;
  }
  
  return { sql, params };
};

// Log query history for AI learning
const logQueryHistory = async (userId: string, query: string, result: any[]) => {
  try {
    const pool = await poolPromise;
    await pool.query(`
      INSERT INTO "QueryHistory" ("UserId", "Query", "ResultCount", "Timestamp")
      VALUES ($1, $2, $3, NOW())
    `, [userId, query, result.length]);
  } catch (error) {
    console.error('Error logging query:', error);
  }
};

// Generate insights from query results
const generateInsight = (data: any[], query: string): string => {
  if (data.length === 0) return 'No data found for your query.';
  
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('high blood pressure') || lowerQuery.includes('hypertension')) {
    const hypertensiveCount = data.length;
    return `Found ${hypertensiveCount} patients with elevated blood pressure readings. Consider follow-up screenings.`;
  }
  
  if (lowerQuery.includes('obese') || lowerQuery.includes('overweight')) {
    return `Identified ${data.length} patients with BMI concerns. Recommend lifestyle intervention programs.`;
  }
  
  return `Query returned ${data.length} records.`;
};

export const getDateRange = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT 
        MIN(t."PostedOn") as earliest_date,
        MAX(t."PostedOn") as latest_date,
        COUNT(*) as total_records
      FROM "Tallies" t
      WHERE t."Deleted" = false
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error in getDateRange:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};