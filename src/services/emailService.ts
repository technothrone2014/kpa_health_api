import https from 'https';

// Brevo API Configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'technothrone2014@gmail.com';
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'KPA EAP Health Week';

console.log('📧 Email API configuration:', {
  hasApiKey: !!BREVO_API_KEY,
  fromEmail: BREVO_FROM_EMAIL,
  fromName: BREVO_FROM_NAME,
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
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0B2F9E, #1A4D8C); padding: 30px 20px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">⚓</div>
          <h1 style="color: #FFD700; margin: 0; font-size: 28px;">KPA Health Intelligence</h1>
          <p style="color: #A8E6CF; margin: 10px 0 0 0;">EAP Health Week Portal</p>
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

// Send OTP email using Brevo API
export const sendEmailOTP = async (
  toEmail: string, 
  otp: string, 
  userName?: string
): Promise<boolean> => {
  if (!BREVO_API_KEY) {
    console.error('❌ BREVO_API_KEY not configured');
    return false;
  }

  console.log(`📧 Sending OTP to ${toEmail} via Brevo API...`);

  const postData = JSON.stringify({
    sender: {
      name: BREVO_FROM_NAME,
      email: BREVO_FROM_EMAIL
    },
    to: [{
      email: toEmail,
      name: userName || 'User'
    }],
    subject: '🔐 KPA Health - Your Verification Code',
    htmlContent: generateOTPEmailHTML(otp, userName),
    textContent: generateOTPEmailText(otp),
  });

  const options = {
    hostname: 'api.brevo.com',
    port: 443,
    path: '/v3/smtp/email',
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
    timeout: 30000,
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          console.log(`✅ OTP email sent successfully to ${toEmail}`);
          resolve(true);
        } else {
          console.error(`❌ API error ${res.statusCode}:`, responseData);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ API request failed:', error.message);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('❌ API request timeout');
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
};

// Diagnostic function to test email configuration
export const testEmailConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  if (!BREVO_API_KEY) {
    return {
      success: false,
      message: 'BREVO_API_KEY not configured',
    };
  }

  return {
    success: true,
    message: 'Email API configured successfully',
    details: {
      from: BREVO_FROM_EMAIL,
      name: BREVO_FROM_NAME,
    },
  };
};