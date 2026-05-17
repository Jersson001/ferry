import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.resend.com',
      port: parseInt(process.env.MAIL_PORT || '587', 10),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER || 'resend',
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }

  private get from() {
    return process.env.MAIL_FROM || 'Ferry <onboarding@resend.dev>';
  }

  // ── Email de bienvenida + verificación de cuenta ────────────────────────────
  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; margin:0; padding:20px;">
        <div style="max-width:520px; margin:0 auto; background:white; border-radius:20px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <!-- Header -->
          <div style="background:linear-gradient(135deg, #f97316 0%, #fb923c 100%); padding:40px 32px; text-align:center;">
            <h1 style="color:white; font-size:28px; font-weight:900; margin:0; letter-spacing:-0.5px;">🔩 Ferry</h1>
            <p style="color:rgba(255,255,255,0.85); margin:8px 0 0; font-size:14px;">Conectando ferreterías y constructores</p>
          </div>
          <!-- Body -->
          <div style="padding:36px 32px;">
            <h2 style="color:#1e293b; font-size:20px; font-weight:800; margin:0 0 8px;">¡Bienvenido, ${name}! 🎉</h2>
            <p style="color:#64748b; font-size:15px; line-height:1.6; margin:0 0 28px;">
              Tu cuenta en Ferry ha sido creada exitosamente. Solo necesitas verificar tu correo electrónico para comenzar a usar la plataforma.
            </p>
            <!-- CTA Button -->
            <a href="${verifyUrl}"
               style="display:block; background:linear-gradient(135deg, #f97316, #fb923c); color:white; text-align:center; padding:16px 24px; border-radius:14px; font-size:16px; font-weight:700; text-decoration:none; margin:0 0 24px;">
              ✅ Verificar mi cuenta
            </a>
            <p style="color:#94a3b8; font-size:13px; text-align:center; margin:0 0 8px;">
              O copia este enlace en tu navegador:
            </p>
            <p style="color:#f97316; font-size:12px; text-align:center; word-break:break-all; margin:0 0 28px;">
              ${verifyUrl}
            </p>
            <!-- Info box -->
            <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:16px; margin-bottom:8px;">
              <p style="color:#9a3412; font-size:13px; margin:0; line-height:1.5;">
                ⏰ Este enlace es válido por <strong>24 horas</strong>. Si no lo verificas, puedes solicitar uno nuevo desde la app.
              </p>
            </div>
          </div>
          <!-- Footer -->
          <div style="padding:20px 32px; background:#f8fafc; border-top:1px solid #f1f5f9; text-align:center;">
            <p style="color:#cbd5e1; font-size:12px; margin:0;">
              Si no creaste esta cuenta, puedes ignorar este correo.<br>
              © 2025 Ferry · Todos los derechos reservados
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send({
      to: email,
      subject: '✅ Verifica tu cuenta de Ferry',
      html,
    });
  }

  // ── Email de recuperación de contraseña ─────────────────────────────────────
  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; margin:0; padding:20px;">
        <div style="max-width:520px; margin:0 auto; background:white; border-radius:20px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <!-- Header -->
          <div style="background:linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding:40px 32px; text-align:center;">
            <h1 style="color:white; font-size:28px; font-weight:900; margin:0; letter-spacing:-0.5px;">🔩 Ferry</h1>
            <p style="color:rgba(255,255,255,0.85); margin:8px 0 0; font-size:14px;">Recuperación de contraseña</p>
          </div>
          <!-- Body -->
          <div style="padding:36px 32px;">
            <h2 style="color:#1e293b; font-size:20px; font-weight:800; margin:0 0 8px;">Hola, ${name} 👋</h2>
            <p style="color:#64748b; font-size:15px; line-height:1.6; margin:0 0 28px;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta de Ferry. Haz clic en el botón de abajo para crear una nueva contraseña.
            </p>
            <!-- CTA Button -->
            <a href="${resetUrl}"
               style="display:block; background:linear-gradient(135deg, #1e40af, #3b82f6); color:white; text-align:center; padding:16px 24px; border-radius:14px; font-size:16px; font-weight:700; text-decoration:none; margin:0 0 24px;">
              🔑 Restablecer contraseña
            </a>
            <p style="color:#94a3b8; font-size:13px; text-align:center; margin:0 0 8px;">
              O copia este enlace en tu navegador:
            </p>
            <p style="color:#3b82f6; font-size:12px; text-align:center; word-break:break-all; margin:0 0 28px;">
              ${resetUrl}
            </p>
            <!-- Warning box -->
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:16px;">
              <p style="color:#991b1b; font-size:13px; margin:0; line-height:1.5;">
                ⏰ Este enlace expira en <strong>1 hora</strong>. Si no solicitaste cambiar tu contraseña, puedes ignorar este correo de forma segura.
              </p>
            </div>
          </div>
          <!-- Footer -->
          <div style="padding:20px 32px; background:#f8fafc; border-top:1px solid #f1f5f9; text-align:center;">
            <p style="color:#cbd5e1; font-size:12px; margin:0;">
              Por seguridad, este enlace solo puede usarse una vez.<br>
              © 2025 Ferry · Todos los derechos reservados
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send({
      to: email,
      subject: '🔑 Restablece tu contraseña de Ferry',
      html,
    });
  }

  // ── Helper interno ───────────────────────────────────────────────────────────
  private async send({ to, subject, html }: { to: string; subject: string; html: string }) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
      });
      this.logger.log(`Email enviado a ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Error enviando email a ${to}:`, error);
      // No lanzamos el error para no bloquear el flujo principal
      // El usuario puede solicitar reenvío
    }
  }
}
