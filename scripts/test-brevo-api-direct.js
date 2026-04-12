const https = require('https');

// REPLACE WITH YOUR ACTUAL API KEY FROM BREVO DASHBOARD
const API_KEY = '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';

const postData = JSON.stringify({
  sender: {
    name: 'KPA Health Test',
    email: 'technothrone2014@gmail.com'
  },
  to: [{
    email: 'jayjchiringz@gmail.com',
    name: 'Test User'
  }],
  subject: 'Brevo API Test - KPA Health',
  htmlContent: '<html><body><h1>✅ API Test Successful!</h1><p>Your Brevo API key is working correctly.</p><p>Timestamp: ' + new Date().toISOString() + '</p></body></html>',
  textContent: 'API Test Successful! Your Brevo API key is working correctly.'
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
    'Content-Length': Buffer.byteLength(postData),
  },
  timeout: 30000,
};

console.log('📧 Testing Brevo API...');
console.log('API Key:', API_KEY.substring(0, 15) + '...');
console.log('Sending to: jayjchiringz@gmail.com');

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
    if (res.statusCode === 201 || res.statusCode === 200) {
      console.log('✅ API test SUCCESS! Email should arrive shortly.');
    } else {
      console.log('❌ API test FAILED. Check your API key.');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.on('timeout', () => {
  console.error('❌ Request timeout');
  req.destroy();
});

req.write(postData);
req.end();
