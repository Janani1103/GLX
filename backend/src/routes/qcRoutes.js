import express from 'express';
import { recordQCResult, getQCResultsByBatch } from '../controllers/qcController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/results', requirePermission('production.manage'), recordQCResult);
router.get('/results/:batchId', requirePermission('production.view'), getQCResultsByBatch);

export default router;
