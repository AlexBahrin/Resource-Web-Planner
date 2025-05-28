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
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(templates.loginPage);
    return;
  }
  
  if (req.method === 'POST') {
    parseFormData(req, async (params) => {
      const { username, password } = params;
      if (!username || !password) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h3>Username and password required. <a href="/">Try again</a>.</h3>');
        return;
      }
      try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
          res.writeHead(401, { 'Content-Type': 'text/html' });
          res.end('<h3>Invalid username or password. <a href="/">Try again</a>.</h3>');
          return;
        }
        const user = result.rows[0];

        const passwordMatch = bcrypt.compareSync(password, user.password_hash);
        if (!passwordMatch) { 
          res.writeHead(401, { 'Content-Type': 'text/html' });
          res.end('<h3>Invalid username or password. <a href="/">Try again</a>.</h3>');
          return;
        }

        const sessionId = generateSessionId();
        sessions[sessionId] = { userId: user.id, username: user.username, role: user.role, expires: Date.now() + 24 * 60 * 60 * 1000 }; 

        res.writeHead(302, { 
          'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=${24 * 60 * 60}`,
          'Location': '/main' 
        });
        res.end();
      } catch (err) {
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
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h3>Server error during registration. <a href="/register">Try again</a>.</h3>');
        }
      }
    });
    return;
  }
}

function authenticateToken(req, res, next) {
    const cookies = req.headers.cookie;
    if (!cookies) {
        if (req.url.startsWith('/api/')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Authentication required: No cookies provided.' }));
            return; 
        }
        res.writeHead(302, { 'Location': '/' }); 
        res.end();
        return; 
    }

    const sessionIdCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('sessionId='));
    if (!sessionIdCookie) {
        if (req.url.startsWith('/api/')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Authentication required: Session ID not found in cookies.' }));
            return; 
        }
        res.writeHead(302, { 'Location': '/' });
        res.end();
        return; 
    }

    const sessionId = sessionIdCookie.split('=')[1];
    const session = sessions[sessionId];

    if (session && session.expires > Date.now()) {
        req.user = { id: session.userId, username: session.username, role: session.role }; 
        next(); 
    } else {
        if (session) { 
            delete sessions[sessionId]; 
        } 
        if (req.url.startsWith('/api/')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Authentication failed: Invalid or expired session.' }));
            return; 
        }
        res.writeHead(302, { 'Location': '/' }); 
        res.end();
        return; 
    }
}

function authorizeRole(roles) {
    return (req, res, next) => {
        if (!req.user || !req.user.id) { 
             if (req.url.startsWith('/api/')) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Authentication required to check roles.' }));
                return; 
            }
            res.writeHead(302, { 'Location': '/' });
            res.end();
            return; 
        }
        
        if (req.user.role && roles.includes(req.user.role)) {
           next(); 
        } else {
           if (req.url.startsWith('/api/')) {
               res.writeHead(403, { 'Content-Type': 'application/json' });
               res.end(JSON.stringify({ message: 'Forbidden: Insufficient permissions.' }));
               return; 
           }
           res.writeHead(403, { 'Content-Type': 'text/html' });
           res.end('<h3>Forbidden: You do not have the necessary permissions.</h3>');
           return; 
        }
    };
}

function handleDashboard(req, res) {
  const filePath = path.join(__dirname, '..', 'views', 'html', 'dashboard.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
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
      delete sessions[sessionId]; 
    }
  }
  res.writeHead(302, {
    'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0',
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
