// Users routes
const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');

async function handleUsers(req, res) {
  const path = req.path;
  const method = req.method;
  
  // Create a user
  if (path === '/users' && method === 'POST') {
    parseJsonBody(req, res, async data => {
      const { username, email, password } = data; 
      if (!username || !email || !password) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Username, email, and password are required.' }));
        return;
      }
      const password_hash = password; // In production, hash the password!
      try {
        const result = await pool.query(
          'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
          [username, email, password_hash]
        );
        res.writeHead(201);
        res.end(JSON.stringify(result.rows[0]));
      } catch(dbErr) {
        if (dbErr.code === '23505') { 
          res.writeHead(409); 
          res.end(JSON.stringify({ error: 'Username or email already exists.', detail: dbErr.detail }));
        } else {
          console.error('DB Error on POST /users:', dbErr);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Database error creating user.' }));
        }
      }
    });
    return true;
  }
  
  // List all users
  if (path === '/users' && method === 'GET') {
    const result = await pool.query('SELECT id, username, email, created_at FROM users ORDER BY id ASC');
    res.writeHead(200);
    res.end(JSON.stringify(result.rows));
    return true;
  }
  
  // List all users as JSON API
  if (path === '/api/users' && method === 'GET') {
    const result = await pool.query('SELECT id, username, email, created_at FROM users ORDER BY id ASC');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.rows));
    return true;
  }
  
  // Get a single user
  if (path.startsWith('/users/') && method === 'GET') {
    const id = parseInt(path.split('/')[2]);
    if (isNaN(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid user ID format.' }));
      return true;
    }
    const result = await pool.query('SELECT id, username, email, created_at FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'User not found.' }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify(result.rows[0]));
    }
    return true;
  }
  
  return false; // Not handled
}

module.exports = { handleUsers };
