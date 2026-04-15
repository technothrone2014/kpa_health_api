// controllers/clientsController.ts
import { Request, Response } from 'express';
import { poolPromise } from '../db/pool';

export const searchClients = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = await poolPromise;
    const { term } = req.query;
    
    if (!term || typeof term !== 'string' || term.length < 2) {
      res.json({ success: true, data: [] });
      return;
    }
    
    const searchTerm = `%${term}%`;
    
    const result = await pool.query(`
      SELECT 
        c."Id",
        c."FullName",
        c."IDNumber",
        c."PhoneNumber",
        c."GenderId",
        g."Title" as "GenderTitle",
        c."CategoryId",
        cat."Title" as "CategoryTitle",
        c."StationId",
        c."DateOfBirth"
      FROM "Clients" c
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      LEFT JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      WHERE c."Deleted" = false 
        AND c."Status" = true
        AND (c."FullName" ILIKE $1 
          OR c."IDNumber" ILIKE $1 
          OR c."PhoneNumber" ILIKE $1)
      ORDER BY c."FullName"
      LIMIT 20
    `, [searchTerm]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
