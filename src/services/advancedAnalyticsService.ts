import { poolPromise } from '../db/pool';

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  station?: string;
  gender?: string;
  minVisits?: number;
}

export interface HealthMetrics {
  totalOutstandingVisits: number;
  totalClientsSeen: number;
  visitsPerStation: Array<{ station: string; count: number }>;
  categoryDistribution: Array<{ category: string; count: number }>;
  genderDistribution: Array<{ gender: string; count: number }>;
}

export interface AbnormalReadings {
  bloodPressure: {
    normal: number;
    preHypertension: number;
    stage1Hypertension: number;
    stage2Hypertension: number;
    hypotension: number;
    total: number;
  };
  bmi: {
    underweight: number;
    normal: number;
    overweight: number;
    obese: number;
    veryObese: number;
    total: number;
  };
  rbs: {
    normal: number;
    hypoglycemia: number;
    preDiabetic: number;
    diabetic: number;
    total: number;
  };
}

export interface HighRiskPatient {
  clientId: number;
  fullName: string;
  idNumber: string;
  phoneNumber: string;
  category: string;
  station: string;
  totalVisits: number;
  abnormalBPCount: number;
  abnormalBMICount: number;
  abnormalRBSCount: number;
  conditionsCount: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  lastVisitDate: Date;
}

