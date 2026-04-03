import { Request, Response } from "express";
import { poolPromise, dbSql } from "../db/pool";

/**
 * Correct StationId for Clients and Tallies
 */
export const correctStationAssignments = async (req: Request, res: Response) => {
  const { year, month, day, userId, stationId, beforeHour, beforeMinute } = req.body;

  if (!year || !month || !day || !userId || !stationId) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    const pool = await poolPromise;

    // Begin transaction
    const transaction = pool.transaction();
    await transaction.begin();

    const request = transaction.request();

    // 🧩 Step 1: Update Tallies
    const request1 = transaction.request();
    await request1
      .input("stationId", dbSql.Int, stationId)
      .input("userId", dbSql.Int, userId)
      .input("year", dbSql.Int, year)
      .input("month", dbSql.Int, month)
      .input("day", dbSql.Int, day)
      .query(`
        UPDATE Tallies
        SET StationId = @stationId
        WHERE DATEPART(year, UpdatedOn) = @year
          AND DATEPART(month, UpdatedOn) = @month
          AND DATEPART(day, UpdatedOn) = @day
          AND UserId = @userId
          ${beforeHour !== undefined && beforeMinute !== undefined ? `
            AND (
              DATEPART(hour, UpdatedOn) < ${beforeHour}
              OR (DATEPART(hour, UpdatedOn) = ${beforeHour} AND DATEPART(minute, UpdatedOn) < ${beforeMinute})
            )
          ` : ""}
      `);

    // 🧩 Step 2: Update Clients related to affected Tallies
    const request2 = transaction.request();
    await request2
      .input("stationId", dbSql.Int, stationId)
      .input("userId", dbSql.Int, userId)
      .input("year", dbSql.Int, year)
      .input("month", dbSql.Int, month)
      .input("day", dbSql.Int, day)
      .query(`
        UPDATE C
        SET C.StationId = @stationId
        FROM Clients C
        INNER JOIN Tallies T ON T.ClientId = C.Id
        WHERE DATEPART(year, T.UpdatedOn) = @year
          AND DATEPART(month, T.UpdatedOn) = @month
          AND DATEPART(day, T.UpdatedOn) = @day
          AND T.UserId = @userId
          ${beforeHour !== undefined && beforeMinute !== undefined ? `
            AND (
              DATEPART(hour, T.UpdatedOn) < ${beforeHour}
              OR (DATEPART(hour, T.UpdatedOn) = ${beforeHour} AND DATEPART(minute, T.UpdatedOn) < ${beforeMinute})
            )
          ` : ""}
      `);

    await transaction.commit();

    res.status(200).json({
      message: "Station correction completed successfully",
      params: { year, month, day, userId, stationId, beforeHour, beforeMinute },
    });

  } catch (err) {
    console.error("Error correcting stations:", err);
    res.status(500).json({ message: "Error correcting stations", error: err });
  }
};
