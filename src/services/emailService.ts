import nodemailer from 'nodemailer';

class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendFeedbackEmail(userEmail: string | undefined, content: string, rating: number, type: string) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️ Email credentials not found. Skipping email notification.');
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'danielmeduoye@gmail.com', // Target email
      subject: `New Feedback Received: ${type} (${rating}/5)`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4f46e5;">New Feedback Submission</h2>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
            <p><strong>User:</strong> ${userEmail || 'Anonymous'}</p>
            <p><strong>Rating:</strong> ${rating}/5 ⭐</p>
            <p><strong>Type:</strong> ${type}</p>
            <hr style="border: 1px solid #e5e7eb; margin: 15px 0;">
            <p style="font-size: 16px; line-height: 1.5;">${content}</p>
          </div>
          <p style="font-size: 12px; color: #888; margin-top: 20px;">Sent from AUDIT AI System</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Feedback email sent successfully to danielmeduoye@gmail.com');
    } catch (error) {
      console.error('❌ Failed to send feedback email:', error);
    }
  }
}

export default new EmailService();
