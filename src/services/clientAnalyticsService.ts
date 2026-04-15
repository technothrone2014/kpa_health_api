// services/clientAnalyticsService.ts
import { poolPromise } from '../db/pool';

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  station?: string;
  gender?: string;
}

export interface ClientHealthStatus {
  // Overall counts
  totalClientsSeen: number;
  totalVisits: number;
  
  // Health Score breakdown
  healthyClients: number;
  intermediateClients: number;
  highRiskClients: number;
  
  // Health Score percentages
  healthScore: number; // Healthy %
  intermediateScore: number; // Intermediate %
  highRiskScore: number; // High Risk %
  
  // Condition-specific client counts (based on clinical context)
  bloodPressure: {
    normal: number;
    mixed?: number;
    preHypertension: number;
    stage1Hypertension: number;
    stage2Hypertension: number;
    hypotension: number;
    total: number;
  };
  
  bmi: {
    underweight: number;
    normal: number;
    mixed?: number;
    overweight: number;
    obese: number;
    veryObese: number;
    total: number;
  };
  
  rbs: {
    normal: number;
    mixed?: number;
    hypoglycemia: number;
    preDiabetic: number;
    diabetic: number;
    total: number;
  };
  
  // Detailed high risk patients list
  highRiskPatientsList: HighRiskClient[];
}

export interface HighRiskClient {
  clientId: number;
  fullName: string;
  idNumber: string;
  phoneNumber: string;
  category: string;
  station: string;
  gender: string;
  totalVisits: number;
  bpStatus: string;
  bmiStatus: string;
  rbsStatus: string;
  abnormalConditions: string[]; // ['BP', 'BMI', 'RBS']
  conditionsCount: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore?: number;
  lastVisitDate: Date;
  visitHistory?: VisitSummary[];
}

export interface VisitSummary {
  date: Date;
  bpStatus: string;
  bmiStatus: string;
  rbsStatus: string;
}

class ClientAnalyticsService {
  
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

  /**
   * Determine client status from array of statuses (most recent first)
   * Clinical rules:
   * - 1 visit: Normal → NORMAL; Abnormal → ABNORMAL (Intermediate risk)
   * - 2 visits: 
   *   - Both Normal → NORMAL (Healthy)
   *   - One Normal, One Abnormal → MIXED (Intermediate)
   *   - Both Abnormal → ABNORMAL (High Risk)
   * - 3+ visits: 
   *   - Majority (2+) of last 3 are Normal → NORMAL (Healthy)
   *   - Majority (2+) of last 3 are Abnormal → ABNORMAL (High Risk)
   *   - Mixed (1 Normal, 1 Abnormal, 1 anything) → MIXED (Intermediate)
   */
  private determineClientStatusFromArray(statuses: string[]): 'NORMAL' | 'ABNORMAL' | 'MIXED' {
    if (!statuses || statuses.length === 0) return 'NORMAL';
    
    // Map to NORMAL/ABNORMAL
    const normalized = statuses.map(s => s === 'NORMAL' ? 'NORMAL' : 'ABNORMAL');
    
    // 1 visit
    if (statuses.length === 1) {
      return normalized[0] as 'NORMAL' | 'ABNORMAL';
    }
    
    // 2 visits
    if (statuses.length === 2) {
      const [first, second] = normalized;
      if (first === 'NORMAL' && second === 'NORMAL') return 'NORMAL';
      if (first === 'ABNORMAL' && second === 'ABNORMAL') return 'ABNORMAL';
      return 'MIXED'; // One normal, one abnormal
    }
    
    // 3+ visits: look at last 3
    const lastThree = normalized.slice(0, 3);
    const normalCount = lastThree.filter(s => s === 'NORMAL').length;
    const abnormalCount = lastThree.filter(s => s === 'ABNORMAL').length;
    
    // Majority (2 or more) are normal → NORMAL
    if (normalCount >= 2) return 'NORMAL';
    
    // Majority (2 or more) are abnormal → ABNORMAL
    if (abnormalCount >= 2) return 'ABNORMAL';
    
    // Mixed (e.g., 1 normal, 1 abnormal, 1 anything) → MIXED
    return 'MIXED';
  }

