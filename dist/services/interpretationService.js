"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERPRETATION_TABLES = void 0;
exports.interpretValue = interpretValue;
// Map of frontend "type" tokens → DB table names
exports.INTERPRETATION_TABLES = {
    // Field findings
    bmi: 'BMIINTValues',
    bp: 'BPINTValues',
    rbs: 'RBSINTValues',
    // Lab findings
    fbs: 'FBSINTValues',
    hba1c: 'HBA1CINTValues',
    microalbumin: 'MicroalbuminINTValues',
    psa: 'PSAINTValues',
    bmd: 'BMDINTValues',
};
// Single place that decides what a Title MEANS (colour/severity)
function classify(title) {
    const t = (title || '').toUpperCase();
    if (t.includes('N/A'))
        return 'info';
    // Normal / healthy
    if (t.includes('NORMAL') || t.includes('HEALTHY'))
        return 'normal';
    // Warning tier — pre-diabetes, borderline, osteopenia, elevated-but-not-critical
    if (t.includes('PRE') || // PREDIABETES, PRE-HYPERTENSION
        t.includes('ELEVATED') ||
        t.includes('OVERWEIGHT') ||
        t.includes('STAGE I') ||
        t.includes('BORDERLINE') ||
        t.includes('IMPAIRED') || // Impaired Fasting Glucose
        t.includes('OSTEOPENIA'))
        return 'warning';
    // Danger tier — diabetes, hypertensions, severe conditions
    if (t.includes('HYPERTENSION') ||
        t.includes('HYPOTENSION') ||
        t.includes('HYPOGLYCEMIA') ||
        t.includes('DIABETES') || // matches both DIABETES and DIABETIC
        t.includes('DIABETIC') ||
        t.includes('OBESE') ||
        t.includes('CRISIS') ||
        t.includes('MICROALBUMINURIA') ||
        t.includes('MACROALBUMINURIA') ||
        t.includes('OSTEOPOROSIS'))
        return 'danger';
    return 'info';
}
/**
 * Find the interpretation row whose range contains `value`.
 * Range semantics: StartIndex <= value < StopIndex
 *
 * `allowNegative` — required for BMD (T-scores are negative numbers).
 * By default, values <= 0 are rejected to guard against blank inputs.
 */
async function interpretValue(pool, type, value, options = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return null;
    }
    if (!options.allowNegative && value < 0) {
        return null;
    }
    const table = exports.INTERPRETATION_TABLES[type];
    if (!table)
        return null;
    // 1) Range match — StartIndex <= v < StopIndex
    const rangeResult = await pool.query(`SELECT "Id", "Title", "StartIndex", "StopIndex"
     FROM "${table}"
     WHERE "Deleted" = false
       AND "StartIndex" < "StopIndex"
       AND "StartIndex" <= $1
       AND "StopIndex"  >  $1
     ORDER BY "Id"
     LIMIT 1`, [value]);
    if (rangeResult.rows.length > 0) {
        const row = rangeResult.rows[0];
        return {
            Id: row.Id,
            Title: row.Title,
            StartIndex: Number(row.StartIndex),
            StopIndex: Number(row.StopIndex),
            status: classify(row.Title),
        };
    }
    // 2) Fallback — first row whose StartIndex === StopIndex (sentinel / N/A)
    const sentinelResult = await pool.query(`SELECT "Id", "Title", "StartIndex", "StopIndex"
     FROM "${table}"
     WHERE "Deleted" = false
       AND "StartIndex" = "StopIndex"
     ORDER BY "Id"
     LIMIT 1`);
    if (sentinelResult.rows.length > 0) {
        const row = sentinelResult.rows[0];
        return {
            Id: row.Id,
            Title: row.Title,
            StartIndex: Number(row.StartIndex),
            StopIndex: Number(row.StopIndex),
            status: classify(row.Title),
        };
    }
    return null;
}
