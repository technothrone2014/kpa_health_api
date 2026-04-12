import nodemailer from 'nodemailer';

// Brevo SMTP Configuration - Read from environment variables
const BREVO_SMTP_HOST = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
const BREVO_SMTP_PORT = parseInt(process.env.BREVO_SMTP_PORT || '587');  // Changed to 587 default
const BREVO_SMTP_SECURE = process.env.BREVO_SMTP_SECURE === 'true';
const BREVO_SMTP_USER = process.env.BREVO_SMTP_USER;
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL;
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'KPA Health Intelligence';

console.log('📧 Email configuration:', {
  host: BREVO_SMTP_HOST,
  port: BREVO_SMTP_PORT,
  user: BREVO_SMTP_USER ? BREVO_SMTP_USER.substring(0, 10) + '...' : 'missing',
  hasPass: !!BREVO_SMTP_KEY,
  fromEmail: BREVO_FROM_EMAIL,
});

// Create transporter with settings from environment
const transporter = nodemailer.createTransport({
  host: BREVO_SMTP_HOST,
  port: BREVO_SMTP_PORT,
  secure: BREVO_SMTP_SECURE,
  auth: {
    user: BREVO_SMTP_USER,
    pass: BREVO_SMTP_KEY,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
  tls: {
    rejectUnauthorized: false,
  },
});

// HTML Email Template for OTP
const generateOTPEmailHTML = (otp: string, userName?: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KPA Health - Verification Code</title>
    </head>
    <body style="font-family: 'Verdana', Geneva, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; borderRadius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0B2F9E, #1A4D8C); padding: 30px 20px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">⚓</div>
          <h1 style="color: #FFD700; margin: 0; font-size: 28px;">KPA Health Intelligence</h1>
          <p style="color: #A8E6CF; margin: 10px 0 0 0; opacity: 0.9;">EAP Health Week Portal</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            ${userName ? `Dear ${userName},` : 'Dear User,'}
          </p>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 15px;">
            Your verification code for KPA Health Intelligence is:
          </p>
          
          <div style="background-color: #E8F0FE; padding: 25px; text-align: center; border-radius: 8px; margin: 25px 0; border: 2px dashed #0B2F9E;">
            <h2 style="font-size: 42px; letter-spacing: 8px; margin: 0; color: #0B2F9E; font-weight: bold;">${otp}</h2>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <p style="font-size: 14px; color: #856404; margin: 0;">
              <strong>⏰ Valid for 10 minutes only</strong><br>
              🔒 Never share this code with anyone
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            If you didn't request this code, please ignore this email.<br>
            &copy; ${new Date().getFullYear()} Kenya Ports Authority - EAP Health Week. All rights reserved.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #999; margin: 0;">
            Kenya Ports Authority - Secure Health Intelligence System
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Plain text version
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
  if (!BREVO_SMTP_USER || !BREVO_SMTP_KEY) {
    console.error('❌ BREVO_SMTP_USER or BREVO_SMTP_KEY missing from config');
    return false;
  }

  console.log(`📧 Attempting to send OTP to ${toEmail} using Brevo...`);

  const mailOptions = {
    from: `"${BREVO_FROM_NAME}" <${BREVO_FROM_EMAIL}>`,
    to: toEmail,
    subject: '🔐 KPA Health - Your Verification Code',
    text: generateOTPEmailText(otp),
    html: generateOTPEmailHTML(otp, userName),
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      'Importance': 'high',
    },
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ OTP Email Sent Successfully via Brevo:", {
      messageId: info.messageId,
      response: info.response,
      to: toEmail,
      accepted: info.accepted,
    });
    return true;
  } catch (error: any) {
    console.error("❌ Failed to send OTP email via Brevo:", {
      error: error.message,
      code: error.code,
      command: error.command,
      to: toEmail,
    });

    if (error.code === "EAUTH") {
      console.error("Email authentication failed - check BREVO_SMTP_USER and BREVO_SMTP_KEY");
    }
    
    return false;
  }
};

// Diagnostic function to test email configuration
export const testEmailConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
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
  } catch (error: any) {
    return {
      success: false,
      message: 'Email service verification failed',
      details: {
        error: error.message,
        code: error.code,
      },
    };
  }
};
