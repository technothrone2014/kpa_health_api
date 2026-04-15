// services/intelligentQueryService.ts
import { poolPromise } from '../db/pool';
import clientAnalyticsService from './clientAnalyticsService';

interface ParsedQuery {
  intent: string;
  category?: string;
  condition?: string;
  minVisits?: number;
  period?: 'latest' | 'all' | 'specific';
  consecutiveFlag?: boolean;
  consecutiveCount?: number;
  riskLevel?: string;
  filters: any;
}

class IntelligentQueryService {
  
  // Parse natural language query into structured intent
  parseQuery(query: string): ParsedQuery {
    const lowerQuery = query.toLowerCase();
    const parsed: ParsedQuery = { intent: 'unknown', filters: {} };
    
    // Detect category
    if (lowerQuery.includes('employee') || lowerQuery.includes('staff')) {
      parsed.category = 'EMPLOYEE';
    } else if (lowerQuery.includes('dependant') || lowerQuery.includes('dependent')) {
      parsed.category = 'DEPENDENT';
    } else if (lowerQuery.includes('port user') || lowerQuery.includes('port')) {
      parsed.category = 'PORT USER';
    }
    
    // Detect condition
    if (lowerQuery.includes('blood pressure') || lowerQuery.includes('bp') || 
        lowerQuery.includes('hypertension') || lowerQuery.includes('hypertensive')) {
      parsed.condition = 'BP';
      parsed.intent = 'condition_query';
    } else if (lowerQuery.includes('bmi') || lowerQuery.includes('obese') || 
               lowerQuery.includes('overweight') || lowerQuery.includes('weight')) {
      parsed.condition = 'BMI';
      parsed.intent = 'condition_query';
    } else if (lowerQuery.includes('blood sugar') || lowerQuery.includes('rbs') || 
               lowerQuery.includes('diabetic') || lowerQuery.includes('diabetes')) {
      parsed.condition = 'RBS';
      parsed.intent = 'condition_query';
    }
    
    // Detect "abnormal" keyword
    parsed.filters.abnormalOnly = lowerQuery.includes('abnormal') || 
                                   lowerQuery.includes('elevated') || 
                                   lowerQuery.includes('high');
    
    // Detect consecutive visits
    if (lowerQuery.includes('consecutive')) {
      parsed.consecutiveFlag = true;
      const match = lowerQuery.match(/consecutive\s*(\d+)/);
      parsed.consecutiveCount = match ? parseInt(match[1]) : 2;
      parsed.intent = 'consecutive_abnormal';
    }
    
    // Detect visit count
    const visitMatch = lowerQuery.match(/(\d+)\s*visits?/);
    if (visitMatch) {
      parsed.minVisits = parseInt(visitMatch[1]);
    }
    
    // Detect period
    if (lowerQuery.includes('latest') || lowerQuery.includes('last') || lowerQuery.includes('recent')) {
      parsed.period = 'latest';
    } else if (lowerQuery.includes('all time') || lowerQuery.includes('entire')) {
      parsed.period = 'all';
    }
    
    // Detect risk level
    if (lowerQuery.includes('high risk')) {
      parsed.riskLevel = 'HIGH';
      parsed.intent = 'risk_query';
    } else if (lowerQuery.includes('medium risk') || lowerQuery.includes('intermediate')) {
      parsed.riskLevel = 'MEDIUM';
      parsed.intent = 'risk_query';
    } else if (lowerQuery.includes('healthy') || lowerQuery.includes('normal')) {
      parsed.riskLevel = 'LOW';
      parsed.intent = 'health_query';
    }
    
    // Detect "show me" or "list" intent
    if (lowerQuery.includes('show') || lowerQuery.includes('list') || 
        lowerQuery.includes('get') || lowerQuery.includes('find')) {
      if (parsed.intent === 'unknown') parsed.intent = 'list_all';
    }
    
    return parsed;
  }

