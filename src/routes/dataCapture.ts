import express from 'express';
import { 
  registerClient,
  searchClients,
  getClientById,
  checkFieldFindings,
  saveFieldFindings,
  saveLabFindings,
  saveOncologyFindings,
  updateFieldFindings,
  updateLabFindings,
  updateOncologyFindings,
  deleteFieldFindings,
  getLookupValues,
  interpretLookupValue
} from '../controllers/dataCaptureController';
import { authMiddleware } from '../middleware/authMiddleware';

import {
  listConfigItems,
  createConfigItem,
  toggleConfigItem,
} from '../controllers/adminConfigController';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Client management
router.post('/clients/register', registerClient);
router.get('/clients/search', searchClients);
router.get('/clients/:id', getClientById);
router.get('/clients/:id/has-field-findings', checkFieldFindings);

// Field findings (Tallies)
router.post('/tallies', saveFieldFindings);
router.put('/tallies/:id', updateFieldFindings);
router.delete('/tallies/:id', deleteFieldFindings);

// Lab findings (Findings)
router.post('/findings', saveLabFindings);
router.put('/findings/:id', updateLabFindings);

// Oncology findings
router.post('/oncologies', saveOncologyFindings);
router.put('/oncologies/:id', updateOncologyFindings);

// Interpretation preview (server-side range lookup)
router.get('/lookups/interpret/:type', interpretLookupValue);

// Lookup values
router.get('/lookups/:type', getLookupValues);

// ==================== ADMIN CONFIG ====================
router.get('/admin-config/:type', listConfigItems);
router.post('/admin-config/:type', createConfigItem);
router.patch('/admin-config/:type/:id', toggleConfigItem);

export default router;
