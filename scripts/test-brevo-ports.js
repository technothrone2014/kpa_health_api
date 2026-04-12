const nodemailer = require('nodemailer');

const SMTP_KEY = 'xsmtpsib-5db2281297d85a0b87a75f1f4d99d1d064e3dfcf20309790df7c8638f9732692-FM0pgxq4SL9Rz32c';
const SMTP_USER = 'a7dda2001@smtp-brevo.com';

const ports = [
  { port: 587, secure: false, name: 'Port 587 (STARTTLS)' },
  { port: 2525, secure: false, name: 'Port 2525 (STARTTLS)' },
  { port: 465, secure: true, name: 'Port 465 (SSL)' },
];

async function testPort(port, secure, name) {
  console.log(`\n📧 Testing ${name}...`);
  
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: port,
    secure: secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_KEY,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
  });

  try {
    await transporter.verify();
    console.log(`   ✅ SUCCESS! Port ${port} works!`);
    
    // Try sending a test email
    const info = await transporter.sendMail({
      from: '"KPA Health Test" <technothrone2014@gmail.com>',
      to: 'jayjchiringz@gmail.com',
      subject: `SMTP Test - Port ${port}`,
      text: `This email was sent using port ${port}.`,
    });
    console.log(`   ✅ Email sent via port ${port}!`);
    return true;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing Brevo SMTP ports from Render environment...\n');
  
  let workingPort = null;
  for (const { port, secure, name } of ports) {
    const success = await testPort(port, secure, name);
    if (success && !workingPort) {
      workingPort = { port, secure };
    }
  }
  
  if (workingPort) {
    console.log(`\n✅ Working configuration found! Use port ${workingPort.port}`);
    console.log(`\nUpdate your Render environment variables:`);
    console.log(`BREVO_SMTP_PORT=${workingPort.port}`);
    console.log(`BREVO_SMTP_SECURE=${workingPort.secure}`);
  } else {
    console.log('\n❌ No working port found. Check your network/firewall settings.');
  }
}

main();