  /**
   * Get the actual status string (not just NORMAL/ABNORMAL/MIXED)
   * For display purposes, we need the actual category name
   */
  private getActualStatus(statuses: string[]): string {
    if (!statuses || statuses.length === 0) return 'NORMAL';
    
    const classification = this.determineClientStatusFromArray(statuses);
    
    if (classification === 'NORMAL') return 'NORMAL';
    if (classification === 'MIXED') return 'MIXED';
    
    // For ABNORMAL, return the most recent abnormal status
    const abnormalStatus = statuses.find(s => s !== 'NORMAL');
    return abnormalStatus || 'ABNORMAL';
  }

  /**
   * Get comprehensive client analytics
   */
  async getClientAnalytics(filters: AnalyticsFilters): Promise<ClientHealthStatus> {
    const pool = await poolPromise;
    const params: any[] = [];
    const whereClause = this.buildWhereClause(filters, params);
    
    console.log('🔍 Fetching client analytics with filters:', filters);
    
    // Step 1: Get all clients with their complete visit history
    const clientVisitsQuery = `
      WITH client_visits AS (
        SELECT 
          c."Id" as client_id,
          c."FullName",
          c."FirstName",
          c."LastName",
          c."IDNumber",
          c."PhoneNumber",
          cat."Title" as category,
          COALESCE(s."Title", 'Unknown') as station,
          COALESCE(g."Title", 'Unknown') as gender,
          t."Id" as tally_id,
          t."PostedOn" as visit_date,
          bp."Title" as bp_status,
          bmi."Title" as bmi_status,
          rbs."Title" as rbs_status
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
          ${whereClause}
      ),
      client_summary AS (
        SELECT 
          client_id,
          "FullName",
          "FirstName",
          "LastName",
          "IDNumber",
          "PhoneNumber",
          category,
          station,
          gender,
          COUNT(DISTINCT tally_id) as total_visits,
          MAX(visit_date) as last_visit_date,
          -- Get arrays of statuses for each client (most recent first)
          ARRAY_AGG(bp_status ORDER BY visit_date DESC) as bp_statuses,
          ARRAY_AGG(bmi_status ORDER BY visit_date DESC) as bmi_statuses,
          ARRAY_AGG(rbs_status ORDER BY visit_date DESC) as rbs_statuses
        FROM client_visits
        GROUP BY client_id, "FullName", "FirstName", "LastName", "IDNumber", "PhoneNumber", category, station, gender
      )
      SELECT * FROM client_summary
      ORDER BY total_visits DESC
    `;
    
    const result = await pool.query(clientVisitsQuery, params);
    const clients = result.rows;
    
    console.log(`📊 Found ${clients.length} clients with visits`);
    
    // Step 2: Process each client to determine their final status based on visit history
    const processedClients = clients.map((client: any) => {
      const bpClassification = this.determineClientStatusFromArray(client.bp_statuses || []);
      const bmiClassification = this.determineClientStatusFromArray(client.bmi_statuses || []);
      const rbsClassification = this.determineClientStatusFromArray(client.rbs_statuses || []);
      
      // Get actual status strings for display
      const finalBpStatus = this.getActualStatus(client.bp_statuses || []);
      const finalBmiStatus = this.getActualStatus(client.bmi_statuses || []);
      const finalRbsStatus = this.getActualStatus(client.rbs_statuses || []);
      
      // Determine overall health classification
      // A client is HEALTHY only if ALL THREE are NORMAL
      const isHealthy = bpClassification === 'NORMAL' && 
                        bmiClassification === 'NORMAL' && 
                        rbsClassification === 'NORMAL';
      
      // Count abnormal conditions (ABNORMAL or MIXED count as a condition)
      const abnormalConditions = [];
      if (bpClassification !== 'NORMAL') abnormalConditions.push('BP');
      if (bmiClassification !== 'NORMAL') abnormalConditions.push('BMI');
      if (rbsClassification !== 'NORMAL') abnormalConditions.push('RBS');
      
      const conditionsCount = abnormalConditions.length;
      
      // Count how many are ABNORMAL vs MIXED
      const abnormalCount = [bpClassification, bmiClassification, rbsClassification]
        .filter(c => c === 'ABNORMAL').length;
      const mixedCount = [bpClassification, bmiClassification, rbsClassification]
        .filter(c => c === 'MIXED').length;
      
      // Determine risk level based on classifications
      let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      
      if (abnormalCount >= 2) {
        riskLevel = 'HIGH';
      } else if (abnormalCount === 1 || mixedCount >= 1) {
        riskLevel = 'MEDIUM';
      } else {
        riskLevel = 'LOW'; // All NORMAL
      }
      
      // Calculate risk score (0-100)
      const riskScore = Math.min(100, Math.round(
        (abnormalCount * 35) + (mixedCount * 15) + (client.total_visits >= 2 ? 10 : 0)
      ));
      
      return {
        ...client,
        bpClassification,
        bmiClassification,
        rbsClassification,
        finalBpStatus,
        finalBmiStatus,
        finalRbsStatus,
        isHealthy,
        abnormalConditions,
        conditionsCount,
        abnormalCount,
        mixedCount,
        riskLevel,
        riskScore
      };
    });
    
    // Log some samples for debugging
    const sampleHealthy = processedClients.filter(c => c.isHealthy).slice(0, 3);
    console.log('✅ Sample healthy clients:', sampleHealthy.map(c => ({
      name: c.FullName,
      visits: c.total_visits,
      bp: c.finalBpStatus,
      bmi: c.finalBmiStatus,
      rbs: c.finalRbsStatus
    })));
    
    const sampleMixed = processedClients.filter(c => c.mixedCount > 0).slice(0, 3);
    console.log('🟡 Sample intermediate/mixed clients:', sampleMixed.map(c => ({
      name: c.FullName,
      visits: c.total_visits,
      bp: `${c.finalBpStatus} (${c.bpClassification})`,
      bmi: `${c.finalBmiStatus} (${c.bmiClassification})`,
      rbs: `${c.finalRbsStatus} (${c.rbsClassification})`
    })));
    
    // Step 3: Calculate aggregates
    const totalClientsSeen = processedClients.length;
    
    const healthyClients = processedClients.filter(c => c.isHealthy).length;
    const highRiskClients = processedClients.filter(c => c.riskLevel === 'HIGH').length;
    const intermediateClients = totalClientsSeen - healthyClients - highRiskClients;
    
    console.log(`📈 Stats: Total=${totalClientsSeen}, Healthy=${healthyClients}, Intermediate=${intermediateClients}, HighRisk=${highRiskClients}`);
    
    // Blood Pressure distribution
    const bpCounts = {
      normal: processedClients.filter(c => c.finalBpStatus === 'NORMAL').length,
      mixed: processedClients.filter(c => c.finalBpStatus === 'MIXED').length,
      preHypertension: processedClients.filter(c => 
        c.finalBpStatus === 'PRE-HYPERTENSION'
      ).length,
      stage1Hypertension: processedClients.filter(c => 
        c.finalBpStatus === 'STAGE I HYPERTENSION' || c.finalBpStatus === 'STAGE 1 HYPERTENSION'
      ).length,
      stage2Hypertension: processedClients.filter(c => 
        c.finalBpStatus === 'STAGE II HYPERTENSION' || 
        c.finalBpStatus === 'STAGE 2 HYPERTENSION' ||
        c.finalBpStatus === 'HYPERTENSION'
      ).length,
      hypotension: processedClients.filter(c => c.finalBpStatus === 'HYPOTENSION').length,
    };
    
    // BMI distribution
    const bmiCounts = {
      underweight: processedClients.filter(c => c.finalBmiStatus === 'UNDERWEIGHT').length,
      normal: processedClients.filter(c => c.finalBmiStatus === 'NORMAL').length,
      mixed: processedClients.filter(c => c.finalBmiStatus === 'MIXED').length,
      overweight: processedClients.filter(c => c.finalBmiStatus === 'OVERWEIGHT').length,
      obese: processedClients.filter(c => c.finalBmiStatus === 'OBESE').length,
      veryObese: processedClients.filter(c => 
        c.finalBmiStatus === 'VERY OBESE' || c.finalBmiStatus === 'VERY OBESE'
      ).length,
    };
    
    // RBS distribution
    const rbsCounts = {
      normal: processedClients.filter(c => c.finalRbsStatus === 'NORMAL').length,
      mixed: processedClients.filter(c => c.finalRbsStatus === 'MIXED').length,
      hypoglycemia: processedClients.filter(c => c.finalRbsStatus === 'HYPOGLYCEMIA').length,
      preDiabetic: processedClients.filter(c => c.finalRbsStatus === 'PRE-DIABETIC').length,
      diabetic: processedClients.filter(c => c.finalRbsStatus === 'DIABETIC').length,
    };
    
    // Step 4: Build high risk patients list
    const highRiskPatientsList: HighRiskClient[] = processedClients
      .filter(c => c.riskLevel === 'HIGH')
      .map(c => ({
        clientId: c.client_id,
        fullName: c.FullName,
        idNumber: c.IDNumber,
        phoneNumber: c.PhoneNumber,
        category: c.category,
        station: c.station,
        gender: c.gender,
        totalVisits: c.total_visits,
        bpStatus: c.finalBpStatus,
        bmiStatus: c.finalBmiStatus,
        rbsStatus: c.finalRbsStatus,
        abnormalConditions: c.abnormalConditions,
        conditionsCount: c.conditionsCount,
        riskLevel: c.riskLevel,
        riskScore: c.riskScore,
        lastVisitDate: c.last_visit_date,
        visitHistory: []
      }))
      .sort((a, b) => b.conditionsCount - a.conditionsCount || b.totalVisits - a.totalVisits);
    
    // Step 5: Get total visits count
    const totalVisitsResult = await pool.query(`
      SELECT COUNT(DISTINCT t."Id") as total_visits
      FROM "Tallies" t
      JOIN "Clients" c ON t."ClientId" = c."Id"
      JOIN "Categories" cat ON c."CategoryId" = cat."Id"
      LEFT JOIN "Stations" s ON c."StationId" = s."Id"
      LEFT JOIN "Genders" g ON c."GenderId" = g."Id"
      WHERE t."Deleted" = false AND t."Status" = true
        AND c."Deleted" = false
        ${whereClause}
    `, params);
    
    const totalVisits = parseInt(totalVisitsResult.rows[0]?.total_visits || '0');
    
    return {
      totalClientsSeen,
      totalVisits,
      
      healthyClients,
      intermediateClients,
      highRiskClients,
      
      healthScore: totalClientsSeen > 0 ? (healthyClients / totalClientsSeen) * 100 : 0,
      intermediateScore: totalClientsSeen > 0 ? (intermediateClients / totalClientsSeen) * 100 : 0,
      highRiskScore: totalClientsSeen > 0 ? (highRiskClients / totalClientsSeen) * 100 : 0,
      
      bloodPressure: {
        ...bpCounts,
        total: totalClientsSeen
      },
      
      bmi: {
        ...bmiCounts,
        total: totalClientsSeen
      },
      
      rbs: {
        ...rbsCounts,
        total: totalClientsSeen
      },
      
      highRiskPatientsList
    };
  }

  /**
   * Get client health status for charts (simplified)
   */
  async getClientHealthStatus(filters: AnalyticsFilters): Promise<any> {
    const analytics = await this.getClientAnalytics(filters);
    
    return {
      totalClients: analytics.totalClientsSeen,
      totalVisits: analytics.totalVisits,
      healthScore: {
        healthy: analytics.healthyClients,
        intermediate: analytics.intermediateClients,
        highRisk: analytics.highRiskClients,
        healthyPercentage: analytics.healthScore,
        intermediatePercentage: analytics.intermediateScore,
        highRiskPercentage: analytics.highRiskScore
      },
      bloodPressure: analytics.bloodPressure,
      bmi: analytics.bmi,
      rbs: analytics.rbs,
      highRiskPatients: analytics.highRiskPatientsList
    };
  }
}

export default new ClientAnalyticsService();
