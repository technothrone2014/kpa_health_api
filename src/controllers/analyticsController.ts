import { Request, Response } from 'express';
import { poolPromise, dbSql } from '../db/pool';

// ==================== CLIENT SUMMARY ENDPOINTS ====================

// SUMMARY OF CLIENTS SEEN PER CATEGORY
export const getClientsPerCategory = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        cat.Title AS Category,
        COUNT(t.Id) AS Count
      FROM Tallies t
      JOIN Clients c ON t.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      WHERE cat.Title IN ('EMPLOYEE', 'DEPENDENT', 'PORT USER')
        AND t.Deleted = 0
        AND c.Deleted = 0
        AND cat.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND t.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND t.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY cat.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
      WITH CategoryGenderCounts AS (
        SELECT 
          cat.Title AS Category,
          sex.Title AS Gender,
          COUNT(t.Id) AS Count
        FROM Tallies t
        JOIN Clients c ON t.ClientId = c.Id
        JOIN Categories cat ON c.CategoryId = cat.Id
        JOIN Genders sex ON c.GenderId = sex.Id
        WHERE cat.Title IN ('EMPLOYEE', 'DEPENDENT', 'PORT USER')
          AND sex.Title IN ('Male', 'Female')
          AND t.Deleted = 0
          AND c.Deleted = 0
          AND cat.Deleted = 0
          AND sex.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND t.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND t.PostedOn <= @endDate`;
    }
    
    query += `
        GROUP BY cat.Title, sex.Title
      )
      SELECT 
        Gender,
        ISNULL([EMPLOYEE], 0) AS EMPLOYEES,
        ISNULL([DEPENDENT], 0) AS DEPENDANTS,
        ISNULL([PORT USER], 0) AS PORT_USERS,
        ISNULL([EMPLOYEE], 0) + ISNULL([DEPENDENT], 0) + ISNULL([PORT USER], 0) AS TOTAL
      FROM CategoryGenderCounts
      PIVOT (
        SUM(Count) 
        FOR Category IN ([EMPLOYEE], [DEPENDENT], [PORT USER])
      ) AS PivotedData
      UNION ALL
      SELECT 
        'TOTAL' AS Gender,
        SUM(ISNULL([EMPLOYEE], 0)) AS EMPLOYEES,
        SUM(ISNULL([DEPENDENT], 0)) AS DEPENDANTS,
        SUM(ISNULL([PORT USER], 0)) AS PORT_USERS,
        SUM(ISNULL([EMPLOYEE], 0)) + SUM(ISNULL([DEPENDENT], 0)) + SUM(ISNULL([PORT USER], 0)) AS TOTAL
      FROM CategoryGenderCounts
      PIVOT (
        SUM(Count) 
        FOR Category IN ([EMPLOYEE], [DEPENDENT], [PORT USER])
      ) AS TotalPivotedData
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
      WITH StationCategoryCounts AS (
        SELECT 
          stat.Title AS Station,
          cat.Title AS Category,
          COUNT(t.Id) AS Count
        FROM Tallies t
        JOIN Clients c ON t.ClientId = c.Id
        JOIN Categories cat ON c.CategoryId = cat.Id
        JOIN Stations stat ON c.StationId = stat.Id
        WHERE cat.Title IN ('EMPLOYEE', 'DEPENDENT', 'PORT USER')
          AND t.Deleted = 0
          AND c.Deleted = 0
          AND stat.Deleted = 0
          AND cat.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND t.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND t.PostedOn <= @endDate`;
    }
    
    query += `
        GROUP BY stat.Title, cat.Title
      )
      SELECT 
        Station,
        ISNULL([EMPLOYEE], 0) AS EMP,
        ISNULL([DEPENDENT], 0) AS DEP,
        ISNULL([PORT USER], 0) AS PU,
        ISNULL([EMPLOYEE], 0) + ISNULL([DEPENDENT], 0) + ISNULL([PORT USER], 0) AS TOTAL,
        CASE WHEN Station = 'TOTAL' THEN 1 ELSE 0 END AS SortOrder
      FROM StationCategoryCounts
      PIVOT (
        SUM(Count)
        FOR Category IN ([EMPLOYEE], [DEPENDENT], [PORT USER])
      ) AS PivotedData
      UNION ALL
      SELECT 
        'TOTAL' AS Station,
        SUM(ISNULL([EMPLOYEE], 0)) AS EMP,
        SUM(ISNULL([DEPENDENT], 0)) AS DEP,
        SUM(ISNULL([PORT USER], 0)) AS PU,
        SUM(ISNULL([EMPLOYEE], 0)) + SUM(ISNULL([DEPENDENT], 0)) + SUM(ISNULL([PORT USER], 0)) AS TOTAL,
        1 AS SortOrder
      FROM StationCategoryCounts
      PIVOT (
        SUM(Count)
        FOR Category IN ([EMPLOYEE], [DEPENDENT], [PORT USER])
      ) AS TotalPivotedData
      ORDER BY SortOrder, Station
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error in getClientsPerCategoryPerStation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== EMPLOYEE HEALTH METRICS ENDPOINTS ====================