class AdvancedAnalyticsService {
  // Build WHERE clause from filters
  private buildWhereClause(filters: AnalyticsFilters, params: any[]): string {
    const conditions: string[] = [];
    
    if (filters.startDate) {
      conditions.push(`t."PostedOn" >= $${params.length + 1}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`t."PostedOn" <= $${params.length + 1}`);
      params.push(filters.endDate);
    }
    if (filters.category && filters.category !== 'all') {
      conditions.push(`cat."Title" = $${params.length + 1}`);
      params.push(filters.category);
    }
    if (filters.station && filters.station !== 'all') {
      conditions.push(`s."Title" = $${params.length + 1}`);
      params.push(filters.station);
    }
    if (filters.gender && filters.gender !== 'all') {
      conditions.push(`g."Title" = $${params.length + 1}`);
      params.push(filters.gender);
    }
    
    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  // Get summary metrics
  async getSummaryMetrics(filters: AnalyticsFilters): Promise<HealthMetrics> {
    const pool = await poolPromise;
    const params: any[] = [];
    const whereClause = this.buildWhereClause(filters, params);
    
    // Total outstanding visits (non-deleted, active)
    const visitsResult = await pool.query(`
      SELECT COUNT(DISTINCT t."Id") as total_visits
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false AND t."Status" = true
      ${whereClause}
    `, params);
    
    // Total clients seen (unique clients with at least one visit)
    const clientsResult = await pool.query(`
      SELECT COUNT(DISTINCT c."Id") as total_clients
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false AND t."Status" = true
      ${whereClause}
    `, params);
    
    // Visits per station
    const stationParams: any[] = [];
    const stationWhereClause = this.buildWhereClause(filters, stationParams);
    const stationsResult = await pool.query(`
      SELECT 
        COALESCE(s."Title", 'Unknown') as station,
        COUNT(t."Id") as count
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false AND t."Status" = true
      ${stationWhereClause}
      GROUP BY s."Title"
      ORDER BY count DESC
    `, stationParams);
    
    // Category distribution
    const categoryParams: any[] = [];
    const categoryWhereClause = this.buildWhereClause(filters, categoryParams);
    const categoryResult = await pool.query(`
      SELECT 
        cat."Title" as category,
        COUNT(DISTINCT c."Id") as count
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false AND t."Status" = true
      ${categoryWhereClause}
      GROUP BY cat."Title"
    `, categoryParams);
    
    // Gender distribution
    const genderParams: any[] = [];
    const genderWhereClause = this.buildWhereClause(filters, genderParams);
    const genderResult = await pool.query(`
      SELECT 
        COALESCE(g."Title", 'Unknown') as gender,
        COUNT(DISTINCT c."Id") as count
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false AND t."Status" = true
      ${genderWhereClause}
      GROUP BY g."Title"
    `, genderParams);
    
    return {
      totalOutstandingVisits: parseInt(visitsResult.rows[0]?.total_visits || '0'),
      totalClientsSeen: parseInt(clientsResult.rows[0]?.total_clients || '0'),
      visitsPerStation: stationsResult.rows,
      categoryDistribution: categoryResult.rows,
      genderDistribution: genderResult.rows
    };
  }

  // Get abnormal readings distribution
  async getAbnormalReadings(filters: AnalyticsFilters): Promise<AbnormalReadings> {
    const pool = await poolPromise;
    const params: any[] = [];
    const whereClause = this.buildWhereClause(filters, params);
    
    // Blood Pressure distribution
    const bpResult = await pool.query(`
      SELECT 
        bp."Title" as bp_status,
        COUNT(*) as count
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "BPINTValues" bp ON t."BPINTValueId" = bp."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false AND t."Status" = true
      ${whereClause}
      GROUP BY bp."Title"
    `, params);
    
    // BMI distribution
    const bmiResult = await pool.query(`
      SELECT 
        bmi."Title" as bmi_status,
        COUNT(*) as count
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false AND t."Status" = true
      ${whereClause}
      GROUP BY bmi."Title"
    `, params);
    
    // RBS distribution
    const rbsResult = await pool.query(`
      SELECT 
        rbs."Title" as rbs_status,
        COUNT(*) as count
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      JOIN "RBSINTValues" rbs ON t."RBSINTValueId" = rbs."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false AND t."Status" = true
      ${whereClause}
      GROUP BY rbs."Title"
    `, params);
    
    // Helper to get count by status
    const getCount = (rows: any[], status: string): number => {
      const found = rows.find(r => r.bp_status === status || r.bmi_status === status || r.rbs_status === status);
      return found ? parseInt(found.count) : 0;
    };
    
    // Calculate totals
    const bpTotal = bpResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const bmiTotal = bmiResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const rbsTotal = rbsResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    
    return {
      bloodPressure: {
        normal: getCount(bpResult.rows, 'NORMAL'),
        preHypertension: getCount(bpResult.rows, 'PRE-HYPERTENSION'),
        stage1Hypertension: getCount(bpResult.rows, 'STAGE I HYPERTENSION'),
        stage2Hypertension: getCount(bpResult.rows, 'STAGE II HYPERTENSION'),
        hypotension: getCount(bpResult.rows, 'HYPOTENSION'),
        total: bpTotal
      },
      bmi: {
        underweight: getCount(bmiResult.rows, 'UNDERWEIGHT'),
        normal: getCount(bmiResult.rows, 'NORMAL'),
        overweight: getCount(bmiResult.rows, 'OVERWEIGHT'),
        obese: getCount(bmiResult.rows, 'OBESE'),
        veryObese: getCount(bmiResult.rows, 'VERY OBESE'),
        total: bmiTotal
      },
      rbs: {
        normal: getCount(rbsResult.rows, 'NORMAL'),
        hypoglycemia: getCount(rbsResult.rows, 'HYPOGLYCEMIA'),
        preDiabetic: getCount(rbsResult.rows, 'PRE-DIABETIC'),
        diabetic: getCount(rbsResult.rows, 'DIABETIC'),
        total: rbsTotal
      }
    };
  }

  // Get high-risk patients (multi-condition, multi-visit)
  async getHighRiskPatients(filters: AnalyticsFilters): Promise<HighRiskPatient[]> {
    const pool = await poolPromise;
    const params: any[] = [];
    let whereClause = '';
    
    if (filters.startDate) {
      whereClause += ` AND t."PostedOn" >= $${params.length + 1}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClause += ` AND t."PostedOn" <= $${params.length + 1}`;
      params.push(filters.endDate);
    }
    if (filters.category && filters.category !== 'all') {
      whereClause += ` AND cat."Title" = $${params.length + 1}`;
      params.push(filters.category);
    }
    if (filters.station && filters.station !== 'all') {
      whereClause += ` AND s."Title" = $${params.length + 1}`;
      params.push(filters.station);
    }
    
    const result = await pool.query(`
      WITH patient_metrics AS (
        SELECT 
          c."Id" as client_id,
          c."FullName",
          c."IDNumber",
          c."PhoneNumber",
          cat."Title" as category,
          s."Title" as station,
          COUNT(DISTINCT t."Id") as total_visits,
          COUNT(DISTINCT CASE WHEN bp."Title" != 'NORMAL' THEN t."Id" END) as abnormal_bp_count,
          COUNT(DISTINCT CASE WHEN bmi."Title" NOT IN ('NORMAL') THEN t."Id" END) as abnormal_bmi_count,
          COUNT(DISTINCT CASE WHEN rbs."Title" != 'NORMAL' THEN t."Id" END) as abnormal_rbs_count,
          MAX(t."PostedOn") as last_visit_date
        FROM "Clients" c
        JOIN "Tallies" t ON c."Id" = t."ClientId"
        JOIN "Categories" cat ON c."CategoryId" = cat."Id"
        LEFT JOIN "Stations" s ON c."StationId" = s."Id"
        JOIN "BPINTValues" bp ON t."BPINTValueId" = bp."Id"
        JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
        JOIN "RBSINTValues" rbs ON t."RBSINTValueId" = rbs."Id"
        WHERE t."Deleted" = false AND t."Status" = true
          AND c."Deleted" = false
        ${whereClause}
        GROUP BY c."Id", c."FullName", c."IDNumber", c."PhoneNumber", cat."Title", s."Title"
      ),
      risk_calc AS (
        SELECT *,
          CASE 
            WHEN abnormal_bp_count > 0 AND abnormal_bmi_count > 0 AND abnormal_rbs_count > 0 THEN 3
            WHEN (abnormal_bp_count > 0 AND abnormal_bmi_count > 0) OR
                 (abnormal_bp_count > 0 AND abnormal_rbs_count > 0) OR
                 (abnormal_bmi_count > 0 AND abnormal_rbs_count > 0) THEN 2
            WHEN abnormal_bp_count > 0 OR abnormal_bmi_count > 0 OR abnormal_rbs_count > 0 THEN 1
            ELSE 0
          END as conditions_count,
          CASE 
            WHEN (abnormal_bp_count > 0 AND abnormal_bmi_count > 0 AND abnormal_rbs_count > 0) 
              OR (abnormal_bp_count >= 2 AND abnormal_bmi_count >= 2) THEN 'HIGH'
            WHEN (abnormal_bp_count > 0 AND abnormal_bmi_count > 0) OR
                 (abnormal_bp_count > 0 AND abnormal_rbs_count > 0) OR
                 (abnormal_bmi_count > 0 AND abnormal_rbs_count > 0) THEN 'MEDIUM'
            WHEN abnormal_bp_count > 0 OR abnormal_bmi_count > 0 OR abnormal_rbs_count > 0 THEN 'LOW'
            ELSE 'NONE'
          END as risk_level
        FROM patient_metrics
      )
      SELECT *
      FROM risk_calc
      WHERE conditions_count > 0
      ORDER BY conditions_count DESC, total_visits DESC
      LIMIT 100
    `, params);
    
    return result.rows;
  }

  // Get multi-visit patients with abnormal readings
  async getMultiVisitAbnormalPatients(filters: AnalyticsFilters): Promise<any[]> {
    const pool = await poolPromise;
    const params: any[] = [];
    let whereClause = '';
    let paramIndex = 1;
    
    if (filters.startDate) {
      whereClause += ` AND t."PostedOn" >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClause += ` AND t."PostedOn" <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    if (filters.category && filters.category !== 'all') {
      whereClause += ` AND cat."Title" = $${paramIndex++}`;
      params.push(filters.category);
    }
    if (filters.station && filters.station !== 'all') {
      whereClause += ` AND s."Title" = $${paramIndex++}`;
      params.push(filters.station);
    }
    if (filters.gender && filters.gender !== 'all') {
      whereClause += ` AND g."Title" = $${paramIndex++}`;
      params.push(filters.gender);
    }
    
    const minVisits = filters.minVisits || 2;
    
    const query = `
      SELECT 
        c."Id" as client_id,
        c."FullName" as fullname,
        c."IDNumber" as idnumber,
        c."PhoneNumber" as phonenumber,
        cat."Title" as category,
        s."Title" as station,
        COUNT(DISTINCT t."Id") as total_visits,
        COUNT(DISTINCT CASE WHEN bp."Title" != 'NORMAL' THEN t."Id" END) as abnormal_bp_visits,
        COUNT(DISTINCT CASE WHEN bmi."Title" NOT IN ('NORMAL') THEN t."Id" END) as abnormal_bmi_visits,
        COUNT(DISTINCT CASE WHEN rbs."Title" != 'NORMAL' THEN t."Id" END) as abnormal_rbs_visits
      FROM "Clients" c
      JOIN "Tallies" t ON c."Id" = t."ClientId"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      JOIN "BPINTValues" bp ON t."BPINTValueId" = bp."Id"
      JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
      JOIN "RBSINTValues" rbs ON t."RBSINTValueId" = rbs."Id"
      WHERE t."Deleted" = false AND t."Status" = true
        AND c."Deleted" = false
        ${whereClause}
      GROUP BY c."Id", c."FullName", c."IDNumber", c."PhoneNumber", cat."Title", s."Title"
      HAVING COUNT(DISTINCT t."Id") >= $${paramIndex++}
      ORDER BY total_visits DESC
      LIMIT 100
    `;
    
    params.push(minVisits);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get station list for filter dropdown
  async getStations(): Promise<any[]> {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT "Id", "Title" 
      FROM "Stations" 
      WHERE "Deleted" = false 
      ORDER BY "Title"
    `);
    return result.rows;
  }

  // Get categories list for filter dropdown
  async getCategories(): Promise<any[]> {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT "Id", "Title" 
      FROM "Categories" 
      WHERE "Deleted" = false 
      ORDER BY "Title"
    `);
    return result.rows;
  }

  // Get date range of available data
  async getDataDateRange(): Promise<{ earliest: Date; latest: Date }> {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT 
        MIN("PostedOn") as earliest,
        MAX("PostedOn") as latest
      FROM "Tallies"
      WHERE "Deleted" = false
    `);
    return {
      earliest: result.rows[0]?.earliest || new Date(),
      latest: result.rows[0]?.latest || new Date()
    };
  }
}

export default new AdvancedAnalyticsService();
