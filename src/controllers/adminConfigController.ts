// adminConfigController.ts
// Admin-only management of dynamic configuration tables

import { Request, Response } from 'express';
import { poolPromise } from '../db/pool';
import { auditLog } from '../services/auditService';

const getClientIp = (req: Request): string | null => {
  const ip = req.ip || req.socket?.remoteAddress || null;
  if (ip === '::1') return '127.0.0.1';
  if (ip === '::ffff:127.0.0.1') return '127.0.0.1';
  return ip;
};

const getUserAgent = (req: Request): string | null =>
  req.headers['user-agent'] || null;

// ============================================================
// Whitelist of manageable config types.
// To add a new type later, just append here — the controller
// picks it up automatically via the same list/create/update
// /toggle pipeline.
// ============================================================
const CONFIG_TYPES: Record<string, {
  table: string;
  orderBy: string;
  supportsSortOrder: boolean;
  supportsLegacyColumn: boolean;
  supportsRange: boolean;
  group: 'referrals' | 'remarks' | 'field-interpretation' | 'lab-interpretation' | 'screening' | 'lab-option';
  label: string;
}> = {
  // --- Referrals --------------------------------------------------
  referrals: {
    table: 'Referrals', orderBy: '"SortOrder" ASC, "Id" ASC',
    supportsSortOrder: true, supportsLegacyColumn: true, supportsRange: false,
    group: 'referrals', label: 'referral',
  },

  // --- Remarks ----------------------------------------------------
  'bp-remarks': {
    table: 'BPRemarks', orderBy: '"Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: false,
    group: 'remarks', label: 'BP remark',
  },
  'rbs-remarks': {
    table: 'RBSRemarks', orderBy: '"Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: false,
    group: 'remarks', label: 'RBS remark',
  },

  // --- Field interpretations (range-based) ------------------------
  bmi: {
    table: 'BMIINTValues', orderBy: '"StartIndex" ASC, "Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: true,
    group: 'field-interpretation', label: 'BMI interpretation',
  },
  bp: {
    table: 'BPINTValues', orderBy: '"StartIndex" ASC, "Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: true,
    group: 'field-interpretation', label: 'BP interpretation',
  },
  rbs: {
    table: 'RBSINTValues', orderBy: '"StartIndex" ASC, "Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: true,
    group: 'field-interpretation', label: 'RBS interpretation',
  },

  // --- Lab interpretations (range-based) --------------------------
  fbs: {
    table: 'FBSINTValues', orderBy: '"StartIndex" ASC, "Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: true,
    group: 'lab-interpretation', label: 'FBS interpretation',
  },
  hba1c: {
    table: 'HBA1CINTValues', orderBy: '"StartIndex" ASC, "Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: true,
    group: 'lab-interpretation', label: 'HbA1c interpretation',
  },
  microalbumin: {
    table: 'MicroalbuminINTValues', orderBy: '"StartIndex" ASC, "Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: true,
    group: 'lab-interpretation', label: 'Microalbumin interpretation',
  },
  psa: {
    table: 'PSAINTValues', orderBy: '"StartIndex" ASC, "Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: true,
    group: 'lab-interpretation', label: 'PSA interpretation',
  },
  bmd: {
    table: 'BMDINTValues', orderBy: '"StartIndex" ASC, "Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: true,
    group: 'lab-interpretation', label: 'BMD interpretation',
  },

  // --- Screening results (simple lookups) -------------------------
  'breast-exam': {
    table: 'BreastExams', orderBy: '"Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: false,
    group: 'screening', label: 'breast exam result',
  },
  'pap-smear': {
    table: 'PAPSmears', orderBy: '"Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: false,
    group: 'screening', label: 'PAP smear result',
  },
  'via-villi': {
    table: 'ViaVillies', orderBy: '"Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: false,
    group: 'screening', label: 'VIA Villi result',
  },

  // --- Lab options (simple lookups) -------------------------------
  'hepatitis-b': {
    table: 'HepatitisBValues', orderBy: '"Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: false,
    group: 'lab-option', label: 'Hepatitis B result',
  },
  'hepatitis-c': {
    table: 'HepatitisCValues', orderBy: '"Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: false,
    group: 'lab-option', label: 'Hepatitis C result',
  },
  lipid: {
    table: 'Lipids', orderBy: '"Id" ASC',
    supportsSortOrder: false, supportsLegacyColumn: false, supportsRange: false,
    group: 'lab-option', label: 'lipid profile option',
  },
};

