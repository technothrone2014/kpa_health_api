import express from 'express';
import { getPatientVisits, getPatientTrends } from '../controllers/patientsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authMiddleware);
router.get('/:id/visits', getPatientVisits);
router.get('/:id/trends', getPatientTrends);

export default router;