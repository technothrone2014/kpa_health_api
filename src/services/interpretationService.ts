import { Pool } from 'pg';

// Map of frontend "type" tokens → DB table names
export const INTERPRETATION_TABLES: Record<string, string> = {
  // Field findings
  bmi: 'BMIINTValues',
  bp:  'BPINTValues',
  rbs: 'RBSINTValues',
  // Lab findings
  fbs:          'FBSINTValues',
  hba1c:        'HBA1CINTValues',
  microalbumin: 'MicroalbuminINTValues',
  psa:          'PSAINTValues',
  bmd:          'BMDINTValues',
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
  if (t.includes('N/A')) return 'info';

  // Normal / healthy
  if (t.includes('NORMAL') || t.includes('HEALTHY')) return 'normal';

  // Warning tier — pre-diabetes, borderline, osteopenia, elevated-but-not-critical
  if (
    t.includes('PRE') ||             // PREDIABETES, PRE-HYPERTENSION
    t.includes('ELEVATED') ||
    t.includes('OVERWEIGHT') ||
    t.includes('STAGE I') ||
    t.includes('BORDERLINE') ||
    t.includes('IMPAIRED') ||        // Impaired Fasting Glucose
    t.includes('OSTEOPENIA')
  ) return 'warning';

  // Danger tier — diabetes, hypertensions, severe conditions
  if (
    t.includes('HYPERTENSION') ||
    t.includes('HYPOTENSION') ||
    t.includes('HYPOGLYCEMIA') ||
    t.includes('DIABETES') ||        // matches both DIABETES and DIABETIC
    t.includes('DIABETIC') ||
    t.includes('OBESE') ||
    t.includes('CRISIS') ||
    t.includes('MICROALBUMINURIA') ||
    t.includes('MACROALBUMINURIA') ||
    t.includes('OSTEOPOROSIS')
  ) return 'danger';

  return 'info';
}

/**
 * Find the interpretation row whose range contains `value`.
 * Range semantics: StartIndex <= value < StopIndex
 *
 * `allowNegative` — required for BMD (T-scores are negative numbers).
 * By default, values <= 0 are rejected to guard against blank inputs.
 */
export async function interpretValue(
  pool: Pool,
  type: string,
  value: number | null | undefined,
  options: { allowNegative?: boolean } = {}
): Promise<InterpretationHit | null> {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  if (!options.allowNegative && value <= 0) {
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
