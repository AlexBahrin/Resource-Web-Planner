// Login script to get a session ID
const http = require('http');
const querystring = require('querystring');

// Configuration
const HOST = 'localhost';
const PORT = 8087;
const USERNAME = process.argv[2] || 'aa';
const PASSWORD = process.argv[3] || 'aa';

if (!USERNAME || !PASSWORD) {
  console.error('Please provide username and password as command line arguments:');
  console.error('Usage: node login.js <username> <password>');
  process.exit(1);
}

// Function to extract session ID from cookie string
function extractSessionId(cookieString) {
  const match = cookieString.match(/sessionId=([^;]+)/);
  if (match) {
    return match[1];
  }
  return null;
}

// Function to login and get session ID
function login() {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      'username': USERNAME,
      'password': PASSWORD
    });

    console.log(`Attempting to log in as ${USERNAME}...`);

    const options = {
      hostname: HOST,
      port: PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      
      // Check if we have cookies
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        console.log('Cookies received:', cookies);
        
        // Try to extract sessionId
        const sessionId = extractSessionId(cookies.join('; '));
        if (sessionId) {
          console.log('\n===== SESSION ID =====');
          console.log(sessionId);
          console.log('=====================');
          console.log('\nUse this session ID with the test script:');
          console.log(`node test-import-export.js ${sessionId}`);
          resolve(sessionId);
        } else {
          reject(new Error('No sessionId found in cookies'));
        }
      } else {
        reject(new Error('No cookies in response'));
      }
      
      // Consume response body
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        if (body.includes('Invalid username or password')) {
          reject(new Error('Login failed: Invalid username or password'));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`Request error: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// Run login
login()
  .then(sessionId => {
    const fs = require('fs');
    fs.writeFileSync('session.txt', sessionId);
    console.log('Session ID saved to session.txt');
  })
  .catch(error => {
    console.error('Login failed:', error.message);
    process.exit(1);
  });
