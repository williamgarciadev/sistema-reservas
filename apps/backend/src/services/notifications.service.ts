import { Resend } from 'resend';
import { NotificationsRepository } from '../repositories/notifications.repository.js';
import { UsuarioRepository } from '../repositories/usuario.repository.js';
import { AppointmentsRepository } from '../repositories/appointments.repository.js';
import { config } from '../config/index.js';
import { Notificacion, TipoNotificacion } from '@prisma/client';

interface EmailTemplateData {
  clienteNombre: string;
  servicioNombre: string;
  empleadoNombre: string;
  fechaInicio: Date;
  duracion: number;
  appointmentId: string;
  frontendUrl: string;
}

export class NotificationsService {
  private resend: Resend;

  constructor(
    private notificationsRepo: NotificationsRepository,
    private usuarioRepo: UsuarioRepository,
    private appointmentsRepo: AppointmentsRepository
  ) {
    this.resend = new Resend(config.resendApiKey || 're_test_key');
  }

  /**
   * Create and send appointment confirmation notification
   */
  async sendAppointmentConfirmation(
    citaId: string,
    clienteId: string
  ): Promise<Notificacion> {
    const cita = await this.appointmentsRepo.findByIdWithRelations(citaId);
    if (!cita) {
      throw new Error('Cita no encontrada');
    }

    const cliente = await this.usuarioRepo.findById(clienteId);
    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    // Create notification
    const notification = await this.notificationsRepo.create({
      usuarioId: clienteId,
      tipo: 'CITA_CONFIRMADA',
      titulo: 'Cita confirmada',
      mensaje: `Tu cita de ${cita.servicio.nombre} ha sido confirmada para el ${this.formatDate(cita.fechaInicio)} a las ${this.formatTime(cita.fechaInicio)}.`,
      citaId,
      metadata: {
        appointmentId: citaId,
        appointmentDate: cita.fechaInicio.toISOString(),
      },
    });

    // Send email
    try {
      await this.sendEmail({
        to: cliente.email,
        subject: `Confirmación de cita - ${this.formatDate(cita.fechaInicio)}`,
        template: 'appointment-confirmation',
        data: {
          clienteNombre: cliente.nombre,
          servicioNombre: cita.servicio.nombre,
          empleadoNombre: cita.empleado.nombre,
          fechaInicio: cita.fechaInicio,
          duracion: cita.servicio.duracion,
          appointmentId: citaId,
          frontendUrl: config.frontendUrl,
        },
      });

      await this.notificationsRepo.markEmailAsSent(notification.id);
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      // Don't throw - notification was created, email failure is logged
    }

    return notification;
  }

  /**
   * Send appointment reminder (24h before)
   */
  async sendAppointmentReminder(
    notification: Notificacion & {
      cita: {
        id: string;
        fechaInicio: Date;
        servicio: { nombre: string; duracion: number };
        empleado: { nombre: string };
      };
    }
  ): Promise<void> {
    const usuario = await this.usuarioRepo.findById(notification.usuarioId);
    if (!usuario) {
      console.error('Usuario no encontrado para recordatorio:', notification.usuarioId);
      return;
    }

    const cita = notification.cita;

    try {
      await this.sendEmail({
        to: usuario.email,
        subject: `Recordatorio: Tu cita es mañana`,
        template: 'appointment-reminder',
        data: {
          clienteNombre: usuario.nombre,
          servicioNombre: cita.servicio.nombre,
          empleadoNombre: cita.empleado.nombre,
          fechaInicio: cita.fechaInicio,
          duracion: cita.servicio.duracion,
          appointmentId: cita.id,
          frontendUrl: config.frontendUrl,
        },
      });

      await this.notificationsRepo.markEmailAsSent(notification.id);
    } catch (error) {
      console.error('Error sending reminder email:', error);
    }
  }

