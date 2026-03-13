import { Router } from 'express';
import { NotificationsController } from '../controllers/notifications.controller.js';
import { NotificationsRepository } from '../repositories/notifications.repository.js';
import { NotificationsService } from '../services/notifications.service.js';
import { UsuarioRepository } from '../repositories/usuario.repository.js';
import { AppointmentsRepository } from '../repositories/appointments.repository.js';
import { prisma } from '../lib/prisma.js';
import { authMiddleware as auth } from '../middleware/auth.js';

const router = Router();

// Initialize repositories and services
const notificationsRepo = new NotificationsRepository(prisma);
const usuarioRepo = new UsuarioRepository(prisma);
const appointmentsRepo = new AppointmentsRepository(prisma);
const notificationsService = new NotificationsService(notificationsRepo, usuarioRepo, appointmentsRepo);
const controller = new NotificationsController(notificationsRepo, notificationsService, usuarioRepo);

// Public routes (none for notifications - all require auth)

// Protected routes
router.use(auth); // All notification routes require authentication

// List notifications
router.get('/', (req, res, next) => controller.listNotifications(req, res, next));

// Get unread notifications
router.get('/unread', (req, res, next) => controller.listUnread(req, res, next));

// Get unread count
router.get('/unread/count', (req, res, next) => controller.getUnreadCount(req, res, next));

// Get notification by ID
router.get('/:id', (req, res, next) => controller.getNotification(req, res, next));

// Mark notification as read
router.patch('/:id', (req, res, next) => controller.markAsRead(req, res, next));

// Mark all as read
router.patch('/read-all', (req, res, next) => controller.markAllAsRead(req, res, next));

// Delete notification
router.delete('/:id', (req, res, next) => controller.deleteNotification(req, res, next));

// Admin routes
router.post('/test', (req, res, next) => controller.sendTestEmail(req, res, next));
router.post('/', (req, res, next) => controller.createNotification(req, res, next));

export { router as notificationsRoutes };
