const nodemailer = require('nodemailer');

// REPLACE WITH YOUR BRAND NEW SMTP KEY
const NEW_SMTP_KEY = 'xsmtpsib-5db2281297d85a0b87a75f1f4d99d1d064e3dfcf20309790df7c8638f9732692-FM0pgxq4SL9Rz32c';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: 'a7dda2001@smtp-brevo.com',
    pass: NEW_SMTP_KEY,
  },
  tls: { rejectUnauthorized: false },
});

async function test() {
  console.log('Testing SMTP with new key...');
  console.log('User:', 'a7dda2001@smtp-brevo.com');
  console.log('Key:', NEW_SMTP_KEY.substring(0, 10) + '...');
  
  try {
    await transporter.verify();
    console.log('✅ SMTP authentication successful!');
    
    const info = await transporter.sendMail({
      from: '"KPA Health" <technothrone2014@gmail.com>',
      to: 'jayjchiringz@gmail.com',
      subject: 'SMTP Test',
      text: 'If you receive this, SMTP is working!',
    });
    console.log('✅ Email sent!', info.messageId);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    console.error('Code:', error.code);
  }
}

test();