  /**
   * Send appointment cancellation notification
   */
  async sendAppointmentCancellation(
    citaId: string,
    clienteId: string,
    motivo?: string
  ): Promise<Notificacion> {
    const cita = await this.appointmentsRepo.findByIdWithRelations(citaId);
    const cliente = await this.usuarioRepo.findById(clienteId);

    if (!cita || !cliente) {
      throw new Error('Cita o cliente no encontrado');
    }

    const notification = await this.notificationsRepo.create({
      usuarioId: clienteId,
      tipo: 'CITA_CANCELADA',
      titulo: 'Cita cancelada',
      mensaje: `Tu cita de ${cita.servicio.nombre} programada para el ${this.formatDate(cita.fechaInicio)} ha sido cancelada.${motivo ? ` Motivo: ${motivo}` : ''}`,
      citaId,
      metadata: {
        appointmentId: citaId,
        motivo,
      },
    });

    try {
      await this.sendEmail({
        to: cliente.email,
        subject: 'Cancelación de cita',
        template: 'appointment-cancellation',
        data: {
          clienteNombre: cliente.nombre,
          servicioNombre: cita.servicio.nombre,
          fechaInicio: cita.fechaInicio,
          appointmentId: citaId,
          frontendUrl: config.frontendUrl,
          motivo,
        },
      });

      await this.notificationsRepo.markEmailAsSent(notification.id);
    } catch (error) {
      console.error('Error sending cancellation email:', error);
    }

    return notification;
  }

  /**
   * Send test email (for admin)
   */
  async sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.sendEmail({
        to,
        subject: 'Test Email - Sistema de Reservas',
        template: 'test',
        data: {
          testDate: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: 'Email de prueba enviado exitosamente',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al enviar email de prueba',
      };
    }
  }

  /**
   * Send promotional notification
   */
  async sendPromotionalNotification(
    usuarioId: string,
    titulo: string,
    mensaje: string,
    metadata?: Record<string, any>
  ): Promise<Notificacion> {
    const notification = await this.notificationsRepo.create({
      usuarioId,
      tipo: 'PROMO',
      titulo,
      mensaje,
      metadata,
    });

    // Optionally send email for promotions
    const usuario = await this.usuarioRepo.findById(usuarioId);
    if (usuario && metadata?.sendEmail) {
      try {
        await this.sendEmail({
          to: usuario.email,
          subject: titulo,
          template: 'promotional',
          data: {
            clienteNombre: usuario.nombre,
            titulo,
            mensaje,
            ctaUrl: metadata?.ctaUrl || config.frontendUrl,
            ctaText: metadata?.ctaText || 'Ver más',
          },
        });
        await this.notificationsRepo.markEmailAsSent(notification.id);
      } catch (error) {
        console.error('Error sending promotional email:', error);
      }
    }

    return notification;
  }

  /**
   * Helper: Send email using Resend
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    template: string;
    data: any;
  }): Promise<void> {
    if (!config.resendApiKey) {
      console.warn('RESEND_API_KEY not configured, skipping email send');
      return;
    }

    const html = this.renderEmailTemplate(options.template, options.data);

    await this.resend.emails.send({
      from: 'Sistema de Reservas <noreply@resend.dev>',
      to: options.to,
      subject: options.subject,
      html,
    });
  }

  /**
   * Render email template based on type
   */
  private renderEmailTemplate(template: string, data: any): string {
    switch (template) {
      case 'appointment-confirmation':
        return this.renderAppointmentConfirmation(data);
      case 'appointment-reminder':
        return this.renderAppointmentReminder(data);
      case 'appointment-cancellation':
        return this.renderAppointmentCancellation(data);
      case 'promotional':
        return this.renderPromotional(data);
      case 'test':
        return this.renderTestEmail(data);
      default:
        return `<p>${data.mensaje || 'Notificación del sistema'}</p>`;
    }
  }

