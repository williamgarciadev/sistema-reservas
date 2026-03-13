import { Router } from 'express';
import { servicesController } from '../controllers/services.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { isAdmin } from '../middleware/auth.js';

const router = Router();

// Public routes - anyone can list active services
router.get('/', (req, res, next) => servicesController.list(req, res, next));
router.get('/all', (req, res, next) => servicesController.listAll(req, res, next));
router.get('/:id', (req, res, next) => servicesController.getById(req, res, next));

// Protected routes - Admin only for CRUD operations
router.post('/', authMiddleware, isAdmin, (req, res, next) => servicesController.create(req, res, next));
router.patch('/:id', authMiddleware, isAdmin, (req, res, next) => servicesController.update(req, res, next));
router.post('/:id/deactivate', authMiddleware, isAdmin, (req, res, next) => servicesController.deactivate(req, res, next));
router.post('/:id/activate', authMiddleware, isAdmin, (req, res, next) => servicesController.activate(req, res, next));

export { router as servicesRoutes };
