import { Router } from 'express';
import { employeesController } from '../controllers/employees.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { isAdmin } from '../middleware/auth.js';

const router = Router();

// Public routes - anyone can list active employees
router.get('/', (req, res, next) => employeesController.list(req, res, next));
router.get('/by-service/:servicioId', (req, res, next) => employeesController.listByServicio(req, res, next));
router.get('/:id', (req, res, next) => employeesController.getById(req, res, next));

// Protected routes - Admin only for CRUD operations
router.post('/', authMiddleware, isAdmin, (req, res, next) => employeesController.create(req, res, next));
router.patch('/:id', authMiddleware, isAdmin, (req, res, next) => employeesController.update(req, res, next));
router.post('/:id/deactivate', authMiddleware, isAdmin, (req, res, next) => employeesController.deactivate(req, res, next));
router.post('/:id/activate', authMiddleware, isAdmin, (req, res, next) => employeesController.activate(req, res, next));

// Servicio assignment routes
router.post('/:id/servicios', authMiddleware, isAdmin, (req, res, next) => employeesController.assignServicio(req, res, next));
router.delete('/:id/servicios/:servicioId', authMiddleware, isAdmin, (req, res, next) => employeesController.removeServicio(req, res, next));

export { router as employeesRoutes };
