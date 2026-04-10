import express from 'express';
import { getPatientVisits, getPatientTrends } from '../controllers/patientsController';

const router = express.Router();

router.get('/:id/visits', getPatientVisits);
router.get('/:id/trends', getPatientTrends);

export default router;