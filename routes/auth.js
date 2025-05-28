const pool = require('../config/dbConfig');
const { parseFormData } = require('../util/requestUtils');
const templates = require('../views/templates');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const sessions = {}; 

function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function handleLogin(req, res) {
  if (req.method === 'GET') {
    console.log('GET /login - Serving login page');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(templates.loginPage);
    return;
  }
  
  if (req.method === 'POST') {
    console.log('POST /login - Attempting login');
    parseFormData(req, async (params) => {
      const { username, password } = params;
      console.log('Login attempt for username:', username);
      if (!username || !password) {
        console.log('Login failed: Username or password missing');
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h3>Username and password required. <a href="/">Try again</a>.</h3>');
        return;
      }
      try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
          console.log('Login failed: User not found -', username);
          res.writeHead(401, { 'Content-Type': 'text/html' });
          res.end('<h3>Invalid username or password. <a href="/">Try again</a>.</h3>');
          return;
        }
        const user = result.rows[0];
        console.log('User found:', user.username, 'ID:', user.id);

        const passwordMatch = bcrypt.compareSync(password, user.password_hash);
        if (!passwordMatch) { 
          console.log('Login failed: Password mismatch for user -', username);
          res.writeHead(401, { 'Content-Type': 'text/html' });
          res.end('<h3>Invalid username or password. <a href="/">Try again</a>.</h3>');
          return;
        }
        console.log('Password matched for user -', username);

        const sessionId = generateSessionId();
        sessions[sessionId] = { userId: user.id, username: user.username, role: user.role, expires: Date.now() + 24 * 60 * 60 * 1000 }; 
        console.log('Session created:', sessionId, 'for userId:', user.id, 'role:', user.role);
        console.log('Current sessions:', sessions);

        res.writeHead(302, { 
          'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=${24 * 60 * 60}`,
          'Location': '/main' 
        });
        console.log('Redirecting to /main for user -', username);
        res.end();
      } catch (err) {
        console.error('Login error for user', username, ':', err);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h3>Server error during login. <a href="/">Try again</a>.</h3>');
      }
    });
    return;
  }
}

function handleRegister(req, res) {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(templates.registerPage);
    return;
  }
  
  if (req.method === 'POST') {
    parseFormData(req, async (params) => {
      const { username, email, password } = params;
      if (!username || !email || !password) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h3>All fields are required. <a href="/register">Try again</a>.</h3>');
        return;
      }
      try {
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);
        
        const defaultRole = 'user';
        const result = await pool.query(
          'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username', 
          [username, email, hashedPassword, defaultRole] 
        );
        res.writeHead(201, { 'Content-Type': 'text/html' });
        res.end(`<h3>Registration successful for ${result.rows[0].username}. <a href="/">Login here</a>.</h3>`);
      } catch (dbErr) {
        if (dbErr.code === '23505') { 
          res.writeHead(409, { 'Content-Type': 'text/html' });
          res.end('<h3>Username or email already exists. <a href="/register">Try again</a>.</h3>');
        } else {
          console.error('Registration error:', dbErr);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h3>Server error during registration. <a href="/register">Try again</a>.</h3>');
        }
      }
    });
    return;
  }
}

// Middleware to authenticate token (session ID in this case)
function authenticateToken(req, res, next) {
    const cookies = req.headers.cookie;
    if (!cookies) {
        if (req.url.startsWith('/api/')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Authentication required: No cookies provided.' }));
            return; // Stop further processing
        }
        res.writeHead(302, { 'Location': '/' }); // Redirect to login page
        res.end();
        return; // Stop further processing
    }

    const sessionIdCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('sessionId='));
    if (!sessionIdCookie) {
        if (req.url.startsWith('/api/')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Authentication required: Session ID not found in cookies.' }));
            return; // Stop further processing
        }
        res.writeHead(302, { 'Location': '/' });
        res.end();
        return; // Stop further processing
    }

    const sessionId = sessionIdCookie.split('=')[1];
    const session = sessions[sessionId];

    if (session && session.expires > Date.now()) {
        req.user = { id: session.userId, username: session.username, role: session.role }; // Attach user info to request
        console.log(`User ${session.username} (ID: ${session.userId}, Role: ${session.role}) authenticated for ${req.method} ${req.url}`);
        next(); // Proceed to the next middleware or route handler
    } else {
        if (session) { // Session expired
            delete sessions[sessionId]; // Clean up expired session
            console.log('Session expired for sessionId:', sessionId);
        } else {
            console.log('Invalid sessionId:', sessionId);
        }
        if (req.url.startsWith('/api/')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Authentication failed: Invalid or expired session.' }));
            return; // Stop further processing
        }
        res.writeHead(302, { 'Location': '/' }); // Redirect to login
        res.end();
        return; // Stop further processing
    }
}

// Placeholder for authorizeRole middleware
function authorizeRole(roles) {
    return (req, res, next) => {
        // Ensure authenticateToken has run and set req.user
        if (!req.user || !req.user.id) { 
             if (req.url.startsWith('/api/')) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Authentication required to check roles.' }));
                return; // Stop further processing
            }
            res.writeHead(302, { 'Location': '/' });
            res.end();
            return; // Stop further processing
        }
        
        console.log(`User role check for: ${req.user.username}, Role: ${req.user.role}, Required roles: ${roles}`);
        if (req.user.role && roles.includes(req.user.role)) {
           next(); // User has one of the required roles
        } else {
           if (req.url.startsWith('/api/')) {
               res.writeHead(403, { 'Content-Type': 'application/json' });
               res.end(JSON.stringify({ message: 'Forbidden: Insufficient permissions.' }));
               return; // Stop further processing
           }
           res.writeHead(403, { 'Content-Type': 'text/html' });
           res.end('<h3>Forbidden: You do not have the necessary permissions.</h3>');
           return; // Stop further processing
        }
    };
}

function handleDashboard(req, res) {
  // Serves the main dashboard page after login
  const filePath = path.join(__dirname, '..', 'views', 'html', 'dashboard.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error('Error reading dashboard.html:', err);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h3>Error loading dashboard. Please try again later.</h3>');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
}

function handleLogout(req, res) {
  const cookies = req.headers.cookie;
  if (cookies) {
    const sessionIdCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('sessionId='));
    if (sessionIdCookie) {
      const sessionId = sessionIdCookie.split('=')[1];
      delete sessions[sessionId]; // Remove session from server
      console.log('User logged out, session deleted:', sessionId);
    }
  }
  // Clear the session cookie on the client side and redirect to login
  res.writeHead(302, {
    'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0', // Expire the cookie
    'Location': '/'
  });
  res.end();
}

module.exports = { 
  handleLogin, 
  handleRegister,
  handleDashboard,
  handleLogout,
  authenticateToken,
  authorizeRole,
  sessions
};
