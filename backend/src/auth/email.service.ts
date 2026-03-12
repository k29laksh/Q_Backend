import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('COMMON_SMTP_EMAIL_SMTP_HOST');
    const port = this.configService.get<number>('COMMON_SMTP_EMAIL_SMTP_PORT');
    const user = this.configService.get<string>('COMMON_SMTP_EMAIL_USERNAME');
    const pass = this.configService.get<string>('COMMON_SMTP_EMAIL_PASSWORD');

    this.logger.log(`SMTP config → host: ${host}, port: ${port}, user: ${user}`);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const from = this.configService.get<string>('COMMON_EMAIL_FROM');

    try {
      const info = await this.transporter.sendMail({
        from,
        to,
        subject: 'QistonPe - Your OTP Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Your OTP Code</h2>
            <p>Use the following code to verify your identity:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f4f4f4; border-radius: 8px; margin: 16px 0;">
              ${otp}
            </div>
            <p>This code expires in <strong>5 minutes</strong>.</p>
            <p style="color: #888; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(`OTP email sent to ${to} — messageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}`, error.stack);
      throw error;
    }
  }
}
