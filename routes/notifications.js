const pool = require('../config/dbConfig');
const url = require('url');

async function handleNotifications(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;
  const userId = req.userId;
  const { showAll } = parsedUrl.query;

  if (!userId) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'User not authenticated.' }));
    return true;
  }
  
  if (path === '/api/notifications' && method === 'GET') {
    try {
      let queryText = 'SELECT * FROM notifications WHERE user_id = $1';
      const queryParams = [userId];
      if (showAll !== 'true') {
        queryText += ' AND is_read = FALSE';
      }
      queryText += ' ORDER BY created_at DESC';
      const result = await pool.query(queryText, queryParams);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
    } catch (dbErr) {
      console.error('DB Error on GET /api/notifications:', dbErr.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error while fetching notifications.', details: dbErr.message }));
    }
    return true;
  }
  
  if (path.startsWith('/api/notifications/') && method === 'GET') {
    const id = parseInt(path.split('/')[3]);
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid notification ID format.' }));
      return true;
    }
    const result = await pool.query('SELECT * FROM notifications WHERE id = $1 AND user_id = $2', [id, userId]);
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
    const result = await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
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
    const checkResult = await pool.query('SELECT * FROM notifications WHERE id = $1 AND user_id = $2', [id, userId]);
    if (checkResult.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Notification not found or you do not have permission to delete it.' }));
        return true;
    }
    const result = await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
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
