const pool = require('../config/dbConfig');
const { parseFormData } = require('../util/requestUtils');
const templates = require('../views/templates');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

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
        sessions[sessionId] = { userId: user.id, username: user.username, expires: Date.now() + 24 * 60 * 60 * 1000 }; 
        console.log('Session created:', sessionId, 'for userId:', user.id);
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
        
        const result = await pool.query(
          'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username', 
          [username, email, hashedPassword] 
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

function handleDashboard(req, res) {
  
  if (req.userId && req.username) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(templates.dashboardPage(req.username));
  } else {
    
    res.writeHead(302, { 'Location': '/' });
    res.end();
  }
}

function handleLogout(req, res) {
  const cookies = req.headers.cookie;
  if (cookies) {
    const sessionIdCookie = cookies.split(';').find(c => c.trim().startsWith('sessionId='));
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
  sessions 
};