// SUMMARY OF EMPLOYEES BLOOD PRESSURE RESULTS
export const getEmployeeBloodPressureResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        bp.Title AS BloodPressureCategory,
        COUNT(t.Id) AS Count
      FROM Tallies t
      JOIN Clients c ON t.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN BPINTValues bp ON t.BPINTValueId = bp.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND t.Deleted = 0
        AND c.Deleted = 0
        AND bp.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND t.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND t.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY bp.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error in getEmployeeBloodPressureResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES BMI RESULTS
export const getEmployeeBMIResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        bmi.Title AS BMICategory,
        COUNT(t.Id) AS Count
      FROM Tallies t
      JOIN Clients c ON t.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN BMIINTValues bmi ON t.BMIINTValueId = bmi.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND t.Deleted = 0
        AND c.Deleted = 0
        AND bmi.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND t.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND t.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY bmi.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error in getEmployeeBMIResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES RANDOM BLOOD SUGAR RESULTS
export const getEmployeeRandomBloodSugarResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        rbs.Title AS RandomBloodSugarCategory,
        COUNT(t.Id) AS Count
      FROM Tallies t
      JOIN Clients c ON t.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN RBSINTValues rbs ON t.RBSINTValueId = rbs.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND t.Deleted = 0
        AND c.Deleted = 0
        AND rbs.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND t.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND t.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY rbs.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error in getEmployeeRandomBloodSugarResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES BMD RESULTS
export const getEmployeeBMDResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        b.Title AS BMDResult,
        COUNT(f.Id) AS Count
      FROM Findings f
      JOIN Clients c ON f.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN BMDINTValues b ON f.BMDINTValueId = b.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND f.Deleted = 0
        AND c.Deleted = 0
        AND b.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND f.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND f.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY b.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
        fbs.Title AS FBSResult,
        COUNT(f.Id) AS Count
      FROM Findings f
      JOIN Clients c ON f.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN FBSINTValues fbs ON f.FBSINTValueId = fbs.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND f.Deleted = 0
        AND c.Deleted = 0
        AND fbs.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND f.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND f.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY fbs.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
        h.Title AS HBA1CResult,
        COUNT(f.Id) AS Count
      FROM Findings f
      JOIN Clients c ON f.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN HBA1CINTValues h ON f.HBA1CINTValueId = h.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND f.Deleted = 0
        AND c.Deleted = 0
        AND h.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND f.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND f.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY h.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
        l.Title AS LipidResult,
        COUNT(f.Id) AS Count
      FROM Findings f
      JOIN Clients c ON f.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN Lipids l ON f.LipidId = l.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND f.Deleted = 0
        AND c.Deleted = 0
        AND l.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND f.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND f.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY l.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error in getEmployeeLipidProfileResults:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// SUMMARY OF EMPLOYEES MICROALBUMIN RESULTS
