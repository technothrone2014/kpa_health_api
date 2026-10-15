"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelligentQuery = exports.getRBSDistribution = exports.getDataDateRange = exports.getCategories = exports.getStations = exports.getMultiVisitAbnormal = exports.getHighRiskPatients = exports.getAbnormalReadings = exports.getSummaryMetrics = exports.getDateRange = exports.naturalLanguageQuery = exports.exportReport = exports.getHealthTrends = void 0;
const pool_1 = require("../db/pool");
const advancedAnalyticsService_1 = __importDefault(require("../services/advancedAnalyticsService"));
const intelligentQueryService_1 = __importDefault(require("../services/intelligentQueryService"));
// Build dynamic WHERE clause
const buildWhereClause = (params) => {
    const conditions = [];
    const values = [];
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
const getHealthTrends = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getHealthTrends:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getHealthTrends = getHealthTrends;
// Export reports in various formats
const exportReport = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { format = 'json', startDate, endDate, type = 'summary' } = req.query;
        let data = [];
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
    }
    catch (error) {
        console.error('Error in exportReport:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.exportReport = exportReport;
// AI-powered natural language query
const naturalLanguageQuery = async (req, res) => {
    try {
        const { query, userId } = req.body;
        // Parse natural language to SQL (simplified example)
        const parsedQuery = parseNaturalLanguage(query);
        const pool = await pool_1.poolPromise;
        const result = await pool.query(parsedQuery.sql, parsedQuery.params);
        // Log the query for learning
        await logQueryHistory(userId, query, result.rows);
        res.json({
            query,
            result: result.rows,
            insight: generateInsight(result.rows, query)
        });
    }
    catch (error) {
        console.error('Error in naturalLanguageQuery:', error);
        res.status(500).json({ error: 'Query processing failed' });
    }
};
exports.naturalLanguageQuery = naturalLanguageQuery;
// Helper: Parse natural language to SQL
const parseNaturalLanguage = (query) => {
    const lowerQuery = query.toLowerCase();
    let sql = '';
    const params = [];
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
    }
    else if (lowerQuery.includes('obese') || lowerQuery.includes('overweight')) {
        sql = `
      SELECT c."FullName", c."IDNumber", bmi."Title" as bmi_status, t."PostedOn"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
      WHERE bmi."Title" IN ('OVERWEIGHT', 'OBESE')
      ORDER BY t."PostedOn" DESC
      LIMIT 50
    `;
    }
    else if (lowerQuery.includes('total employees') || lowerQuery.includes('headcount')) {
        sql = `SELECT COUNT(*) as total FROM "Clients" WHERE "Deleted" = false`;
    }
    else {
        sql = `
      SELECT * FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      LIMIT 100
    `;
    }
    return { sql, params };
};
// Log query history for AI learning
const logQueryHistory = async (userId, query, result) => {
    try {
        const pool = await pool_1.poolPromise;
        await pool.query(`
      INSERT INTO "QueryHistory" ("UserId", "Query", "ResultCount", "Timestamp")
      VALUES ($1, $2, $3, NOW())
    `, [userId, query, result.length]);
    }
    catch (error) {
        console.error('Error logging query:', error);
    }
};
// Generate insights from query results
const generateInsight = (data, query) => {
    if (data.length === 0)
        return 'No data found for your query.';
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
const getDateRange = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const result = await pool.query(`
      SELECT 
        MIN(t."PostedOn") as earliest_date,
        MAX(t."PostedOn") as latest_date,
        COUNT(*) as total_records
      FROM "Tallies" t
      WHERE t."Deleted" = false
    `);
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error in getDateRange:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getDateRange = getDateRange;
// Get summary metrics
const getSummaryMetrics = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            category: req.query.category,
            station: req.query.station,
            gender: req.query.gender
        };
        const metrics = await advancedAnalyticsService_1.default.getSummaryMetrics(filters);
        res.json({ success: true, data: metrics });
    }
    catch (error) {
        console.error('Error in getSummaryMetrics:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getSummaryMetrics = getSummaryMetrics;
// Get abnormal readings distribution
const getAbnormalReadings = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            category: req.query.category,
            station: req.query.station,
            gender: req.query.gender
        };
        const readings = await advancedAnalyticsService_1.default.getAbnormalReadings(filters);
        res.json({ success: true, data: readings });
    }
    catch (error) {
        console.error('Error in getAbnormalReadings:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getAbnormalReadings = getAbnormalReadings;
// Get high-risk patients
const getHighRiskPatients = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            category: req.query.category,
            station: req.query.station,
            gender: req.query.gender
        };
        const patients = await advancedAnalyticsService_1.default.getHighRiskPatients(filters);
        res.json({ success: true, data: patients });
    }
    catch (error) {
        console.error('Error in getHighRiskPatients:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getHighRiskPatients = getHighRiskPatients;
// Get multi-visit patients with abnormal readings
const getMultiVisitAbnormal = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            category: req.query.category,
            station: req.query.station,
            gender: req.query.gender,
            minVisits: req.query.minVisits ? parseInt(req.query.minVisits) : 2
        };
        const patients = await advancedAnalyticsService_1.default.getMultiVisitAbnormalPatients(filters);
        res.json({ success: true, data: patients });
    }
    catch (error) {
        console.error('Error in getMultiVisitAbnormal:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getMultiVisitAbnormal = getMultiVisitAbnormal;
// Get stations for filter dropdown
const getStations = async (req, res) => {
    try {
        const stations = await advancedAnalyticsService_1.default.getStations();
        res.json({ success: true, data: stations });
    }
    catch (error) {
        console.error('Error in getStations:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getStations = getStations;
// Get categories for filter dropdown
const getCategories = async (req, res) => {
    try {
        const categories = await advancedAnalyticsService_1.default.getCategories();
        res.json({ success: true, data: categories });
    }
    catch (error) {
        console.error('Error in getCategories:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getCategories = getCategories;
// Get data date range
const getDataDateRange = async (req, res) => {
    try {
        const dateRange = await advancedAnalyticsService_1.default.getDataDateRange();
        res.json({ success: true, data: dateRange });
    }
    catch (error) {
        console.error('Error in getDataDateRange:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getDataDateRange = getDataDateRange;
// Get RBS distribution for charts
const getRBSDistribution = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { startDate, endDate, category, station, gender } = req.query;
        let query = `
      SELECT 
        rbs."Title" as "RBSCategory",
        COUNT(*) as "Count"
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "RBSINTValues" rbs ON t."RBSINTValueId" = rbs."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false AND t."Status" = true
        AND c."Deleted" = false
    `;
        const params = [];
        let paramIndex = 1;
        if (startDate) {
            query += ` AND t."PostedOn" >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND t."PostedOn" <= $${paramIndex++}`;
            params.push(endDate);
        }
        if (category && category !== 'all') {
            query += ` AND cat."Title" = $${paramIndex++}`;
            params.push(category);
        }
        if (station && station !== 'all') {
            query += ` AND s."Title" = $${paramIndex++}`;
            params.push(station);
        }
        if (gender && gender !== 'all') {
            query += ` AND g."Title" = $${paramIndex++}`;
            params.push(gender);
        }
        query += ` GROUP BY rbs."Title" ORDER BY "Count" DESC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error in getRBSDistribution:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getRBSDistribution = getRBSDistribution;
// Intelligent natural language query with clinical context
const intelligentQuery = async (req, res) => {
    try {
        const { query, filters } = req.body;
        if (!query) {
            return res.status(400).json({ success: false, error: 'Query is required' });
        }
        const result = await intelligentQueryService_1.default.executeQuery(query, filters);
        res.json({
            success: true,
            query,
            count: result.count,
            executionTime: result.executionTime,
            insight: result.insight,
            data: result.data,
            parsedIntent: result.parsedIntent
        });
    }
    catch (error) {
        console.error('Error in intelligentQuery:', error);
        res.status(500).json({
            success: false,
            error: 'Query processing failed',
            message: 'Try rephrasing your query or check your filters.'
        });
    }
};
exports.intelligentQuery = intelligentQuery;
