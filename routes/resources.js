// Resources routes
const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');

async function handleResources(req, res) {
  const path = req.path;
  const method = req.method;
  
  // Create a resource
  if (path === '/resources' && method === 'POST') {
    parseJsonBody(req, res, async data => {
      const { name, category_id, quantity, description, low_stock_threshold } = data;
      if (!name || category_id === undefined) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Resource name and category_id are required.' }));
        return;
      }
      try {
        const result = await pool.query(
          'INSERT INTO resources (name, category_id, quantity, description, low_stock_threshold) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [name, category_id, quantity, description, low_stock_threshold]
        );
        const newResource = result.rows[0];

        if (quantity !== undefined && low_stock_threshold !== undefined && quantity < low_stock_threshold) {
          await pool.query(
            'INSERT INTO notifications (message, resource_id, type) VALUES ($1, $2, $3)',
            [`Warning: Resource "${name}" is low in stock (${quantity} remaining).`, newResource.id, 'low_stock']
          );
        }
        res.writeHead(201);
        res.end(JSON.stringify(newResource));
      } catch (dbErr) {
        console.error('DB Error on POST /resources:', dbErr);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Database error', details: dbErr.message }));
      }
    });
    return true;
  }
  
  // List all resources
  if (path === '/resources' && method === 'GET') {
    const result = await pool.query('SELECT * FROM resources ORDER BY id ASC');
    res.writeHead(200);
    res.end(JSON.stringify(result.rows));
    return true;
  }
  
  // Get a single resource
  if (path.startsWith('/resources/') && method === 'GET') {
    const id = parseInt(path.split('/')[2]);
    if (isNaN(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid resource ID format.' }));
      return true;
    }
    const result = await pool.query('SELECT * FROM resources WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Resource not found.' }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify(result.rows[0]));
    }
    return true;
  }
  
  // Update a resource
  if (path.startsWith('/resources/') && method === 'PUT') {
    const id = parseInt(path.split('/')[2]);
    if (isNaN(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid resource ID format.' }));
      return true;
    }
    parseJsonBody(req, res, async data => {
      const { name, category_id, quantity, description, low_stock_threshold } = data;
      const currentResourceResult = await pool.query('SELECT quantity, low_stock_threshold, name FROM resources WHERE id = $1', [id]);
      if (currentResourceResult.rows.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Resource not found to update.' }));
        return;
      }
      const originalResource = currentResourceResult.rows[0];

      const q = 'UPDATE resources SET name = $1, category_id = $2, quantity = $3, description = $4, low_stock_threshold = $5 WHERE id = $6 RETURNING *';
      const result = await pool.query(q, [
        name || originalResource.name,
        category_id || originalResource.category_id,
        quantity === undefined ? originalResource.quantity : quantity,
        description || originalResource.description,
        low_stock_threshold === undefined ? originalResource.low_stock_threshold : low_stock_threshold,
        id
      ]);

      if (result.rows.length === 0) {
        res.writeHead(404); 
        res.end(JSON.stringify({ error: 'Resource not found after update attempt.' }));
      } else {
        const updatedResource = result.rows[0];
        const oldQty = originalResource.quantity;
        const newQty = updatedResource.quantity;
        const threshold = updatedResource.low_stock_threshold;

        if (newQty < threshold && (oldQty === undefined || oldQty >= threshold)) {
           await pool.query(
            'INSERT INTO notifications (message, resource_id, type) VALUES ($1, $2, $3)',
            [`Warning: Resource "${updatedResource.name}" is low in stock (${newQty} remaining).`, updatedResource.id, 'low_stock']
          );
        }
        res.writeHead(200);
        res.end(JSON.stringify(updatedResource));
      }
    });
    return true;
  }
  
  // Delete a resource
  if (path.startsWith('/resources/') && method === 'DELETE') {
    const id = parseInt(path.split('/')[2]);
    if (isNaN(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid resource ID format.' }));
      return true;
    }
    const result = await pool.query('DELETE FROM resources WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Resource not found.' }));
    } else {
      res.writeHead(204);
      res.end();
    }
    return true;
  }
  
  return false; // Not handled
}

module.exports = { handleResources };
