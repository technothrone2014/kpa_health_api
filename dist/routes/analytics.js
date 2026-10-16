"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const analyticsController_1 = require("../controllers/analyticsController");
const advancedAnalyticsController_1 = require("../controllers/advancedAnalyticsController");
const analyticsController_2 = require("../controllers/analyticsController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.use(authMiddleware_1.authMiddleware);
// Client summary endpoints
router.get('/clients/category', analyticsController_1.getClientsPerCategory);
router.get('/clients/category-gender', analyticsController_1.getClientsPerCategoryPerGender);
router.get('/clients/category-station', analyticsController_1.getClientsPerCategoryPerStation);
// Employee health metrics endpoints
router.get('/employees/blood-pressure', analyticsController_1.getEmployeeBloodPressureResults);
router.get('/employees/bmi', analyticsController_1.getEmployeeBMIResults);
router.get('/employees/random-blood-sugar', analyticsController_1.getEmployeeRandomBloodSugarResults);
router.get('/employees/bmd', analyticsController_1.getEmployeeBMDResults);
router.get('/employees/fbs', analyticsController_1.getEmployeeFBSResults);
router.get('/employees/hba1c', analyticsController_1.getEmployeeHBA1CResults);
router.get('/employees/lipid-profile', analyticsController_1.getEmployeeLipidProfileResults);
router.get('/employees/microalbumin', analyticsController_1.getEmployeeMicroalbuminResults);
router.get('/employees/psa', analyticsController_1.getEmployeePSAResults);
router.get('/employees/hepatitis', analyticsController_1.getEmployeeHepatitisResults);
router.get('/employees/rbs', advancedAnalyticsController_1.getRBSDistribution);
// Oncology endpoints
router.get('/employees/breast-exam', analyticsController_1.getEmployeeBreastExamResults);
router.get('/employees/pap-smear', analyticsController_1.getEmployeePAPSmearResults);
router.get('/employees/via-villi', analyticsController_1.getEmployeeViaVilliResults);
// Dashboard overview
router.get('/dashboard/overview', analyticsController_1.getDashboardOverview);
// Advanced Analytics Routes
router.get('/trends', advancedAnalyticsController_1.getHealthTrends);
router.get('/high-risk-patients', advancedAnalyticsController_1.getHighRiskPatients);
router.get('/export', advancedAnalyticsController_1.exportReport);
router.post('/ai-query', advancedAnalyticsController_1.naturalLanguageQuery);
router.get('/date-range', advancedAnalyticsController_1.getDateRange);
router.get('/summary-metrics', advancedAnalyticsController_1.getSummaryMetrics);
router.get('/abnormal-readings', advancedAnalyticsController_1.getAbnormalReadings);
router.get('/multi-visit-abnormal', advancedAnalyticsController_1.getMultiVisitAbnormal);
router.get('/stations', advancedAnalyticsController_1.getStations);
router.get('/categories', advancedAnalyticsController_1.getCategories);
router.get('/data-date-range', advancedAnalyticsController_1.getDataDateRange);
// routes/analytics.ts
router.get('/clients/health-status', analyticsController_1.getClientHealthStatus);
router.get('/clients/high-risk', analyticsController_1.getHighRiskClients);
router.get('/clients/station-distribution', analyticsController_1.getStationDistribution);
router.get('/clients/category-distribution', analyticsController_1.getCategoryDistribution);
router.get('/clients/gender-distribution', analyticsController_2.getGenderDistribution);
// Participation Trends Routes
router.get('/participation/periods', analyticsController_1.getParticipationByPeriods);
router.get('/participation/daily', analyticsController_1.getParticipationDaily);
router.post('/intelligent-query', advancedAnalyticsController_1.intelligentQuery);
exports.default = router;
