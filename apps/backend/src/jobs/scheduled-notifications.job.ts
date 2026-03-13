import { NotificationsRepository } from '../repositories/notifications.repository.js';
import { NotificationsService } from '../services/notifications.service.js';
import { UsuarioRepository } from '../repositories/usuario.repository.js';
import { AppointmentsRepository } from '../repositories/appointments.repository.js';
import { prisma } from '../lib/prisma.js';

/**
 * Scheduled Notifications Job
 * 
 * Runs every hour to:
 * 1. Send appointment reminders (24h before)
 * 2. Clean up old notifications
 */
export class ScheduledNotificationsJob {
  private notificationsRepo: NotificationsRepository;
  private notificationsService: NotificationsService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.notificationsRepo = new NotificationsRepository(prisma);
    const usuarioRepo = new UsuarioRepository(prisma);
    const appointmentsRepo = new AppointmentsRepository(prisma);
    this.notificationsService = new NotificationsService(
      this.notificationsRepo,
      usuarioRepo,
      appointmentsRepo
    );
  }

  /**
   * Start the scheduled job
   */
  start(): void {
    if (this.intervalId) {
      console.log('[ScheduledNotificationsJob] Already running');
      return;
    }

    console.log('[ScheduledNotificationsJob] Starting job (runs every hour)');
    
    // Run immediately on start
    this.run();

    // Then run every hour
    this.intervalId = setInterval(() => {
      this.run();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Stop the scheduled job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[ScheduledNotificationsJob] Stopped');
    }
  }

  /**
   * Execute the job
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      console.log('[ScheduledNotificationsJob] Job already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('[ScheduledNotificationsJob] Running job...');

      // 1. Send appointment reminders (24h before)
      await this.sendReminders();

      // 2. Clean up old notifications (optional, run less frequently)
      const hour = new Date().getHours();
      if (hour === 3) { // Run cleanup at 3 AM
        await this.cleanupOldNotifications();
      }

      const duration = Date.now() - startTime;
      console.log(`[ScheduledNotificationsJob] Completed in ${duration}ms`);
    } catch (error) {
      console.error('[ScheduledNotificationsJob] Error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Send appointment reminders for appointments 24h away
   */
  private async sendReminders(): Promise<void> {
    try {
      const reminders = await this.notificationsRepo.findAppointmentReminders();
      
      if (reminders.length === 0) {
        console.log('[ScheduledNotificationsJob] No reminders to send');
        return;
      }

      console.log(`[ScheduledNotificationsJob] Sending ${reminders.length} reminder(s)...`);

      let sentCount = 0;
      let failedCount = 0;

      for (const reminder of reminders) {
        try {
          await this.notificationsService.sendAppointmentReminder(reminder);
          sentCount++;
          console.log(`[ScheduledNotificationsJob] Reminder sent for appointment ${reminder.cita.id}`);
        } catch (error) {
          failedCount++;
          console.error(`[ScheduledNotificationsJob] Failed to send reminder for ${reminder.cita.id}:`, error);
        }
      }

      console.log(`[ScheduledNotificationsJob] Reminders: ${sentCount} sent, ${failedCount} failed`);
    } catch (error) {
      console.error('[ScheduledNotificationsJob] Error sending reminders:', error);
    }
  }

  /**
   * Clean up old notifications (older than 90 days)
   */
  private async cleanupOldNotifications(): Promise<void> {
    try {
      const deletedCount = await this.notificationsRepo.deleteOldNotifications(90);
      console.log(`[ScheduledNotificationsJob] Cleaned up ${deletedCount} old notifications`);
    } catch (error) {
      console.error('[ScheduledNotificationsJob] Error cleaning up notifications:', error);
    }
  }
}

// Export singleton instance
export const scheduledNotificationsJob = new ScheduledNotificationsJob();