export const getEmployeeMicroalbuminResults = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        m.Title AS MicroalbuminResult,
        COUNT(f.Id) AS Count
      FROM Findings f
      JOIN Clients c ON f.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN MicroalbuminINTValues m ON f.MicroalbuminINTValueId = m.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND f.Deleted = 0
        AND c.Deleted = 0
        AND m.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND f.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND f.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY m.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
        psa.Title AS PSAResult,
        COUNT(f.Id) AS Count
      FROM Findings f
      JOIN Clients c ON f.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN PSAINTValues psa ON f.PSAINTValueId = psa.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND f.Deleted = 0
        AND c.Deleted = 0
        AND psa.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND f.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND f.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY psa.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
    
    let query = `
      SELECT 
        'Hepatitis B' AS TestType,
        hb.Title AS Result,
        COUNT(f.Id) AS Count
      FROM Findings f
      JOIN Clients c ON f.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN HepatitisBValues hb ON f.HepatitisBValueId = hb.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND f.Deleted = 0
        AND c.Deleted = 0
        AND hb.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND f.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND f.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY hb.Title
      UNION ALL
      SELECT 
        'Hepatitis C' AS TestType,
        hc.Title AS Result,
        COUNT(f.Id) AS Count
      FROM Findings f
      JOIN Clients c ON f.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN HepatitisCValues hc ON f.HepatitisCValueId = hc.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND f.Deleted = 0
        AND c.Deleted = 0
        AND hc.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND f.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND f.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY hc.Title
      ORDER BY TestType, Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
        be.Title AS BreastExamResult,
        COUNT(o.Id) AS Count
      FROM Oncologies o
      JOIN Clients c ON o.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN BreastExams be ON o.BreastExamId = be.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND o.Deleted = 0
        AND c.Deleted = 0
        AND be.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND o.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND o.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY be.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
        pap.Title AS PAPSmearResult,
        COUNT(o.Id) AS Count
      FROM Oncologies o
      JOIN Clients c ON o.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN PAPSmears pap ON o.PAPSmearId = pap.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND o.Deleted = 0
        AND c.Deleted = 0
        AND pap.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND o.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND o.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY pap.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
        vv.Title AS ViaVilliesResult,
        COUNT(o.Id) AS Count
      FROM Oncologies o
      JOIN Clients c ON o.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      JOIN ViaVillies vv ON o.ViaVilliId = vv.Id
      WHERE cat.Title = 'EMPLOYEE'
        AND o.Deleted = 0
        AND c.Deleted = 0
        AND vv.Deleted = 0
    `;
    
    if (startDate) {
      query += ` AND o.PostedOn >= @startDate`;
    }
    if (endDate) {
      query += ` AND o.PostedOn <= @endDate`;
    }
    
    query += `
      GROUP BY vv.Title
      ORDER BY Count DESC
    `;
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const result = await request.query(query);
    res.json(result.recordset);
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
      SELECT COUNT(DISTINCT c.Id) AS TotalClients
      FROM Tallies t
      JOIN Clients c ON t.ClientId = c.Id
      WHERE t.Deleted = 0 AND c.Deleted = 0
    `;
    
    // Get total tallies (visits)
    let talliesQuery = `
      SELECT COUNT(Id) AS TotalVisits
      FROM Tallies
      WHERE Deleted = 0
    `;
    
    // Get category distribution
    let categoryQuery = `
      SELECT cat.Title AS Category, COUNT(t.Id) AS Count
      FROM Tallies t
      JOIN Clients c ON t.ClientId = c.Id
      JOIN Categories cat ON c.CategoryId = cat.Id
      WHERE cat.Title IN ('EMPLOYEE', 'DEPENDENT', 'PORT USER')
        AND t.Deleted = 0 AND c.Deleted = 0 AND cat.Deleted = 0
      GROUP BY cat.Title
    `;
    
    if (startDate) {
      clientsQuery += ` AND t.PostedOn >= @startDate`;
      talliesQuery += ` AND PostedOn >= @startDate`;
      categoryQuery += ` AND t.PostedOn >= @startDate`;
    }
    if (endDate) {
      clientsQuery += ` AND t.PostedOn <= @endDate`;
      talliesQuery += ` AND PostedOn <= @endDate`;
      categoryQuery += ` AND t.PostedOn <= @endDate`;
    }
    
    const request = pool.request();
    if (startDate) request.input('startDate', dbSql.Date, startDate);
    if (endDate) request.input('endDate', dbSql.Date, endDate);
    
    const [clientsResult, talliesResult, categoryResult] = await Promise.all([
      request.query(clientsQuery),
      request.query(talliesQuery),
      request.query(categoryQuery)
    ]);
    
    res.json({
      totalClients: clientsResult.recordset[0]?.TotalClients || 0,
      totalVisits: talliesResult.recordset[0]?.TotalVisits || 0,
      categoryDistribution: categoryResult.recordset
    });
  } catch (error) {
    console.error('Error in getDashboardOverview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
