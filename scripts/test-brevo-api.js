const https = require('https');

const API_KEY = 'xkeysib-5db2281297d85a0b87a75f1f4d99d1d064e3dfcf20309790df7c8638f9732692-FM0pgxq4SL9R32c';

const data = JSON.stringify({
  sender: { email: 'technothrone2014@gmail.com', name: 'KPA Health' },
  to: [{ email: 'jayjchiringz@gmail.com' }],
  subject: 'Brevo API Test',
  htmlContent: '<html><body><h1>Test</h1><p>If you receive this, API works!</p></body></html>',
});

const options = {
  hostname: 'api.brevo.com',
  port: 443,
  path: '/v3/smtp/email',
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'api-key': API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(data);
req.end();