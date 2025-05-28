const pool = require('../config/dbConfig');

async function handleNotifications(req, res) {
  const path = req.path;
  const method = req.method;
  
  if (path === '/api/notifications' && method === 'GET') {
    const result = await pool.query('SELECT * FROM notifications WHERE is_read = FALSE ORDER BY created_at DESC');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.rows));
    return true;
  }
  
  if (path.startsWith('/api/notifications/') && method === 'GET') {
    const id = parseInt(path.split('/')[3]);
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid notification ID format.' }));
      return true;
    }
    const result = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Notification not found.' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows[0]));
    }
    return true;
  }
  
  if (path.startsWith('/api/notifications/') && method === 'PUT') {
    const id = parseInt(path.split('/')[3]);
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid notification ID format.' }));
      return true;
    }
    const result = await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Notification not found to mark as read.' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows[0]));
    }
    return true;
  }
  
  if (path.startsWith('/api/notifications/') && method === 'DELETE') {
    const id = parseInt(path.split('/')[3]);
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid notification ID format.' }));
      return true;
    }
    const result = await pool.query('DELETE FROM notifications WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Notification not found.' }));
    } else {
      res.writeHead(204);
      res.end();
    }
    return true;
  }
  
  return false;
}

module.exports = { handleNotifications };
