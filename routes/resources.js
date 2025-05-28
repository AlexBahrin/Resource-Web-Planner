const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');
const { sendNotificationEmail } = require('../util/emailService'); // Added email service

async function handleResources(req, res) {
  const path = req.path;
  const method = req.method;
  const userId = req.userId; 

  if (path === '/api/resources' && method === 'POST') {
    const data = await parseJsonBody(req, res);

    if (data === null) {
      return true;
    }

    console.log('POST /api/resources - Received data:', data);
    const { name, category_id, quantity, description, low_stock_threshold } = data; 

    if (!userId) { 
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not authenticated.' }));
        return true;
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Resource name is required and must be a non-empty string.' }));
      return true; 
    }
    const parsedCategoryId = parseInt(category_id, 10);
    if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'A valid Category ID is required.' }));
      return true; 
    }
    
    const parsedQuantity = quantity !== undefined ? parseInt(quantity, 10) : 0;
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Quantity must be a non-negative number.' }));
      return true; 
    }

    const parsedLowStockThreshold = low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : 0;
    if (isNaN(parsedLowStockThreshold) || parsedLowStockThreshold < 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Low stock threshold must be a non-negative number.' }));
      return true; 
    }

    try {
      const result = await pool.query(
        'INSERT INTO resources (name, category_id, quantity, description, low_stock_threshold, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name.trim(), parsedCategoryId, parsedQuantity, description ? description.trim() : null, parsedLowStockThreshold, userId]
      );
      const newResource = result.rows[0];
      console.log('POST /api/resources - Resource created:', newResource);

      if (newResource.quantity < newResource.low_stock_threshold) {
        const message = `Warning: Resource "${newResource.name}" is low in stock (${newResource.quantity} remaining).`;
        await pool.query(
          'INSERT INTO notifications (message, resource_id, type, user_id) VALUES ($1, $2, $3, $4)',
          [message, newResource.id, 'low_stock', userId]
        );
        // Send email notification
        const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length > 0 && userResult.rows[0].email) {
          sendNotificationEmail(
            userResult.rows[0].email,
            `Low Stock Alert: ${newResource.name}`,
            message
          ).catch(console.error); // Log email sending errors but don't block the response
        }
      }
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newResource));
    } catch (dbErr) {
      console.error('DB Error on POST /api/resources:', dbErr.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error while creating resource.', details: dbErr.message }));
    }
    return true;
  }

  if (path === '/api/resources' && method === 'GET') {
    if (!userId) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not authenticated.' }));
        return true;
    }
    try {
      const query = `
        SELECT r.id, r.name, r.category_id, c.name AS category_name, r.quantity, r.description, r.low_stock_threshold, r.user_id 
        FROM resources r
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE r.user_id = $1
        ORDER BY r.id ASC
      `; 
      const result = await pool.query(query, [userId]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
    } catch (dbErr) {
      console.error('DB Error on GET /api/resources:', dbErr.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error while fetching resources.', details: dbErr.message }));
    }
    return true;
  }

  if (path.startsWith('/api/resources/') && method === 'GET' && path.split('/').length === 4) {
    const id = parseInt(path.split('/')[3]);
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid resource ID format.' }));
      return true;
    }
    if (!userId) { 
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not authenticated.' }));
        return true;
    }
    
    const result = await pool.query('SELECT * FROM resources WHERE id = $1 AND user_id = $2', [id, userId]);
    if (result.rows.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Resource not found.' }));
    } else {
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows[0]));
    }
    return true;
  }
  
  if (path.startsWith('/api/resources/') && method === 'PUT' && path.split('/').length === 4) {
    const id = parseInt(path.split('/')[3]);
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid resource ID format.' }));
      return true;
    }
    const data = await parseJsonBody(req, res);

    if (data === null) {
      return true;
    }
    if (!userId) { 
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not authenticated for PUT operation.' }));
        return true;
    }

    const { name, category_id, quantity, description, low_stock_threshold } = data;
    const currentResourceResult = await pool.query('SELECT quantity, low_stock_threshold, name, user_id FROM resources WHERE id = $1', [id]);
    if (currentResourceResult.rows.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Resource not found to update.' }));
      return true;
    }
    const originalResource = currentResourceResult.rows[0];

    if (originalResource.user_id !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: You do not own this resource.' }));
        return true;
    }

    const q = 'UPDATE resources SET name = $1, category_id = $2, quantity = $3, description = $4, low_stock_threshold = $5 WHERE id = $6 AND user_id = $7 RETURNING *';
    const result = await pool.query(q, [
      name || originalResource.name,
      category_id || originalResource.category_id,
      quantity === undefined ? originalResource.quantity : quantity,
      description || originalResource.description,
      low_stock_threshold === undefined ? originalResource.low_stock_threshold : low_stock_threshold,
      id,
      userId
    ]);

    if (result.rows.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' }); 
      res.end(JSON.stringify({ error: 'Resource not found or not authorized to update.' }));
    } else {
      const updatedResource = result.rows[0];
      const oldQty = originalResource.quantity;
      const newQty = updatedResource.quantity;
      const threshold = updatedResource.low_stock_threshold;

      // Check if quantity was provided in the request and the new quantity is below the threshold
      if (quantity !== undefined && newQty < threshold) {
        const message = `Warning: Resource "${updatedResource.name}" is low in stock (${newQty} remaining).`;
         await pool.query(
          'INSERT INTO notifications (message, resource_id, type, user_id) VALUES ($1, $2, $3, $4)',
          [message, updatedResource.id, 'low_stock', userId]
        );
        // Send email notification
        const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length > 0 && userResult.rows[0].email) {
          sendNotificationEmail(
            userResult.rows[0].email,
            `Low Stock Alert: ${updatedResource.name}`,
            message
          ).catch(console.error); // Log email sending errors but don't block the response
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(updatedResource));
    }
    return true;
  }
  
  if (path.startsWith('/api/resources/') && method === 'DELETE' && path.split('/').length === 4) {
    const id = parseInt(path.split('/')[3]);
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid resource ID format.' }));
      return true;
    }
    if (!userId) { 
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not authenticated for DELETE operation.' }));
        return true;
    }

    const resourceCheck = await pool.query('SELECT user_id FROM resources WHERE id = $1', [id]);
    if (resourceCheck.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Resource not found.' }));
        return true;
    }
    if (resourceCheck.rows[0].user_id !== userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: You do not own this resource.' }));
        return true;
    }

    const result = await pool.query('DELETE FROM resources WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
    if (result.rowCount === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Resource not found or not authorized to delete.' }));
    } else {
      res.writeHead(204, { 'Content-Type': 'application/json' }); 
      res.end();
    }
    return true;
  }
  
  return false;
}

module.exports = { handleResources };
