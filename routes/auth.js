// Auth routes (login, register)
const pool = require('../config/dbConfig');
const { parseFormData } = require('../util/requestUtils');
const templates = require('../views/templates');

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
        res.end('<h3>Username and password required.</h3>');
        return;
      }
      try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
          res.writeHead(401, { 'Content-Type': 'text/html' });
          res.end('<h3>Invalid username or password.</h3>');
          return;
        }
        const user = result.rows[0];
        // NOTE: In production, use hashed passwords!
        if (user.password_hash !== password) {
          res.writeHead(401, { 'Content-Type': 'text/html' });
          res.end('<h3>Invalid username or password.</h3>');
          return;
        }
        // Render dashboard with welcome message
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(templates.dashboardPage(user.username));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h3>Server error.</h3>');
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
        res.end('<h3>All fields are required.</h3>');
        return;
      }
      try {
        const result = await pool.query(
          'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING username',
          [username, email, password]
        );
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h3>Registration successful. <a href="/">Login here</a>.</h3>`);
      } catch (dbErr) {
        if (dbErr.code === '23505') {
          res.writeHead(409, { 'Content-Type': 'text/html' });
          res.end('<h3>Username or email already exists. <a href="/register">Try again</a>.</h3>');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h3>Server error.</h3>');
        }
      }
    });
    return;
  }
}

function handleDashboard(req, res) {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(templates.dashboardPage());
    return;
  }
}

module.exports = {
  handleLogin,
  handleRegister,
  handleDashboard
};
