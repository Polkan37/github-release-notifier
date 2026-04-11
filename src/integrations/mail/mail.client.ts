import nodemailer from 'nodemailer'

export class MailClient {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  async send(params: {
    to: string
    subject: string
    html: string
  }) {
    await this.transporter.sendMail({
      from: `"GitHub Notifier" <${process.env.SMTP_FROM}>`,
      ...params,
    })
  }
}