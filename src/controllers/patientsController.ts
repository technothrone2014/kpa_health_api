import { Request, Response } from 'express';
import { poolPromise } from '../db/pool';

export const getPatientVisits = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    const result = await pool.query(`
      SELECT 
        t."Id",
        t."PostedOn" as date,
        t."Systolic",
        t."Diastolic",
        bp."Title" as bpStatus,
        t."BMIValue" as bmiValue,
        bmi."Title" as bmiStatus,
        t."RBSValue" as rbsValue,
        rbs."Title" as rbsStatus,
        t."Weight",
        t."Height",
        t."Waist",
        t."Hip",
        t."WHRatio" as whRatio
      FROM "Tallies" t
      JOIN "BPINTValues" bp ON t."BPINTValueId" = bp."Id"
      JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
      JOIN "RBSINTValues" rbs ON t."RBSINTValueId" = rbs."Id"
      WHERE t."ClientId" = $1 AND t."Deleted" = false
      ORDER BY t."PostedOn" DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patient visits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPatientTrends = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    const result = await pool.query(`
      SELECT 
        DATE(t."PostedOn") as date,
        AVG(t."Systolic"::numeric) as avg_systolic,
        AVG(t."Diastolic"::numeric) as avg_diastolic,
        AVG(t."BMIValue") as avg_bmi,
        AVG(t."RBSValue") as avg_rbs,
        COUNT(*) as reading_count
      FROM "Tallies" t
      WHERE t."ClientId" = $1 AND t."Deleted" = false
      GROUP BY DATE(t."PostedOn")
      ORDER BY date DESC
      LIMIT 30
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patient trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
