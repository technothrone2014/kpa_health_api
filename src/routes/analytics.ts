import express from 'express';
import {
  getClientsPerCategory,
  getClientsPerCategoryPerGender,
  getClientsPerCategoryPerStation,
  getEmployeeBloodPressureResults,
  getEmployeeBMIResults,
  getEmployeeRandomBloodSugarResults,
  getEmployeeBMDResults,
  getEmployeeFBSResults,
  getEmployeeHBA1CResults,
  getEmployeeLipidProfileResults,
  getEmployeeMicroalbuminResults,
  getEmployeePSAResults,
  getEmployeeHepatitisResults,
  getEmployeeBreastExamResults,
  getEmployeePAPSmearResults,
  getEmployeeViaVilliResults,
  getDashboardOverview
} from '../controllers/analyticsController';

import {
  getHealthTrends,
  getHighRiskPatients as getAdvancedHighRiskPatients,
  exportReport,
  naturalLanguageQuery,
  getDateRange,
  getSummaryMetrics,
  getAbnormalReadings,
  getMultiVisitAbnormal,
  getStations,
  getCategories,
  getDataDateRange
} from '../controllers/advancedAnalyticsController';

const router = express.Router();

// Client summary endpoints
router.get('/clients/category', getClientsPerCategory);
router.get('/clients/category-gender', getClientsPerCategoryPerGender);
router.get('/clients/category-station', getClientsPerCategoryPerStation);

// Employee health metrics endpoints
router.get('/employees/blood-pressure', getEmployeeBloodPressureResults);
router.get('/employees/bmi', getEmployeeBMIResults);
router.get('/employees/random-blood-sugar', getEmployeeRandomBloodSugarResults);
router.get('/employees/bmd', getEmployeeBMDResults);
router.get('/employees/fbs', getEmployeeFBSResults);
router.get('/employees/hba1c', getEmployeeHBA1CResults);
router.get('/employees/lipid-profile', getEmployeeLipidProfileResults);
router.get('/employees/microalbumin', getEmployeeMicroalbuminResults);
router.get('/employees/psa', getEmployeePSAResults);
router.get('/employees/hepatitis', getEmployeeHepatitisResults);

// Oncology endpoints
router.get('/employees/breast-exam', getEmployeeBreastExamResults);
router.get('/employees/pap-smear', getEmployeePAPSmearResults);
router.get('/employees/via-villi', getEmployeeViaVilliResults);

// Dashboard overview
router.get('/dashboard/overview', getDashboardOverview);

// Advanced Analytics Routes
router.get('/trends', getHealthTrends);
router.get('/high-risk-patients', getAdvancedHighRiskPatients);
router.get('/export', exportReport);
router.post('/ai-query', naturalLanguageQuery);
router.get('/date-range', getDateRange);
router.get('/summary-metrics', getSummaryMetrics);
router.get('/abnormal-readings', getAbnormalReadings);
router.get('/multi-visit-abnormal', getMultiVisitAbnormal);
router.get('/stations', getStations);
router.get('/categories', getCategories);
router.get('/data-date-range', getDataDateRange);

export default router;
