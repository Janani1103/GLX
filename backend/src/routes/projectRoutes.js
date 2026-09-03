import express from 'express';
import {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deliverProject,
    deleteProject
} from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
    .get(requirePermission('sales.view'), getProjects)
    .post(requirePermission('sales.create'), createProject);

router.route('/:id')
    .get(requirePermission('sales.view'), getProjectById)
    .put(requirePermission('sales.create'), updateProject)
    .delete(requirePermission('sales.create'), deleteProject);

router.post('/:id/deliver', requirePermission('sales.create'), deliverProject);

export default router;
