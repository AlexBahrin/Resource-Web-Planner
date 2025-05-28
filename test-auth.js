// Simple authentication test
const http = require('http');
const querystring = require('querystring');

// Configuration
const HOST = 'localhost';
const PORT = 8087;
const USERNAME = 'aa'; // Replace with your actual username
const PASSWORD = 'aa'; // Replace with your actual password

// Function to login and get session cookie
function login() {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      'username': USERNAME,
      'password': PASSWORD
    });

    const options = {
      hostname: HOST,
      port: PORT,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      
      // Check if we have a session cookie
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        console.log('Got cookies:', cookies);
        resolve(cookies);
      } else {
        reject(new Error('No session cookie received'));
      }
      
      // Consume response body
      res.on('data', () => {});
    });

    req.on('error', (e) => {
      console.error(`Login request failed: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// Main function
async function testAuth() {
  try {
    const cookies = await login();
    console.log('Login successful!');
    console.log('Session cookies:', cookies);
  } catch (error) {
    console.error('Authentication test failed:', error);
  }
}

// Run the test
testAuth();
