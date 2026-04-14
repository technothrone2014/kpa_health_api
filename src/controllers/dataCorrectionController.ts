// dataCorrectionController.ts
import { Request, Response } from "express";
import { poolPromise } from "../db/pool";

/**
 * Correct StationId for Clients and Tallies
 * Supports day operator (eq, gt, gte, lt, lte) for flexible date filtering
 */
export const correctStationAssignments = async (req: Request, res: Response) => {
  const { 
    year, month, day, dayOperator = 'gte',
    userId, stationId, beforeHour, beforeMinute 
  } = req.body;

  if (!year || !month || !day || !userId || !stationId) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    const pool = await poolPromise;

    // Build the day condition based on operator
    const operatorMap: Record<string, string> = {
      'eq': '=',
      'gt': '>',
      'gte': '>=',
      'lt': '<',
      'lte': '<='
    };
    const sqlOperator = operatorMap[dayOperator] || '>=';

    // Build the time condition for PostgreSQL
    let timeCondition = '';
    const talliesParams: any[] = [];
    let paramIndex = 1;
    
    if (beforeHour !== undefined && beforeMinute !== undefined) {
      timeCondition = ` AND (
        EXTRACT(HOUR FROM "UpdatedOn") < $${paramIndex}
        OR (EXTRACT(HOUR FROM "UpdatedOn") = $${paramIndex} AND EXTRACT(MINUTE FROM "UpdatedOn") < $${paramIndex + 1})
      )`;
      talliesParams.push(beforeHour, beforeMinute);
      paramIndex += 2;
    }
    
    talliesParams.push(stationId, year, month, day, userId);

    // 🧩 Step 1: Update Tallies
    const talliesQuery = `
      UPDATE "Tallies"
      SET "StationId" = $${paramIndex}
      WHERE EXTRACT(YEAR FROM "UpdatedOn") = $${paramIndex + 1}
        AND EXTRACT(MONTH FROM "UpdatedOn") = $${paramIndex + 2}
        AND EXTRACT(DAY FROM "UpdatedOn") ${sqlOperator} $${paramIndex + 3}
        AND "UserId" = $${paramIndex + 4}
        ${timeCondition}
      RETURNING "Id"
    `;
    
    const talliesResult = await pool.query(talliesQuery, talliesParams);
    const talliesUpdated = talliesResult.rowCount || 0;
    console.log(`✅ Updated ${talliesUpdated} Tallies with stationId=${stationId}`);

    // 🧩 Step 2: Update Clients related to affected Tallies
    const clientsParams: any[] = [];
    let clientParamIndex = 1;
    
    let clientTimeCondition = '';
    if (beforeHour !== undefined && beforeMinute !== undefined) {
      clientTimeCondition = ` AND (
        EXTRACT(HOUR FROM t."UpdatedOn") < $${clientParamIndex}
        OR (EXTRACT(HOUR FROM t."UpdatedOn") = $${clientParamIndex} AND EXTRACT(MINUTE FROM t."UpdatedOn") < $${clientParamIndex + 1})
      )`;
      clientsParams.push(beforeHour, beforeMinute);
      clientParamIndex += 2;
    }
    
    clientsParams.push(stationId, year, month, day, userId);
    
    const clientsQuery = `
      UPDATE "Clients" c
      SET "StationId" = $${clientParamIndex}
      FROM "Tallies" t
      WHERE t."ClientId" = c."Id"
        AND EXTRACT(YEAR FROM t."UpdatedOn") = $${clientParamIndex + 1}
        AND EXTRACT(MONTH FROM t."UpdatedOn") = $${clientParamIndex + 2}
        AND EXTRACT(DAY FROM t."UpdatedOn") ${sqlOperator} $${clientParamIndex + 3}
        AND t."UserId" = $${clientParamIndex + 4}
        ${clientTimeCondition}
      RETURNING c."Id"
    `;
    
    const clientsResult = await pool.query(clientsQuery, clientsParams);
    const clientsUpdated = clientsResult.rowCount || 0;
    console.log(`✅ Updated ${clientsUpdated} Clients with stationId=${stationId}`);

    res.status(200).json({
      message: `Station correction completed successfully. Updated ${talliesUpdated} tallies and ${clientsUpdated} clients.`,
      summary: {
        talliesUpdated,
        clientsUpdated
      },
      params: { year, month, day, dayOperator, userId, stationId, beforeHour, beforeMinute },
    });

  } catch (err) {
    console.error("Error correcting stations:", err);
    res.status(500).json({ message: "Error correcting stations", error: err });
  }
};