  /**
   * Email Template: Appointment Confirmation
   */
  private renderAppointmentConfirmation(data: EmailTemplateData): string {
    const viewUrl = `${data.frontendUrl}/citas/${data.appointmentId}`;
    const cancelUrl = `${data.frontendUrl}/citas/${data.appointmentId}/cancelar`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Cita</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #4f46e5; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">¡Cita Confirmada! ✓</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hola ${data.clienteNombre},</p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px;">Tu cita ha sido confirmada exitosamente.</p>
              
              <table role="presentation" style="width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #6b7280; font-size: 14px;">Servicio</strong>
                    <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px;">${data.servicioNombre}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #6b7280; font-size: 14px;">Profesional</strong>
                    <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px;">${data.empleadoNombre}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #6b7280; font-size: 14px;">Fecha y Hora</strong>
                    <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px;">${this.formatDate(data.fechaInicio)} a las ${this.formatTime(data.fechaInicio)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px;">
                    <strong style="color: #6b7280; font-size: 14px;">Duración</strong>
                    <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px;">${data.duracion} minutos</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${viewUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600;">Ver Cita</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">¿Necesitas cancelar?</p>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                <a href="${cancelUrl}" style="color: #ef4444; text-decoration: none;">Cancelar cita</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; color: #9ca3af; font-size: 14px;">
              <p style="margin: 0;">Gracias por confiar en nosotros</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Email Template: Appointment Reminder
   */
  private renderAppointmentReminder(data: EmailTemplateData): string {
    const rescheduleUrl = `${data.frontendUrl}/citas/${data.appointmentId}/reagendar`;
    const cancelUrl = `${data.frontendUrl}/citas/${data.appointmentId}/cancelar`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de Cita</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #f59e0b; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">⏰ Recordatorio de Cita</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hola ${data.clienteNombre},</p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px;">Te recordamos que tienes una cita programada para mañana.</p>
              
              <table role="presentation" style="width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #6b7280; font-size: 14px;">Servicio</strong>
                    <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px;">${data.servicioNombre}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #6b7280; font-size: 14px;">Fecha y Hora</strong>
                    <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px;">${this.formatDate(data.fechaInicio)} a las ${this.formatTime(data.fechaInicio)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px;">
                    <strong style="color: #6b7280; font-size: 14px;">Profesional</strong>
                    <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px;">${data.empleadoNombre}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td style="text-align: center; padding: 8px;">
                    <a href="${rescheduleUrl}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">Reagendar</a>
                  </td>
                  <td style="text-align: center; padding: 8px;">
                    <a href="${cancelUrl}" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">Cancelar</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                ¿Te surgió un imprevisto? Puedes reagendar o cancelar tu cita usando los botones de arriba.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; color: #9ca3af; font-size: 14px;">
              <p style="margin: 0;">¡Te esperamos!</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Email Template: Appointment Cancellation
   */
  private renderAppointmentCancellation(data: EmailTemplateData & { motivo?: string }): string {
    const newBookingUrl = `${data.frontendUrl}/booking`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cita Cancelada</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #ef4444; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Cita Cancelada</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hola ${data.clienteNombre},</p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px;">Tu cita ha sido cancelada.</p>
              
              <table role="presentation" style="width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #6b7280; font-size: 14px;">Servicio</strong>
                    <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px;">${data.servicioNombre}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px;">
                    <strong style="color: #6b7280; font-size: 14px;">Fecha Programada</strong>
                    <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px;">${this.formatDate(data.fechaInicio)}</p>
                  </td>
                </tr>
              </table>

              ${data.motivo ? `
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                  <strong>Motivo:</strong> ${data.motivo}
                </p>
              </div>
              ` : ''}

              <table role="presentation" style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${newBookingUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600;">Reservar Nueva Cita</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                Esperamos verte pronto.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; color: #9ca3af; font-size: 14px;">
              <p style="margin: 0;">Gracias por confiar en nosotros</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Email Template: Promotional
   */
  private renderPromotional(data: { clienteNombre: string; titulo: string; mensaje: string; ctaUrl: string; ctaText: string }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">${data.titulo}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">Hola ${data.clienteNombre},</p>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px;">${data.mensaje}</p>

              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${data.ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600;">${data.ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; color: #9ca3af; font-size: 14px;">
              <p style="margin: 0;">Si no deseas recibir más promociones, puedes darte de baja en cualquier momento.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Email Template: Test
   */
  private renderTestEmail(data: { testDate: string }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: sans-serif; padding: 20px;">
  <h1>✓ Email de Prueba</h1>
  <p>Este es un email de prueba del Sistema de Reservas.</p>
  <p><strong>Fecha:</strong> ${new Date(data.testDate).toLocaleString('es-ES')}</p>
  <p>Si recibiste este email, la configuración de Resend es correcta.</p>
</body>
</html>
    `.trim();
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
