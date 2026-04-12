import nodemailer from 'nodemailer';

// Brevo SMTP Configuration
const BREVO_SMTP_HOST = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
const BREVO_SMTP_PORT = parseInt(process.env.BREVO_SMTP_PORT || '587');
const BREVO_SMTP_SECURE = process.env.BREVO_SMTP_SECURE === 'true';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL;
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'KPA Health Intelligence';

// Create Brevo SMTP transporter
let transporter: nodemailer.Transporter | null = null;

// Initialize transporter if credentials are available
if (BREVO_API_KEY) {
  transporter = nodemailer.createTransport({
    host: BREVO_SMTP_HOST,
    port: BREVO_SMTP_PORT,
    secure: BREVO_SMTP_SECURE,
    auth: {
      user: BREVO_FROM_EMAIL,
      pass: BREVO_API_KEY,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
  
  console.log(`📧 Email service configured: ${BREVO_SMTP_HOST}:${BREVO_SMTP_PORT}`);
} else {
  console.warn('⚠️ BREVO_API_KEY not set. Email services will be disabled.');
}

// HTML Email Template for OTP
const generateOTPEmailHTML = (otp: string, userName?: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KPA Health - Verification Code</title>
      <style>
        body {
          font-family: 'Verdana', Geneva, sans-serif;
          background-color: #f5f7fa;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: linear-gradient(135deg, #0B2F9E, #1A4D8C);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
        }
        .header {
          padding: 30px;
          text-align: center;
          border-bottom: 2px solid #FFD700;
        }
        .logo {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .title {
          color: #FFD700;
          font-size: 24px;
          font-weight: bold;
          margin: 0;
        }
        .subtitle {
          color: #A8E6CF;
          font-size: 14px;
          margin-top: 5px;
        }
        .content {
          padding: 40px 30px;
          background: white;
        }
        .greeting {
          font-size: 18px;
          color: #0B2F9E;
          margin-bottom: 20px;
        }
        .message {
          color: #333;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .otp-code {
          background: #E8F0FE;
          padding: 25px;
          text-align: center;
          border-radius: 12px;
          margin: 20px 0;
        }
        .code {
          font-size: 42px;
          font-weight: bold;
          color: #0B2F9E;
          letter-spacing: 8px;
          font-family: monospace;
        }
        .expiry {
          font-size: 12px;
          color: #888;
          text-align: center;
          margin-top: 15px;
        }
        .footer {
          background: #0A1C40;
          padding: 20px;
          text-align: center;
          color: #A8E6CF;
          font-size: 12px;
        }
        .button {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #0A1C40;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: bold;
        }
        .warning {
          font-size: 11px;
          color: #999;
          margin-top: 20px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">⚓</div>
          <h1 class="title">KPA Health Intelligence</h1>
          <p class="subtitle">EAP Health Week Portal</p>
        </div>
        <div class="content">
          <div class="greeting">
            ${userName ? `Dear ${userName},` : 'Dear User,'}
          </div>
          <div class="message">
            You have requested to access the KPA Health Intelligence Dashboard. 
            Please use the verification code below to complete your login.
          </div>
          <div class="otp-code">
            <p style="margin: 0 0 10px; color: #666;">Your verification code is:</p>
            <div class="code">${otp}</div>
          </div>
          <div class="expiry">
            ⏰ This code will expire in <strong>10 minutes</strong>
          </div>
          <div class="warning">
            🔒 If you didn't request this code, please ignore this email.<br>
            Never share this code with anyone. KPA Health will never ask for it.
          </div>
        </div>
        <div class="footer">
          <p>&copy; 2024 Kenya Ports Authority - EAP Health Week. All rights reserved.</p>
          <p style="margin-top: 5px;">Secure Health Intelligence System</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Plain text version for email clients that don't support HTML
const generateOTPEmailText = (otp: string): string => {
  return `
KPA Health Intelligence - Verification Code

Your verification code is: ${otp}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.
Never share this code with anyone.

---
Kenya Ports Authority - EAP Health Week
Secure Health Intelligence System
  `;
};

// Send OTP email using Brevo SMTP
export const sendEmailOTP = async (
  toEmail: string, 
  otp: string, 
  userName?: string
): Promise<boolean> => {
  if (!transporter) {
    console.error('❌ Email service not configured. BREVO_API_KEY is missing.');
    return false;
  }

  try {
    const mailOptions = {
      from: `"${BREVO_FROM_NAME}" <${BREVO_FROM_EMAIL}>`,
      to: toEmail,
      subject: '🔐 KPA Health - Your Verification Code',
      html: generateOTPEmailHTML(otp, userName),
      text: generateOTPEmailText(otp),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${toEmail}, Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send OTP email:', error);
    return false;
  }
};

// Generic email sender for other notifications
export const sendEmail = async (
  toEmail: string,
  subject: string,
  htmlContent: string,
  textContent?: string
): Promise<boolean> => {
  if (!transporter) {
    console.error('❌ Email service not configured. BREVO_API_KEY is missing.');
    return false;
  }

  try {
    const mailOptions = {
      from: `"${BREVO_FROM_NAME}" <${BREVO_FROM_EMAIL}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ''),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${toEmail}, Subject: ${subject}, Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return false;
  }
};

// Diagnostic function to test email configuration
export const testEmailConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  if (!transporter) {
    return {
      success: false,
      message: 'Email service not configured. BREVO_API_KEY is missing.',
    };
  }

  try {
    await transporter.verify();
    return {
      success: true,
      message: 'Email service configured successfully',
      details: {
        host: BREVO_SMTP_HOST,
        port: BREVO_SMTP_PORT,
        from: BREVO_FROM_EMAIL,
        name: BREVO_FROM_NAME,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Email service verification failed',
      details: error,
    };
  }
};

// Send welcome email to new users
export const sendWelcomeEmail = async (
  toEmail: string,
  userName: string,
  role: string
): Promise<boolean> => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Welcome to KPA Health Intelligence</title>
      <style>
        body { font-family: 'Verdana', Geneva, sans-serif; background-color: #f5f7fa; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0B2F9E, #1A4D8C); border-radius: 20px; overflow: hidden; }
        .header { padding: 30px; text-align: center; border-bottom: 2px solid #FFD700; }
        .logo { font-size: 48px; margin-bottom: 10px; }
        .title { color: #FFD700; font-size: 24px; font-weight: bold; margin: 0; }
        .content { padding: 40px 30px; background: white; }
        .footer { background: #0A1C40; padding: 20px; text-align: center; color: #A8E6CF; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">⚓</div>
          <h1 class="title">Welcome to KPA Health Intelligence</h1>
        </div>
        <div class="content">
          <h2>Welcome, ${userName}!</h2>
          <p>Your account has been successfully created with the role: <strong>${role}</strong>.</p>
          <p>You can now log in to the KPA Health Intelligence Dashboard to access health data and analytics.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
        <div class="footer">
          <p>Kenya Ports Authority - EAP Health Week</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(toEmail, 'Welcome to KPA Health Intelligence', htmlContent);
};
