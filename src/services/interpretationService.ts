import { Pool } from 'pg';

// Map of frontend "type" tokens → DB table names
export const INTERPRETATION_TABLES: Record<string, string> = {
  bmi: 'BMIINTValues',
  bp:  'BPINTValues',
  rbs: 'RBSINTValues',
};

export type InterpretationStatus = 'normal' | 'warning' | 'danger' | 'info';

export interface InterpretationHit {
  Id: number;
  Title: string;
  StartIndex: number;
  StopIndex: number;
  status: InterpretationStatus;
}

// Single place that decides what a Title MEANS (colour/severity)
function classify(title: string): InterpretationStatus {
  const t = (title || '').toUpperCase();
  if (t.includes('NORMAL') || t.includes('HEALTHY')) return 'normal';
  if (
    t.includes('PRE') ||
    t.includes('ELEVATED') ||
    t.includes('OVERWEIGHT') ||
    t.includes('STAGE I')
  ) return 'warning';
  if (
    t.includes('HYPERTENSION') ||
    t.includes('OBESE') ||
    t.includes('DIABETIC') ||
    t.includes('CRISIS')
  ) return 'danger';
  return 'info';
}

/**
 * Find the interpretation row whose range contains `value`.
 * Range semantics: StartIndex <= value < StopIndex  (matches existing frontend behaviour)
 */
export async function interpretValue(
  pool: Pool,
  type: string,
  value: number | null | undefined
): Promise<InterpretationHit | null> {
  if (value === null || value === undefined || Number.isNaN(value) || value <= 0) {
    return null;
  }

  const table = INTERPRETATION_TABLES[type];
  if (!table) return null;

  const result = await pool.query(
    `SELECT "Id", "Title", "StartIndex", "StopIndex"
     FROM "${table}"
     WHERE "Deleted" = false
       AND "StartIndex" <= $1
       AND "StopIndex"  >  $1
     ORDER BY "Id"
     LIMIT 1`,
    [value]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    Id: row.Id,
    Title: row.Title,
    StartIndex: Number(row.StartIndex),
    StopIndex: Number(row.StopIndex),
    status: classify(row.Title),
  };
}
