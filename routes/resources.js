// Resources routes
const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');

async function handleResources(req, res) {
  const path = req.path;
  const method = req.method;

  // Create a resource - Adjusted to /api/resources
  if (path === '/api/resources' && method === 'POST') {
    const data = await parseJsonBody(req, res);

    // If data is null, parseJsonBody already handled the error response
    if (data === null) {
      return true; // Indicate request was handled (or attempted to be)
    }

    console.log('POST /api/resources - Received data:', data);
    const { name, category_id, quantity, description, low_stock_threshold } = data;

    // Enhanced Input Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Resource name is required and must be a non-empty string.' }));
      return;
    }
    // Ensure category_id is a positive integer
    const parsedCategoryId = parseInt(category_id, 10);
    if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'A valid Category ID is required.' }));
      return;
    }
    
    const parsedQuantity = quantity !== undefined ? parseInt(quantity, 10) : 0;
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Quantity must be a non-negative number.' }));
      return;
    }

    const parsedLowStockThreshold = low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : 0;
    if (isNaN(parsedLowStockThreshold) || parsedLowStockThreshold < 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Low stock threshold must be a non-negative number.' }));
      return;
    }

    try {
      const result = await pool.query(
        'INSERT INTO resources (name, category_id, quantity, description, low_stock_threshold) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name.trim(), parsedCategoryId, parsedQuantity, description ? description.trim() : null, parsedLowStockThreshold]
      );
      const newResource = result.rows[0];
      console.log('POST /api/resources - Resource created:', newResource);

      // Check for low stock notification
      if (newResource.quantity < newResource.low_stock_threshold) {
        await pool.query(
          'INSERT INTO notifications (message, resource_id, type) VALUES ($1, $2, $3)',
          [`Warning: Resource "${newResource.name}" is low in stock (${newResource.quantity} remaining).`, newResource.id, 'low_stock']
        );
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

  // List all resources as JSON API
  if (path === '/api/resources' && method === 'GET') {
    try {
      const query = `
        SELECT r.id, r.name, r.category_id, c.name AS category_name, r.quantity, r.description, r.low_stock_threshold 
        FROM resources r
        LEFT JOIN categories c ON r.category_id = c.id
        ORDER BY r.id ASC
      `;
      const result = await pool.query(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
    } catch (dbErr) {
      console.error('DB Error on GET /api/resources:', dbErr.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error while fetching resources.', details: dbErr.message }));
    }
    return true;
  }

  // List all resources (this was the original /resources GET handler, now effectively for HTML via serveResourcesPage)
  // if (path === '/resources' && method === 'GET') { ... }
  // This block can be removed or commented out if serveResourcesPage in index.js handles HTML serving.
  // For clarity, I will comment it out, assuming index.js handles the HTML page for /resources.
  /*
  if (path === '/resources' && method === 'GET') {
    const result = await pool.query('SELECT * FROM resources ORDER BY id ASC');
    res.writeHead(200);
    res.end(JSON.stringify(result.rows));
    return true;
  }
  */
  
  // Get a single resource - Adjusted to /api/resources/:id
  if (path.startsWith('/api/resources/') && method === 'GET' && path.split('/').length === 4) { // Ensure it's /api/resources/:id
    const id = parseInt(path.split('/')[3]);
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
  
  // Update a resource - Adjusted to /api/resources/:id
  if (path.startsWith('/api/resources/') && method === 'PUT' && path.split('/').length === 4) { // Ensure it's /api/resources/:id
    const id = parseInt(path.split('/')[3]);
    if (isNaN(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid resource ID format.' }));
      return true;
    }
    const data = await parseJsonBody(req, res);

    // If data is null, parseJsonBody already handled the error response
    if (data === null) {
      return true; // Indicate request was handled (or attempted to be)
    }

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
    return true;
  }
  
  // Delete a resource - Adjusted to /api/resources/:id
  if (path.startsWith('/api/resources/') && method === 'DELETE' && path.split('/').length === 4) { // Ensure it's /api/resources/:id
    const id = parseInt(path.split('/')[3]);
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
