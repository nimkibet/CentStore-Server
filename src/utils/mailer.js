import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Fallback nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '2525'),
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  });
};

export const sendEmail = async ({ to, subject, html }) => {
  const fromEmail = process.env.MAIL_FROM || 'Cent Stores <noreply@centstores.co.ke>';

  // Fallback SMTP
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      html
    });
    console.log(`Email sent via SMTP to ${to}:`, info.messageId);
    return true;
  } catch (err) {
    console.error(`Email sending failed completely to ${to}:`, err.message);
    console.log('--- EMAIL DUMP ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body (HTML length): ${html.length}`);
    console.log('------------------');
    return false;
  }
};

export const sendAdminOfflineAlertEmail = async (reason) => {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'admin@centstores.co.ke';
  const html = `
    <h2>⚠️ Cent Stores Backend Alerts: System Offline</h2>
    <p>Your WhatsApp automation bot or system service encountered an issue and disconnected:</p>
    <p style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px;"><strong>${reason}</strong></p>
    <p>Time reported: ${new Date().toISOString()}</p>
  `;
  return sendEmail({ to: adminEmail, subject: '⚠️ System Alert: WhatsApp Bot Offline', html });
};

export const sendVerificationCodeEmail = async (email, code) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #111; text-align: center;">Verify Your Account</h2>
      <p>Hello,</p>
      <p>Thank you for registering at Cent Stores. Use the following 6-digit OTP (One-Time Password) to complete your verification. This code is valid for 10 minutes.</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 30px 0; color: #10b981;">
        ${code}
      </div>
      <p>If you did not request this verification, please ignore this email.</p>
      <br>
      <p>Regards,<br>The Cent Stores Engineering Team</p>
    </div>
  `;
  return sendEmail({ to: email, subject: 'Verify Your Email Address - Verification OTP', html });
};

export const sendOrderConfirmationEmail = async (email, order) => {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.title || item.name} (x${item.quantity})</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">KSh ${(item.price * item.quantity).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #111; text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 15px;">Order Confirmation</h2>
      <p>Thank you for your order! Your order has been registered and is being processed.</p>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
      <p><strong>Status:</strong> ${order.isPaid ? 'Paid' : 'Pending Payment'}</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f9f9f9;">
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Product</th>
            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <tr>
            <td style="padding: 10px; font-weight: bold;">Grand Total</td>
            <td style="padding: 10px; font-weight: bold; text-align: right;">KSh ${order.totalAmount.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      
      <p>We'll notify you once your order shipping status updates.</p>
      <p>Regards,<br>Cent Stores Customer Care</p>
    </div>
  `;
  return sendEmail({ to: email, subject: `Order Confirmation #${order._id.toString().slice(-6).toUpperCase()}`, html });
};