// ==================== LIST ====================
export const listConfigItems = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { type } = req.params;
    const config = CONFIG_TYPES[type];

    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid config type' });
    }

    const cols = ['"Id"', '"Title"', '"Deleted"', '"Status"', '"PostedOn"', '"UpdatedOn"'];
    if (config.supportsRange) cols.push('"StartIndex"', '"StopIndex"');

    const result = await pool.query(
      `SELECT ${cols.join(', ')}
       FROM "${config.table}"
       ORDER BY ${config.orderBy}`
    );

    // For referrals, also grab how many historical Tallies reference each one
    let usageMap: Record<number, number> = {};
    if (type === 'referrals') {
      const usage = await pool.query(
        `SELECT "ReferralId", COUNT(*)::int AS count
         FROM "TallyReferrals"
         GROUP BY "ReferralId"`
      );
      usage.rows.forEach((r: any) => { usageMap[r.ReferralId] = r.count; });
    }

    const items = result.rows.map((r: any) => ({
      ...r,
      usageCount: usageMap[r.Id] ?? null,
    }));

    res.json({ success: true, items });
  } catch (error) {
    console.error('Error listing config items:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== helpers for range validation ====================
type RangeValidation =
  | { ok: true; start: number; stop: number }
  | { ok: false; status: number; message: string };

async function validateRange(
  pool: any,
  table: string,
  startRaw: any,
  stopRaw: any,
  excludeId?: string
): Promise<RangeValidation> {
  const start = Number(startRaw);
  const stop = Number(stopRaw);

  if (!Number.isFinite(start) || !Number.isFinite(stop)) {
    return { ok: false, status: 400, message: 'StartIndex and StopIndex must be numeric' };
  }

  // Sentinel rows (start === stop) are allowed — they represent the "N/A" fallback
  // used by interpretValue(). They don't participate in range matching.
  if (start === stop) return { ok: true, start, stop };

  if (start > stop) {
    return { ok: false, status: 400, message: 'StartIndex must be less than or equal to StopIndex' };
  }

  // Overlap check (exclude self if editing)
  const params: any[] = [start, stop];
  let sql = `SELECT "Id", "Title", "StartIndex", "StopIndex"
             FROM "${table}"
             WHERE "Deleted" = false
               AND "StartIndex" < "StopIndex"
               AND "StartIndex" < $2
               AND "StopIndex"  > $1`;
  if (excludeId !== undefined) {
    params.push(excludeId);
    sql += ` AND "Id" <> $3`;
  }
  sql += ` LIMIT 1`;

  const overlap = await pool.query(sql, params);
  if (overlap.rows.length > 0) {
    const o = overlap.rows[0];
    return {
      ok: false,
      status: 409,
      message: `Range [${start}, ${stop}) overlaps with existing "${o.Title}" (${o.StartIndex} – ${o.StopIndex}).`,
    };
  }

  return { ok: true, start, stop };
}

// ==================== CREATE ====================
export const createConfigItem = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { type } = req.params;
    const { Title, LegacyColumn, SortOrder, StartIndex, StopIndex } = req.body;
    const userId = (req as any).user?.userId || 1;
    const config = CONFIG_TYPES[type];

    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid config type' });
    }

    const trimmed = typeof Title === 'string' ? Title.trim() : '';
    if (trimmed.length < 2 || trimmed.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Title must be between 2 and 50 characters',
      });
    }

    // Range validation (interpretation types only)
    let numStart: number | null = null;
    let numStop: number | null = null;
    if (config.supportsRange) {
      const rv = await validateRange(pool, config.table, StartIndex, StopIndex);
      if (!rv.ok) {
        return res.status(rv.status).json({ success: false, message: rv.message });
      }
      numStart = rv.start;
      numStop = rv.stop;
    }

    // Prevent duplicate titles (case-insensitive) — including soft-deleted ones
    const dup = await pool.query(
      `SELECT "Id", "Deleted" FROM "${config.table}"
       WHERE LOWER("Title") = LOWER($1) LIMIT 1`,
      [trimmed]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: dup.rows[0].Deleted
          ? `An item named "${trimmed}" already exists (currently deactivated). Reactivate it instead.`
          : `An item named "${trimmed}" already exists.`,
      });
    }

    const now = new Date();
    const cols: string[] = ['"UserId"', '"Title"', '"PostedOn"', '"UpdatedOn"', '"Pinned"', '"Status"', '"Deleted"'];
    const vals: any[] = [userId, trimmed, now, now, false, true, false];
    const placeholders: string[] = ['$1', '$2', '$3', '$4', '$5', '$6', '$7'];
    let idx = 8;

    if (config.supportsLegacyColumn) {
      cols.push('"LegacyColumn"');
      vals.push(LegacyColumn || null);
      placeholders.push(`$${idx++}`);
    }
    if (config.supportsSortOrder) {
      cols.push('"SortOrder"');
      vals.push(Number.isFinite(SortOrder) ? SortOrder : 100);
      placeholders.push(`$${idx++}`);
    }
    if (config.supportsRange) {
      cols.push('"StartIndex"', '"StopIndex"');
      vals.push(numStart, numStop);
      placeholders.push(`$${idx++}`, `$${idx++}`);
    }

    const returning = `"Id", "Title", "Deleted", "Status", "PostedOn", "UpdatedOn"${config.supportsRange ? ', "StartIndex", "StopIndex"' : ''}`;
    const result = await pool.query(
      `INSERT INTO "${config.table}" (${cols.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING ${returning}`,
      vals
    );

    await auditLog(
      userId,
      'CONFIG_ITEM_CREATED',
      config.table,
      result.rows[0].Id.toString(),
      null,
      { type, Title: trimmed, LegacyColumn, SortOrder, StartIndex: numStart, StopIndex: numStop },
      getClientIp(req),
      getUserAgent(req)
    );

    res.status(201).json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('Error creating config item:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== UPDATE ====================
export const updateConfigItem = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { type, id } = req.params;
    const { Title, StartIndex, StopIndex } = req.body;
    const userId = (req as any).user?.userId || 1;
    const config = CONFIG_TYPES[type];

    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid config type' });
    }

    const trimmed = typeof Title === 'string' ? Title.trim() : '';
    if (trimmed.length < 2 || trimmed.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Title must be between 2 and 50 characters',
      });
    }

    let numStart: number | null = null;
    let numStop: number | null = null;
    if (config.supportsRange) {
      const rv = await validateRange(pool, config.table, StartIndex, StopIndex, id);
      if (!rv.ok) {
        return res.status(rv.status).json({ success: false, message: rv.message });
      }
      numStart = rv.start;
      numStop = rv.stop;
    }

    // Duplicate title check (excluding self)
    const dup = await pool.query(
      `SELECT "Id" FROM "${config.table}"
       WHERE LOWER("Title") = LOWER($1) AND "Id" <> $2 LIMIT 1`,
      [trimmed, id]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `An item named "${trimmed}" already exists.`,
      });
    }

    const now = new Date();
    const setClauses: string[] = ['"Title" = $1', '"UpdatedOn" = $2'];
    const vals: any[] = [trimmed, now];
    let idx = 3;

    if (config.supportsRange) {
      setClauses.push(`"StartIndex" = $${idx++}`);
      vals.push(numStart);
      setClauses.push(`"StopIndex" = $${idx++}`);
      vals.push(numStop);
    }

    vals.push(id);

    const returning = `"Id", "Title", "Deleted", "Status", "UpdatedOn"${config.supportsRange ? ', "StartIndex", "StopIndex"' : ''}`;
    const result = await pool.query(
      `UPDATE "${config.table}"
       SET ${setClauses.join(', ')}
       WHERE "Id" = $${idx}
       RETURNING ${returning}`,
      vals
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    await auditLog(
      userId,
      'CONFIG_ITEM_UPDATED',
      config.table,
      id,
      null,
      { type, Title: trimmed, StartIndex: numStart, StopIndex: numStop },
      getClientIp(req),
      getUserAgent(req)
    );

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('Error updating config item:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== TOGGLE (soft delete / reactivate) ====================
export const toggleConfigItem = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const { type, id } = req.params;
    const { Deleted } = req.body;
    const userId = (req as any).user?.userId || 1;
    const config = CONFIG_TYPES[type];

    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid config type' });
    }

    if (typeof Deleted !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Body must include { Deleted: true|false }',
      });
    }

    const now = new Date();
    const result = await pool.query(
      `UPDATE "${config.table}"
       SET "Deleted" = $1, "UpdatedOn" = $2
       WHERE "Id" = $3
       RETURNING "Id", "Title", "Deleted", "Status"`,
      [Deleted, now, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    await auditLog(
      userId,
      Deleted ? 'CONFIG_ITEM_DEACTIVATED' : 'CONFIG_ITEM_REACTIVATED',
      config.table,
      id,
      null,
      { type, Title: result.rows[0].Title },
      getClientIp(req),
      getUserAgent(req)
    );

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('Error toggling config item:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
