import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { appointmentsController } from '../controllers/appointments.controller.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/appointments/availability - Check available slots (must be before /:id)
router.get('/availability', appointmentsController.getAvailability.bind(appointmentsController));

// GET /api/appointments - List appointments (filtered by user role)
router.get('/', appointmentsController.list.bind(appointmentsController));

// GET /api/appointments/:id - Get appointment by ID
router.get('/:id', appointmentsController.getById.bind(appointmentsController));

// POST /api/appointments - Create appointment
router.post('/', appointmentsController.create.bind(appointmentsController));

// PATCH /api/appointments/:id - Update/reschedule appointment
router.patch('/:id', appointmentsController.update.bind(appointmentsController));

// POST /api/appointments/:id/cancel - Cancel appointment
router.post('/:id/cancel', appointmentsController.cancel.bind(appointmentsController));

// POST /api/appointments/:id/complete - Mark as completed (admin/employee only)
router.post('/:id/complete', appointmentsController.complete.bind(appointmentsController));

export { router as appointmentsRoutes };
