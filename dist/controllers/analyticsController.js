"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParticipationDaily = exports.getParticipationByPeriods = exports.getGenderDistribution = exports.getCategoryDistribution = exports.getStationDistribution = exports.getHighRiskClients = exports.getClientHealthStatus = exports.getDashboardOverview = exports.getEmployeeViaVilliResults = exports.getEmployeePAPSmearResults = exports.getEmployeeBreastExamResults = exports.getEmployeeHepatitisResults = exports.getEmployeePSAResults = exports.getEmployeeMicroalbuminResults = exports.getEmployeeLipidProfileResults = exports.getEmployeeHBA1CResults = exports.getEmployeeFBSResults = exports.getEmployeeBMDResults = exports.getEmployeeRandomBloodSugarResults = exports.getEmployeeBMIResults = exports.getEmployeeBloodPressureResults = exports.getClientsPerCategoryPerStation = exports.getClientsPerCategoryPerGender = exports.getClientsPerCategory = void 0;
const pool_1 = require("../db/pool");
const clientAnalyticsService_1 = __importDefault(require("../services/clientAnalyticsService"));
// Helper function to build date filters for PostgreSQL
const addDateFilters = (query, params, startDate, endDate) => {
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
const getClientsPerCategory = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getClientsPerCategory:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getClientsPerCategory = getClientsPerCategory;
// SUMMARY OF CLIENTS SEEN PER CATEGORY PER GENDER
const getClientsPerCategoryPerGender = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getClientsPerCategoryPerGender:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getClientsPerCategoryPerGender = getClientsPerCategoryPerGender;
// SUMMARY OF CLIENTS SEEN PER CATEGORY PER STATION
const getClientsPerCategoryPerStation = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getClientsPerCategoryPerStation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getClientsPerCategoryPerStation = getClientsPerCategoryPerStation;
// ==================== EMPLOYEE HEALTH METRICS ENDPOINTS ====================
// Helper function for health metrics with proper boolean handling
const getHealthMetrics = async (req, res, valueColumn, valueTable, joinCondition) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error(`Error in getEmployee${valueColumn}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
// SUMMARY OF EMPLOYEES BLOOD PRESSURE RESULTS
const getEmployeeBloodPressureResults = async (req, res) => {
    return getHealthMetrics(req, res, 'BloodPressureCategory', 'BPINTValues', 'BPINTValueId');
};
exports.getEmployeeBloodPressureResults = getEmployeeBloodPressureResults;
// SUMMARY OF EMPLOYEES BMI RESULTS
const getEmployeeBMIResults = async (req, res) => {
    return getHealthMetrics(req, res, 'BMICategory', 'BMIINTValues', 'BMIINTValueId');
};
exports.getEmployeeBMIResults = getEmployeeBMIResults;
// SUMMARY OF EMPLOYEES RANDOM BLOOD SUGAR RESULTS
const getEmployeeRandomBloodSugarResults = async (req, res) => {
    return getHealthMetrics(req, res, 'RandomBloodSugarCategory', 'RBSINTValues', 'RBSINTValueId');
};
exports.getEmployeeRandomBloodSugarResults = getEmployeeRandomBloodSugarResults;
// SUMMARY OF EMPLOYEES BMD RESULTS
const getEmployeeBMDResults = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getEmployeeBMDResults:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmployeeBMDResults = getEmployeeBMDResults;
// SUMMARY OF EMPLOYEES FBS RESULTS
const getEmployeeFBSResults = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getEmployeeFBSResults:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmployeeFBSResults = getEmployeeFBSResults;
// SUMMARY OF EMPLOYEES HBA1C RESULTS
const getEmployeeHBA1CResults = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getEmployeeHBA1CResults:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmployeeHBA1CResults = getEmployeeHBA1CResults;
// SUMMARY OF EMPLOYEES LIPID PROFILE RESULTS
const getEmployeeLipidProfileResults = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getEmployeeLipidProfileResults:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmployeeLipidProfileResults = getEmployeeLipidProfileResults;
// ==================== CONTINUED: EMPLOYEE HEALTH METRICS ENDPOINTS ====================
// SUMMARY OF EMPLOYEES MICROALBUMIN RESULTS
const getEmployeeMicroalbuminResults = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getEmployeeMicroalbuminResults:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmployeeMicroalbuminResults = getEmployeeMicroalbuminResults;
// SUMMARY OF EMPLOYEES PSA RESULTS
const getEmployeePSAResults = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getEmployeePSAResults:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmployeePSAResults = getEmployeePSAResults;
// SUMMARY OF EMPLOYEES HEPATITIS B & C RESULTS
const getEmployeeHepatitisResults = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
            if (a.TestType !== b.TestType)
                return a.TestType.localeCompare(b.TestType);
            return b.Count - a.Count;
        });
        res.json(combinedResults);
    }
    catch (error) {
        console.error('Error in getEmployeeHepatitisResults:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmployeeHepatitisResults = getEmployeeHepatitisResults;
// ==================== ONCOLOGY ENDPOINTS ====================
// SUMMARY OF EMPLOYEES BREAST EXAM RESULTS
const getEmployeeBreastExamResults = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getEmployeeBreastExamResults:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmployeeBreastExamResults = getEmployeeBreastExamResults;
// SUMMARY OF EMPLOYEES PAPSMEAR RESULTS
const getEmployeePAPSmearResults = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getEmployeePAPSmearResults:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmployeePAPSmearResults = getEmployeePAPSmearResults;
// SUMMARY OF EMPLOYEES VIAVILLI RESULTS
const getEmployeeViaVilliResults = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getEmployeeViaVilliResults:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmployeeViaVilliResults = getEmployeeViaVilliResults;
// ==================== DASHBOARD OVERVIEW ====================
const getDashboardOverview = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
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
        const params = [];
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
    }
    catch (error) {
        console.error('Error in getDashboardOverview:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getDashboardOverview = getDashboardOverview;
// Get client-based health status (correct clinical interpretation)
const getClientHealthStatus = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            category: req.query.category,
            station: req.query.station,
            gender: req.query.gender
        };
        const healthStatus = await clientAnalyticsService_1.default.getClientHealthStatus(filters);
        res.json({ success: true, data: healthStatus });
    }
    catch (error) {
        console.error('Error in getClientHealthStatus:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getClientHealthStatus = getClientHealthStatus;
// Get high risk patients with proper clinical context
const getHighRiskClients = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            category: req.query.category,
            station: req.query.station,
            gender: req.query.gender
        };
        const analytics = await clientAnalyticsService_1.default.getClientAnalytics(filters);
        res.json({ success: true, data: analytics.highRiskPatientsList });
    }
    catch (error) {
        console.error('Error in getHighRiskClients:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getHighRiskClients = getHighRiskClients;
// Get station distribution for dashboard
const getStationDistribution = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { startDate, endDate, category, gender } = req.query;
        let query = `
      SELECT 
        COALESCE(s."Title", 'Unknown') as station,
        COUNT(DISTINCT c."Id") as count
      FROM "Clients" c
      INNER JOIN "Tallies" t ON c."Id" = t."ClientId"
      INNER JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false 
        AND t."Status" = true
        AND c."Deleted" = false
        AND c."Status" = true
    `;
        const params = [];
        let paramIndex = 1;
        if (startDate && startDate !== '') {
            query += ` AND t."PostedOn" >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate && endDate !== '') {
            query += ` AND t."PostedOn" <= $${paramIndex++}`;
            params.push(endDate);
        }
        if (category && category !== 'all') {
            query += ` AND cat."Title" = $${paramIndex++}`;
            params.push(category);
        }
        if (gender && gender !== 'all') {
            query += ` AND g."Title" ILIKE $${paramIndex++}`;
            params.push(gender);
        }
        query += ` GROUP BY s."Title" ORDER BY count DESC`;
        console.log('Station Query:', query, 'Params:', params);
        const result = await pool.query(query, params);
        console.log('Station Result rows:', result.rows.length);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        console.error('Error in getStationDistribution:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getStationDistribution = getStationDistribution;
// Get category distribution for dashboard
const getCategoryDistribution = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { startDate, endDate, station, gender } = req.query;
        let query = `
      SELECT 
        cat."Title" as category,
        COUNT(DISTINCT c."Id") as count
      FROM "Clients" c
      INNER JOIN "Tallies" t ON c."Id" = t."ClientId"
      INNER JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false 
        AND t."Status" = true
        AND c."Deleted" = false
        AND c."Status" = true
    `;
        const params = [];
        let paramIndex = 1;
        if (startDate && startDate !== '') {
            query += ` AND t."PostedOn" >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate && endDate !== '') {
            query += ` AND t."PostedOn" <= $${paramIndex++}`;
            params.push(endDate);
        }
        if (station && station !== 'all') {
            query += ` AND s."Title" = $${paramIndex++}`;
            params.push(station);
        }
        if (gender && gender !== 'all') {
            query += ` AND g."Title" ILIKE $${paramIndex++}`;
            params.push(gender);
        }
        query += ` GROUP BY cat."Title" ORDER BY count DESC`;
        console.log('Category Query:', query, 'Params:', params);
        const result = await pool.query(query, params);
        console.log('Category Result rows:', result.rows.length);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        console.error('Error in getCategoryDistribution:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getCategoryDistribution = getCategoryDistribution;
// Get gender distribution for dashboard
const getGenderDistribution = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { startDate, endDate, category, station } = req.query;
        let query = `
      SELECT 
        COALESCE(g."Title", 'Unknown') as gender,
        COUNT(DISTINCT c."Id") as count
      FROM "Clients" c
      INNER JOIN "Tallies" t ON c."Id" = t."ClientId"
      INNER JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false 
        AND t."Status" = true
        AND c."Deleted" = false
        AND c."Status" = true
        AND g."Title" IS NOT NULL
    `;
        const params = [];
        let paramIndex = 1;
        if (startDate && startDate !== '') {
            query += ` AND t."PostedOn" >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate && endDate !== '') {
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
        query += ` GROUP BY g."Title" ORDER BY count DESC`;
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        console.error('Error in getGenderDistribution:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getGenderDistribution = getGenderDistribution;
// Get participation trends by EAP periods (with spillover handling)
const getParticipationByPeriods = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { startDate, endDate, category, station, gender } = req.query;
        const params = [];
        let whereClause = '';
        let paramIndex = 1;
        if (startDate && startDate !== '') {
            whereClause += ` AND t."PostedOn" >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate && endDate !== '') {
            whereClause += ` AND t."PostedOn" <= $${paramIndex++}`;
            params.push(endDate);
        }
        if (category && category !== 'all') {
            whereClause += ` AND cat."Title" = $${paramIndex++}`;
            params.push(category);
        }
        if (station && station !== 'all') {
            whereClause += ` AND s."Title" = $${paramIndex++}`;
            params.push(station);
        }
        if (gender && gender !== 'all') {
            whereClause += ` AND g."Title" ILIKE $${paramIndex++}`;
            params.push(gender);
        }
        const query = `
      WITH daily_tallies AS (
        SELECT 
          DATE(t."PostedOn") as screening_date,
          COUNT(*) as tally_count,
          COUNT(DISTINCT c."Id") as unique_clients
        FROM "Tallies" t
        JOIN "Clients" c ON t."ClientId" = c."Id"
        JOIN "Categories" cat ON c."CategoryId" = cat."Id"
        LEFT JOIN "Stations" s ON c."StationId" = s."Id"
        LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
        WHERE t."Deleted" = false 
          AND t."Status" = true
          AND c."Deleted" = false
          AND c."Status" = true
          ${whereClause}
        GROUP BY DATE(t."PostedOn")
        ORDER BY screening_date
      ),
      with_gaps AS (
        SELECT 
          screening_date,
          tally_count,
          unique_clients,
          LAG(screening_date) OVER (ORDER BY screening_date) as prev_date,
          CASE 
            WHEN LAG(screening_date) OVER (ORDER BY screening_date) IS NULL THEN 1
            WHEN screening_date - LAG(screening_date) OVER (ORDER BY screening_date) > 20 THEN 1
            ELSE 0
          END as new_period_flag
        FROM daily_tallies
      ),
      period_groups AS (
        SELECT 
          screening_date,
          tally_count,
          unique_clients,
          SUM(new_period_flag) OVER (ORDER BY screening_date) as period_id
        FROM with_gaps
      )
      SELECT 
        period_id,
        MIN(screening_date) as period_start,
        MAX(screening_date) as period_end,
        TO_CHAR(MIN(screening_date), 'Mon YYYY') || 
          CASE WHEN EXTRACT(MONTH FROM MIN(screening_date)) != EXTRACT(MONTH FROM MAX(screening_date))
               THEN ' - ' || TO_CHAR(MAX(screening_date), 'Mon YYYY')
               ELSE ''
          END as period_label,
        SUM(tally_count) as total_tallies,
        SUM(unique_clients) as total_unique_clients,
        COUNT(*) as screening_days,
        ROUND(AVG(tally_count), 1) as avg_daily_tallies,
        EXTRACT(YEAR FROM MIN(screening_date)) as year
      FROM period_groups
      GROUP BY period_id
      HAVING COUNT(*) >= 2
      ORDER BY period_start
    `;
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        console.error('Error in getParticipationByPeriods:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getParticipationByPeriods = getParticipationByPeriods;
// Get daily participation trends
const getParticipationDaily = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { startDate, endDate, category, station, gender } = req.query;
        const params = [];
        let whereClause = '';
        let paramIndex = 1;
        if (startDate && startDate !== '') {
            whereClause += ` AND t."PostedOn" >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate && endDate !== '') {
            whereClause += ` AND t."PostedOn" <= $${paramIndex++}`;
            params.push(endDate);
        }
        if (category && category !== 'all') {
            whereClause += ` AND cat."Title" = $${paramIndex++}`;
            params.push(category);
        }
        if (station && station !== 'all') {
            whereClause += ` AND s."Title" = $${paramIndex++}`;
            params.push(station);
        }
        if (gender && gender !== 'all') {
            whereClause += ` AND g."Title" ILIKE $${paramIndex++}`;
            params.push(gender);
        }
        const query = `
      SELECT 
        DATE(t."PostedOn") as screening_date,
        TO_CHAR(DATE(t."PostedOn"), 'MM/DD/YY') as date_label,
        COUNT(*) as tally_count,
        COUNT(DISTINCT c."Id") as unique_clients
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false 
        AND t."Status" = true
        AND c."Deleted" = false
        AND c."Status" = true
        ${whereClause}
      GROUP BY DATE(t."PostedOn")
      ORDER BY screening_date
    `;
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        console.error('Error in getParticipationDaily:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getParticipationDaily = getParticipationDaily;
