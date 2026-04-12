import nodemailer from 'nodemailer';
import type { TransportOptions } from 'nodemailer';

// Brevo SMTP Configuration
const BREVO_SMTP_HOST = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
const BREVO_SMTP_PORT = parseInt(process.env.BREVO_SMTP_PORT || '587');
const BREVO_SMTP_SECURE = process.env.BREVO_SMTP_SECURE === 'true';
const BREVO_SMTP_USER = process.env.BREVO_SMTP_USER;
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL;
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'KPA Health Intelligence';

console.log('📧 SMTP Configuration:', {
  host: BREVO_SMTP_HOST,
  port: BREVO_SMTP_PORT,
  secure: BREVO_SMTP_SECURE,
  user: BREVO_SMTP_USER ? BREVO_SMTP_USER.substring(0, 10) + '...' : 'missing',
  hasKey: !!BREVO_SMTP_KEY,
  fromEmail: BREVO_FROM_EMAIL,
});

// Create transporter with proper typing
const transporter = nodemailer.createTransport({
  host: BREVO_SMTP_HOST,
  port: BREVO_SMTP_PORT,
  secure: BREVO_SMTP_SECURE,
  auth: {
    user: BREVO_SMTP_USER,
    pass: BREVO_SMTP_KEY,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  tls: {
    rejectUnauthorized: false,
  },
} as TransportOptions);

// HTML Email Template
const generateOTPEmailHTML = (otp: string, userName?: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>KPA Health - Verification Code</title>
    </head>
    <body style="font-family: 'Verdana', Geneva, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0B2F9E, #1A4D8C); border-radius: 20px; overflow: hidden;">
        <div style="padding: 30px; text-align: center;">
          <div style="font-size: 48px;">⚓</div>
          <h1 style="color: #FFD700;">KPA Health Intelligence</h1>
        </div>
        <div style="background: white; padding: 30px;">
          <p>Dear ${userName || 'User'},</p>
          <p>Your verification code is:</p>
          <div style="background: #E8F0FE; padding: 20px; text-align: center; border-radius: 10px;">
            <h2 style="font-size: 36px; letter-spacing: 5px; color: #0B2F9E;">${otp}</h2>
          </div>
          <p>This code expires in 10 minutes.</p>
          <hr>
          <p style="font-size: 12px; color: #666;">Kenya Ports Authority - EAP Health Week</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const generateOTPEmailText = (otp: string): string => {
  return `KPA Health - Verification Code: ${otp}. Valid for 10 minutes.`;
};

export const sendEmailOTP = async (
  toEmail: string,
  otp: string,
  userName?: string
): Promise<boolean> => {
  if (!BREVO_SMTP_USER || !BREVO_SMTP_KEY) {
    console.error('❌ SMTP credentials missing');
    return false;
  }

  console.log(`📧 Sending OTP to ${toEmail} via SMTP (port ${BREVO_SMTP_PORT})...`);

  const mailOptions = {
    from: `"${BREVO_FROM_NAME}" <${BREVO_FROM_EMAIL}>`,
    to: toEmail,
    subject: '🔐 KPA Health - Your Verification Code',
    text: generateOTPEmailText(otp),
    html: generateOTPEmailHTML(otp, userName),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${toEmail}, Message ID: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send email via port ${BREVO_SMTP_PORT}:`, error.message);
    return false;
  }
};

export const testEmailConnection = async (): Promise<any> => {
  try {
    await transporter.verify();
    return { success: true, message: 'SMTP configured correctly' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};
