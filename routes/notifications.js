// Notifications routes
const pool = require('../config/dbConfig');

async function handleNotifications(req, res) {
  const path = req.path;
  const method = req.method;
  
  // Get all unread notifications
  if (path === '/api/notifications' && method === 'GET') { // Changed to /api/notifications
    const result = await pool.query('SELECT * FROM notifications WHERE is_read = FALSE ORDER BY created_at DESC');
    res.writeHead(200, { 'Content-Type': 'application/json' }); // Added Content-Type
    res.end(JSON.stringify(result.rows));
    return true;
  }
  
  // Get a specific notification
  if (path.startsWith('/api/notifications/') && method === 'GET') {  // Changed to /api/notifications/
    const id = parseInt(path.split('/')[3]); // Adjusted index for ID
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' }); // Added Content-Type
      res.end(JSON.stringify({ error: 'Invalid notification ID format.' }));
      return true;
    }
    const result = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' }); // Added Content-Type
      res.end(JSON.stringify({ error: 'Notification not found.' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' }); // Added Content-Type
      res.end(JSON.stringify(result.rows[0]));
    }
    return true;
  }
  
  // Mark notification as read
  if (path.startsWith('/api/notifications/') && method === 'PUT') { // Changed to /api/notifications/
    const id = parseInt(path.split('/')[3]); // Adjusted index for ID
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' }); // Added Content-Type
      res.end(JSON.stringify({ error: 'Invalid notification ID format.' }));
      return true;
    }
    const result = await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' }); // Added Content-Type
      res.end(JSON.stringify({ error: 'Notification not found to mark as read.' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' }); // Added Content-Type
      res.end(JSON.stringify(result.rows[0]));
    }
    return true;
  }
  
  // Delete notification
  if (path.startsWith('/api/notifications/') && method === 'DELETE') { // Changed to /api/notifications/
    const id = parseInt(path.split('/')[3]); // Adjusted index for ID
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' }); // Added Content-Type
      res.end(JSON.stringify({ error: 'Invalid notification ID format.' }));
      return true;
    }
    const result = await pool.query('DELETE FROM notifications WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' }); // Added Content-Type
      res.end(JSON.stringify({ error: 'Notification not found.' }));
    } else {
      res.writeHead(204); // No content to return, so no Content-Type needed for 204
      res.end();
    }
    return true;
  }
  
  return false; // Not handled
}

module.exports = { handleNotifications };
