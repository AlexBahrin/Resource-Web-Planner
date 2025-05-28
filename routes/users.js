const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');

async function handleUsers(req, res) {
  const path = req.path;
  const method = req.method;
  const userId = req.userId; 

  if (path === '/api/users/me' && method === 'GET') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }
    try {
      const result = await pool.query('SELECT id, username, email, role, group_id FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found.' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows[0]));
      }
    } catch (dbErr) {
      console.error('DB Error on GET /api/users/me:', dbErr);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error fetching user details.' }));
    }
    return true;
  }

  if (path === '/api/users/me/join-group' && method === 'PUT') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }
    const data = await parseJsonBody(req, res);
    if (!data || typeof data.groupId !== 'number') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Group ID is required and must be a number.' }));
      return true;
    }
    try {
      const groupExists = await pool.query('SELECT id FROM groups WHERE id = $1', [data.groupId]);
      if (groupExists.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Group not found.' }));
        return true;
      }
      const result = await pool.query(
        'UPDATE users SET group_id = $1 WHERE id = $2 RETURNING id, username, group_id',
        [data.groupId, userId]
      );
      if (result.rowCount === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found or no update made.' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Successfully joined group.', user: result.rows[0] }));
      }
    } catch (dbErr) {
      console.error('DB Error on PUT /api/users/me/join-group:', dbErr);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error joining group.' }));
    }
    return true;
  }

  if (path === '/api/users/me/exit-group' && method === 'PUT') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }
    try {
      const result = await pool.query(
        'UPDATE users SET group_id = NULL WHERE id = $1 RETURNING id, username, group_id',
        [userId]
      );
      if (result.rowCount === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found or already not in a group.' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Successfully exited group.', user: result.rows[0] }));
      }
    } catch (dbErr) {
      console.error('DB Error on PUT /api/users/me/exit-group:', dbErr);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error exiting group.' }));
    }
    return true;
  }
  
  if (path === '/api/users/register' && method === 'POST') { 
    parseJsonBody(req, res, async data => {
      const { username, email, password } = data; 
      if (!username || !email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username, email, and password are required.' }));
        return;
      }
      const password_hash = password; 
      try {
        const result = await pool.query(
          'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
          [username, email, password_hash]
        );
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows[0]));
      } catch(dbErr) {
        if (dbErr.code === '23505') { 
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username or email already exists.', detail: dbErr.detail }));
        } else {
          console.error('DB Error on POST /users:', dbErr);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database error creating user.' }));
        }
      }
    });
    return true;
  }
  
  if (path === '/api/users' && method === 'GET') {
    try {
        const result = await pool.query('SELECT id, username, email, role, group_id FROM users ORDER BY id ASC');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
    } catch (dbErr) {
        console.error('DB Error on GET /api/users:', dbErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database error fetching all users.' }));
    }
    return true;
  }
  
  if (path.startsWith('/api/users/') && method === 'GET' && path !== '/api/users/me' && !path.endsWith('/register')) {
    const id = parseInt(path.split('/')[3]);
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid user ID format.' }));
      return true;
    }
    try {
        const result = await pool.query('SELECT id, username, email, role, group_id FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User not found.' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result.rows[0]));
        }
    } catch (dbErr) {
        console.error(`DB Error on GET /api/users/${id}:`, dbErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database error fetching user.' }));
    }
    return true;
  }
  
  return false;
}

module.exports = { handleUsers };
