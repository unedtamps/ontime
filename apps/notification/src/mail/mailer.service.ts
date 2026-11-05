import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;
  private from = 'Ontime <no-reply@ontime.local>';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.from = this.config.get<string>('MAIL_FROM') ?? 'Ontime <no-reply@ontime.local>';
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? 'localhost',
      port: Number(this.config.get<string>('SMTP_PORT') ?? '1025'),
      ignoreTLS: true,
    });
    this.logger.log(
      `SMTP transport ready for ${this.config.get<string>('SMTP_HOST') ?? 'localhost'}:${this.config.get<string>('SMTP_PORT') ?? '1025'}`,
    );
  }

  async send(to: string, subject: string, text: string, attachment?: Attachment) {
    if (!this.transporter) throw new Error('Mailer not initialized');
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        attachments: attachment ? [attachment] : undefined,
      });
      this.logger.log(`Email sent to ${to}: ${subject} (${info.messageId})`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${String(error)}`);
    }
  }
}
