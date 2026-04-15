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
  lastVisitDate: Date;
  visitHistory: VisitSummary[];
}

export interface VisitSummary {
  date: Date;
  bpStatus: string;
  bmiStatus: string;
  rbsStatus: string;
}

class ClientAnalyticsService {
  
  // Build WHERE clause from filters
  private buildWhereClause(filters: AnalyticsFilters, params: any[], alias: string = 'c'): string {
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
   * Determine a client's current status based on visit history
   * Following clinical rules:
   * - 1 visit: status is whatever that visit was
   * - 2 visits: if either is abnormal, treat as abnormal
   * - 3+ visits: if majority of last 3 visits is normal, treat as normal; otherwise keep abnormal
   */
  private determineClientStatus(visits: any[], statusField: string): string {
    if (!visits || visits.length === 0) return 'UNKNOWN';
    
    // Sort visits by date (most recent first)
    const sortedVisits = [...visits].sort((a, b) => 
      new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
    );
    
    // Get statuses (NORMAL vs anything else)
    const statuses = sortedVisits.map(v => v[statusField] === 'NORMAL' ? 'NORMAL' : 'ABNORMAL');
    
    // 1 visit: whatever it was
    if (statuses.length === 1) {
      return sortedVisits[0][statusField];
    }
    
    // 2 visits: if ANY abnormal, treat as abnormal
    if (statuses.length === 2) {
      if (statuses.includes('ABNORMAL')) {
        // Return the most recent abnormal status
        const abnormalVisit = sortedVisits.find(v => v[statusField] !== 'NORMAL');
        return abnormalVisit ? abnormalVisit[statusField] : 'NORMAL';
      }
      return 'NORMAL';
    }
    
    // 3+ visits: look at last 3
    const lastThree = statuses.slice(0, 3);
    const normalCount = lastThree.filter(s => s === 'NORMAL').length;
    const abnormalCount = lastThree.filter(s => s === 'ABNORMAL').length;
    
    // If majority (2 or more) of last 3 are normal → Normal
    if (normalCount >= 2) {
      return 'NORMAL';
    }
    
    // Otherwise return the most recent abnormal status
    const abnormalVisit = sortedVisits.find(v => v[statusField] !== 'NORMAL');
    return abnormalVisit ? abnormalVisit[statusField] : 'NORMAL';
  }

  /**
   * Get comprehensive client analytics
   */
  async getClientAnalytics(filters: AnalyticsFilters): Promise<ClientHealthStatus> {
    const pool = await poolPromise;
    const params: any[] = [];
    const whereClause = this.buildWhereClause(filters, params);
    
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
          rbs."Title" as rbs_status,
          -- Order within client
          ROW_NUMBER() OVER (PARTITION BY c."Id" ORDER BY t."PostedOn" DESC) as visit_rank
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
          -- Get arrays of statuses for each client
          ARRAY_AGG(bp_status ORDER BY visit_date DESC) as bp_statuses,
          ARRAY_AGG(bmi_status ORDER BY visit_date DESC) as bmi_statuses,
          ARRAY_AGG(rbs_status ORDER BY visit_date DESC) as rbs_statuses,
          -- Get the most recent status
          (ARRAY_AGG(bp_status ORDER BY visit_date DESC))[1] as latest_bp,
          (ARRAY_AGG(bmi_status ORDER BY visit_date DESC))[1] as latest_bmi,
          (ARRAY_AGG(rbs_status ORDER BY visit_date DESC))[1] as latest_rbs
        FROM client_visits
        GROUP BY client_id, "FullName", "FirstName", "LastName", "IDNumber", "PhoneNumber", category, station, gender
      )
      SELECT * FROM client_summary
      ORDER BY total_visits DESC
    `;
    
    const result = await pool.query(clientVisitsQuery, params);
    const clients = result.rows;
    
    // Step 2: Process each client to determine their final status based on visit history
    const processedClients = clients.map((client: any) => {
      // Reconstruct visits for status determination
      const bpVisits = client.bp_statuses.map((status: string, idx: number) => ({
        visit_date: new Date(),
        bp_status: status
      }));
      
      const bmiVisits = client.bmi_statuses.map((status: string, idx: number) => ({
        visit_date: new Date(),
        bmi_status: status
      }));
      
      const rbsVisits = client.rbs_statuses.map((status: string, idx: number) => ({
        visit_date: new Date(),
        rbs_status: status
      }));
      
      // Determine final status using clinical rules
      const finalBpStatus = this.determineClientStatusFromArray(client.bp_statuses);
      const finalBmiStatus = this.determineClientStatusFromArray(client.bmi_statuses);
      const finalRbsStatus = this.determineClientStatusFromArray(client.rbs_statuses);
      
      // Determine if client is healthy (all normal), high risk, or intermediate
      const isHealthy = finalBpStatus === 'NORMAL' && 
                        finalBmiStatus === 'NORMAL' && 
                        finalRbsStatus === 'NORMAL';
      
      const abnormalConditions = [];
      if (finalBpStatus !== 'NORMAL') abnormalConditions.push('BP');
      if (finalBmiStatus !== 'NORMAL') abnormalConditions.push('BMI');
      if (finalRbsStatus !== 'NORMAL') abnormalConditions.push('RBS');
      
      const conditionsCount = abnormalConditions.length;
      
      // Risk level based on conditions count and visits
      let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (conditionsCount >= 2 || (conditionsCount === 1 && client.total_visits >= 2)) {
        riskLevel = 'HIGH';
      } else if (conditionsCount === 1) {
        riskLevel = 'MEDIUM';
      }
      
      return {
        ...client,
        finalBpStatus,
        finalBmiStatus,
        finalRbsStatus,
        isHealthy,
        abnormalConditions,
        conditionsCount,
        riskLevel
      };
    });
    
    // Step 3: Calculate aggregates
    const totalClientsSeen = processedClients.length;
    
    const healthyClients = processedClients.filter(c => c.isHealthy).length;
    const highRiskClients = processedClients.filter(c => c.riskLevel === 'HIGH').length;
    const intermediateClients = totalClientsSeen - healthyClients - highRiskClients;
    
    // Blood Pressure distribution
    const bpCounts = {
      normal: processedClients.filter(c => c.finalBpStatus === 'NORMAL').length,
      preHypertension: processedClients.filter(c => c.finalBpStatus === 'PRE-HYPERTENSION').length,
      stage1Hypertension: processedClients.filter(c => c.finalBpStatus === 'STAGE I HYPERTENSION').length,
      stage2Hypertension: processedClients.filter(c => c.finalBpStatus === 'STAGE II HYPERTENSION').length,
      hypotension: processedClients.filter(c => c.finalBpStatus === 'HYPOTENSION').length,
    };
    
    // BMI distribution
    const bmiCounts = {
      underweight: processedClients.filter(c => c.finalBmiStatus === 'UNDERWEIGHT').length,
      normal: processedClients.filter(c => c.finalBmiStatus === 'NORMAL').length,
      overweight: processedClients.filter(c => c.finalBmiStatus === 'OVERWEIGHT').length,
      obese: processedClients.filter(c => c.finalBmiStatus === 'OBESE').length,
      veryObese: processedClients.filter(c => c.finalBmiStatus === 'VERY OBESE').length,
    };
    
    // RBS distribution
    const rbsCounts = {
      normal: processedClients.filter(c => c.finalRbsStatus === 'NORMAL').length,
      hypoglycemia: processedClients.filter(c => c.finalRbsStatus === 'HYPOGLYCEMIA').length,
      preDiabetic: processedClients.filter(c => c.finalRbsStatus === 'PRE-DIABETIC').length,
      diabetic: processedClients.filter(c => c.finalRbsStatus === 'DIABETIC').length,
    };
    
    // Step 4: Build high risk patients list with visit history
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
        lastVisitDate: c.last_visit_date,
        visitHistory: [] // Can be populated if needed
      }));
    
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
   * Determine client status from array of statuses (most recent first)
   */
  private determineClientStatusFromArray(statuses: string[]): string {
    if (!statuses || statuses.length === 0) return 'UNKNOWN';
    
    const normalStatuses = statuses.map(s => s === 'NORMAL' ? 'NORMAL' : 'ABNORMAL');
    
    // 1 visit
    if (statuses.length === 1) {
      return statuses[0];
    }
    
    // 2 visits: if any abnormal → abnormal
    if (statuses.length === 2) {
      if (normalStatuses.includes('ABNORMAL')) {
        return statuses.find(s => s !== 'NORMAL') || 'NORMAL';
      }
      return 'NORMAL';
    }
    
    // 3+ visits: check last 3
    const lastThree = normalStatuses.slice(0, 3);
    const normalCount = lastThree.filter(s => s === 'NORMAL').length;
    
    if (normalCount >= 2) {
      return 'NORMAL';
    }
    
    return statuses.find(s => s !== 'NORMAL') || 'NORMAL';
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