  // Execute query for consecutive abnormal readings
  async queryConsecutiveAbnormal(parsed: ParsedQuery, baseFilters: any): Promise<any> {
    const pool = await poolPromise;
    const params: any[] = [];
    let whereClause = this.buildWhereClause(baseFilters, params);
    
    // Add category filter
    if (parsed.category) {
      whereClause += ` AND cat."Title" = $${params.length + 1}`;
      params.push(parsed.category);
    }
    
    const consecutiveCount = parsed.consecutiveCount || 2;
    const conditionField = parsed.condition === 'BP' ? 'bp_status' : 
                          parsed.condition === 'BMI' ? 'bmi_status' : 'rbs_status';
    
    const query = `
      WITH client_visits_ordered AS (
        SELECT 
          c."Id" as client_id,
          c."FullName",
          c."IDNumber",
          c."PhoneNumber",
          cat."Title" as category,
          COALESCE(s."Title", 'Unknown') as station,
          g."Title" as gender,
          t."PostedOn" as visit_date,
          TRIM(bp."Title") as bp_status,
          TRIM(bmi."Title") as bmi_status,
          TRIM(rbs."Title") as rbs_status,
          ROW_NUMBER() OVER (PARTITION BY c."Id" ORDER BY t."PostedOn" DESC) as visit_rank,
          COUNT(*) OVER (PARTITION BY c."Id") as total_visits
        FROM "Clients" c
        JOIN "Tallies" t ON c."Id" = t."ClientId"
        JOIN "Categories" cat ON c."CategoryId" = cat."Id"
        LEFT JOIN "Stations" s ON c."StationId" = s."Id"
        LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
        JOIN "BPINTValues" bp ON t."BPINTValueId" = bp."Id"
        JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
        JOIN "RBSINTValues" rbs ON t."RBSINTValueId" = rbs."Id"
        WHERE t."Deleted" = false 
          AND t."Status" = true
          AND c."Deleted" = false
          AND c."Status" = true
          ${whereClause}
      ),
      consecutive_check AS (
        SELECT 
          client_id,
          "FullName",
          "IDNumber",
          "PhoneNumber",
          category,
          station,
          gender,
          total_visits,
          MAX(visit_date) as last_visit,
          -- Check if last N consecutive visits are abnormal
          COUNT(*) FILTER (WHERE visit_rank <= ${consecutiveCount}) as recent_visits,
          COUNT(*) FILTER (WHERE visit_rank <= ${consecutiveCount} AND ${conditionField} != 'NORMAL') as abnormal_recent,
          -- Get the actual statuses
          ARRAY_AGG(${conditionField} ORDER BY visit_date DESC) as status_history
        FROM client_visits_ordered
        GROUP BY client_id, "FullName", "IDNumber", "PhoneNumber", category, station, gender, total_visits
        HAVING COUNT(*) >= ${consecutiveCount}
      )
      SELECT 
        client_id,
        "FullName",
        "IDNumber",
        "PhoneNumber",
        category,
        station,
        gender,
        total_visits,
        last_visit,
        abnormal_recent as consecutive_abnormal_count,
        status_history[1] as latest_status,
        status_history[2] as previous_status,
        status_history[3] as two_visits_ago,
        CASE 
          WHEN abnormal_recent = recent_visits THEN 'CONFIRMED_ABNORMAL'
          WHEN abnormal_recent >= 2 THEN 'LIKELY_ABNORMAL'
          ELSE 'MONITORING'
        END as pattern
      FROM consecutive_check
      WHERE abnormal_recent >= ${Math.ceil(consecutiveCount / 2)}
      ORDER BY abnormal_recent DESC, total_visits DESC
    `;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Execute query for latest EAP period
  async queryLatestPeriod(parsed: ParsedQuery, baseFilters: any): Promise<any> {
    const pool = await poolPromise;
    const params: any[] = [];
    
    // First, find the latest EAP period
    const periodQuery = `
      WITH daily_tallies AS (
        SELECT DATE(t."PostedOn") as screening_date
        FROM "Tallies" t
        WHERE t."Deleted" = false AND t."Status" = true
        GROUP BY DATE(t."PostedOn")
      ),
      with_gaps AS (
        SELECT 
          screening_date,
          CASE 
            WHEN LAG(screening_date) OVER (ORDER BY screening_date) IS NULL THEN 1
            WHEN screening_date - LAG(screening_date) OVER (ORDER BY screening_date) > 20 THEN 1
            ELSE 0
          END as new_period_flag
        FROM daily_tallies
      ),
      periods AS (
        SELECT 
          screening_date,
          SUM(new_period_flag) OVER (ORDER BY screening_date) as period_id
        FROM with_gaps
      )
      SELECT 
        period_id,
        MIN(screening_date) as period_start,
        MAX(screening_date) as period_end
      FROM periods
      GROUP BY period_id
      ORDER BY period_start DESC
      LIMIT 1
    `;
    
    const periodResult = await pool.query(periodQuery);
    if (periodResult.rows.length === 0) {
      return [];
    }
    
    const { period_start, period_end } = periodResult.rows[0];
    
    // Now query clients within this period
    const clientQuery = `
      WITH client_period_visits AS (
        SELECT 
          c."Id" as client_id,
          c."FullName",
          c."IDNumber",
          c."PhoneNumber",
          cat."Title" as category,
          COALESCE(s."Title", 'Unknown') as station,
          g."Title" as gender,
          COUNT(DISTINCT t."Id") as visits_in_period,
          COUNT(DISTINCT CASE WHEN bp."Title" != 'NORMAL' THEN t."Id" END) as abnormal_bp,
          COUNT(DISTINCT CASE WHEN bmi."Title" != 'NORMAL' THEN t."Id" END) as abnormal_bmi,
          COUNT(DISTINCT CASE WHEN rbs."Title" != 'NORMAL' THEN t."Id" END) as abnormal_rbs
        FROM "Clients" c
        JOIN "Tallies" t ON c."Id" = t."ClientId"
        JOIN "Categories" cat ON c."CategoryId" = cat."Id"
        LEFT JOIN "Stations" s ON c."StationId" = s."Id"
        LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
        JOIN "BPINTValues" bp ON t."BPINTValueId" = bp."Id"
        JOIN "BMIINTValues" bmi ON t."BMIINTValueId" = bmi."Id"
        JOIN "RBSINTValues" rbs ON t."RBSINTValueId" = rbs."Id"
        WHERE t."Deleted" = false AND t."Status" = true
          AND c."Deleted" = false AND c."Status" = true
          AND t."PostedOn" >= $1 AND t."PostedOn" <= $2
          ${parsed.category ? `AND cat."Title" = $3` : ''}
        GROUP BY c."Id", c."FullName", c."IDNumber", c."PhoneNumber", cat."Title", s."Title", g."Title"
      )
      SELECT * FROM client_period_visits
      WHERE ${parsed.condition === 'BP' ? 'abnormal_bp > 0' : 
             parsed.condition === 'BMI' ? 'abnormal_bmi > 0' : 'abnormal_rbs > 0'}
      ORDER BY visits_in_period DESC
    `;
    
    const queryParams = [period_start, period_end];
    if (parsed.category) queryParams.push(parsed.category);
    
    const result = await pool.query(clientQuery, queryParams);
    return result.rows;
  }

  // Build WHERE clause from filters
  private buildWhereClause(filters: any, params: any[]): string {
    const conditions: string[] = [];
    
    if (filters?.startDate) {
      conditions.push(`t."PostedOn" >= $${params.length + 1}`);
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push(`t."PostedOn" <= $${params.length + 1}`);
      params.push(filters.endDate);
    }
    if (filters?.station && filters.station !== 'all') {
      conditions.push(`s."Title" = $${params.length + 1}`);
      params.push(filters.station);
    }
    if (filters?.gender && filters.gender !== 'all') {
      conditions.push(`g."Title" ILIKE $${params.length + 1}`);
      params.push(filters.gender);
    }
    
    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  // Main execution method
  async executeQuery(query: string, filters: any): Promise<{
    executionTime: any;
    parsedIntent: any; data: any[]; insight: string; count: number 
}> {
    const parsed = this.parseQuery(query);
    const startTime = Date.now();
    
    let resultData: any[] = [];
    let insight = '';
    
    console.log('🔍 Parsed query:', parsed);
    
    try {
      if (parsed.intent === 'consecutive_abnormal') {
        resultData = await this.queryConsecutiveAbnormal(parsed, filters);
        insight = `Found ${resultData.length} ${parsed.category || ''} clients with ${parsed.consecutiveCount || 2}+ consecutive abnormal ${parsed.condition} readings. ${resultData.filter(r => r.pattern === 'CONFIRMED_ABNORMAL').length} show confirmed abnormal patterns.`;
      } else if (parsed.period === 'latest') {
        resultData = await this.queryLatestPeriod(parsed, filters);
        insight = `In the latest EAP period, found ${resultData.length} ${parsed.category || ''} clients with abnormal ${parsed.condition || 'readings'}.`;
      } else if (parsed.intent === 'risk_query') {
        const clientData = await clientAnalyticsService.getClientAnalytics(filters);
        resultData = clientData.highRiskPatientsList.filter(c => c.riskLevel === parsed.riskLevel);
        if (parsed.category) {
          resultData = resultData.filter(c => c.category === parsed.category);
        }
        insight = `Found ${resultData.length} ${parsed.riskLevel?.toLowerCase() || ''} risk ${parsed.category || 'clients'}.`;
      } else {
        // Default: use client analytics
        const clientData = await clientAnalyticsService.getClientAnalytics(filters);
        resultData = clientData.highRiskPatientsList;
        if (parsed.category) {
          resultData = resultData.filter(c => c.category === parsed.category);
        }
        insight = `Showing ${resultData.length} ${parsed.category || 'clients'}. Refine your query for more specific results.`;
      }
      
      return {
        data: resultData,
        insight,
        count: resultData.length,
        executionTime: `${Date.now() - startTime}ms`,
        parsedIntent: parsed
      };
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  }
}

export default new IntelligentQueryService();
