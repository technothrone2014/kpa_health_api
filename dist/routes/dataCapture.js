"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dataCaptureController_1 = require("../controllers/dataCaptureController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const adminConfigController_1 = require("../controllers/adminConfigController");
const router = express_1.default.Router();
// All routes require authentication
router.use(authMiddleware_1.authMiddleware);
// Client management
router.post('/clients/register', dataCaptureController_1.registerClient);
router.get('/clients/search', dataCaptureController_1.searchClients);
router.get('/clients/:id', dataCaptureController_1.getClientById);
router.get('/clients/:id/has-field-findings', dataCaptureController_1.checkFieldFindings);
router.put('/clients/:id', dataCaptureController_1.updateClient);
router.get('/clients/:id/tallies', dataCaptureController_1.getClientTallies);
router.get('/clients/:id/findings', dataCaptureController_1.getClientFindings);
router.get('/clients/:id/oncologies', dataCaptureController_1.getClientOncologies);
// Field findings (Tallies)
router.post('/tallies', dataCaptureController_1.saveFieldFindings);
router.put('/tallies/:id', dataCaptureController_1.updateFieldFindings);
router.delete('/tallies/:id', dataCaptureController_1.deleteFieldFindings);
// Lab findings (Findings)
router.post('/findings', dataCaptureController_1.saveLabFindings);
router.put('/findings/:id', dataCaptureController_1.updateLabFindings);
// Oncology findings
router.post('/oncologies', dataCaptureController_1.saveOncologyFindings);
router.put('/oncologies/:id', dataCaptureController_1.updateOncologyFindings);
// Interpretation preview (server-side range lookup)
router.get('/lookups/interpret/:type', dataCaptureController_1.interpretLookupValue);
// Lookup values
router.get('/lookups/:type', dataCaptureController_1.getLookupValues);
// ==================== ADMIN CONFIG ====================
router.get('/admin-config/:type', adminConfigController_1.listConfigItems);
router.post('/admin-config/:type', adminConfigController_1.createConfigItem);
router.put('/admin-config/:type/:id', adminConfigController_1.updateConfigItem);
router.patch('/admin-config/:type/:id', adminConfigController_1.toggleConfigItem);
exports.default = router;
