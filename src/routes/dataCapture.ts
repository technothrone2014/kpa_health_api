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
  getLookupValues
} from '../controllers/dataCaptureController';
import { authMiddleware } from '../middleware/authMiddleware';

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

// Lookup values
router.get('/lookups/:type', getLookupValues);

export default router;
