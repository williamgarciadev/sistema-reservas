/**
 * Sistema de Reservas - Backend
 * Express server with JWT auth, Prisma ORM, and Redis cache
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authRoutes } from './routes/auth.routes.js';
import { servicesRoutes } from './routes/services.routes.js';
import { employeesRoutes } from './routes/employees.routes.js';
import { appointmentsRoutes } from './routes/appointments.routes.js';
import { notificationsRoutes } from './routes/notifications.routes.js';
import { scheduledNotificationsJob } from './jobs/scheduled-notifications.job.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEDIDO',
      message: 'Demasiadas solicitudes. Intente nuevamente en 15 minutos.'
    }
  }
});
app.use('/api/', limiter);

// Logging
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/notifications', notificationsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'RECURSO_NO_ENCONTRADO',
      message: `Ruta ${req.method} ${req.path} no encontrada`
    }
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start scheduled notifications job
scheduledNotificationsJob.start();

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🔗 Frontend URL: ${config.frontendUrl}`);
  console.log(`📧 Scheduled notifications job started (runs every hour)`);
});

export default app;
