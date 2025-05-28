const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');
const { sendNotificationEmail } = require('../util/emailService');
const { stringify } = require('csv-stringify/sync'); // Using synchronous version
const { parse } = require('csv-parse/sync'); // Using synchronous version
const { create } = require('xmlbuilder2');
const { XMLParser, XMLValidator } = require('fast-xml-parser');

async function handleResources(req, res) {
  const path = req.path;
  const method = req.method;
  const userId = req.userId;
  const queryParams = req.query || {};

  // Handle Export
  if (path === '/api/resources/export' && method === 'GET') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }
    const format = queryParams.format || 'json'; // Default to JSON

    try {
      const resourceQuery = `
        SELECT r.id, r.name, r.category_id, c.name AS category_name, r.quantity, r.description, r.low_stock_threshold
        FROM resources r
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE r.user_id = $1
        ORDER BY r.id ASC
      `;
      const result = await pool.query(resourceQuery, [userId]);
      const resources = result.rows;

      if (format === 'json') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="resources.json"'
        });
        res.end(JSON.stringify(resources, null, 2));
      } else if (format === 'csv') {
        const csvColumns = [
          { key: 'id', header: 'id' },
          { key: 'name', header: 'name' },
          { key: 'category_id', header: 'category_id' },
          { key: 'category_name', header: 'category_name' },
          { key: 'quantity', header: 'quantity' },
          { key: 'description', header: 'description' },
          { key: 'low_stock_threshold', header: 'low_stock_threshold' }
        ];

        // Handle empty resources case
        if (resources.length === 0) {
          const emptyCSV = stringify([], { header: true, columns: csvColumns });
          res.writeHead(200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="resources.csv"'
          });
          res.end(emptyCSV);
          return true;
        }

        // Export non-empty resources
        const csvOutput = stringify(resources, { header: true, columns: csvColumns });
        res.writeHead(200, {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="resources.csv"'
        });
        res.end(csvOutput);
      } else if (format === 'xml') {
        const xmlRoot = create({ version: '1.0' }).ele('resources');
        resources.forEach(resource => {
          const resourceEle = xmlRoot.ele('resource');
          Object.keys(resource).forEach(key => {
            const value = resource[key];
            resourceEle.ele(key).txt(value !== null && value !== undefined ? value.toString() : '');
          });
        });
        const xmlData = xmlRoot.end({ prettyPrint: true });
        res.writeHead(200, {
          'Content-Type': 'application/xml',
          'Content-Disposition': 'attachment; filename="resources.xml"'
        });
        res.end(xmlData);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unsupported format.' }));
      }
    } catch (dbErr) {
      console.error('DB Error on GET /api/resources/export:', dbErr.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error while exporting resources.', details: dbErr.message }));
    }
    return true;
  }

  // Handle Import
  if (path === '/api/resources/import' && method === 'POST') {
    // Check for authentication
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }

    // Validate filename
    const filename = queryParams.filename;
    if (!filename) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Filename missing from query parameters.' }));
      return true;
    }

    // Determine format from file extension
    const fileExtension = filename.split('.').pop().toLowerCase();
    let format;

    if (fileExtension === 'json') {
      format = 'json';
    } else if (fileExtension === 'csv') {
      format = 'csv';
    } else if (fileExtension === 'xml') {
      format = 'xml';
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Unsupported file type: .${fileExtension}` }));
      return true;
    }

    // Collect the uploaded file data
    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk.toString();
    });

    req.on('end', async () => {
      console.log(`[IMPORT DEBUG] Got request with format: ${format}, file: ${filename}`);
      console.log(`[IMPORT DEBUG] Raw body length: ${rawBody.length}`);
      
      if (rawBody.length > 0 && rawBody.length < 1000) {
        console.log(`[IMPORT DEBUG] Raw body preview: ${rawBody.substring(0, 200)}...`);
      } else if (rawBody.length === 0) {
        console.log('[IMPORT DEBUG] Warning: Raw body is empty.');
      }

      try {
        let importedResources = [];
        let responseAlreadySent = false;
        
        // Parse the incoming data based on format
        if (format === 'json') {
          try {
            if (rawBody.trim() === '') {
              importedResources = [];
            } else {
              // First, try to parse as is
              let parsedData;
              try {
                parsedData = JSON.parse(rawBody);
              } catch (initialParseError) {
                // If that fails, check if the string is wrapped in quotes
                // (This happens when the test script sends JSON stringified twice)
                console.log('[IMPORT DEBUG] Initial JSON parse failed, trying to unwrap quoted JSON');
                try {
                  // Try to detect if the string is a quoted JSON string
                  if (rawBody.startsWith('"[') || rawBody.startsWith('"{')) {
                    // This looks like a stringified JSON string
                    const unquotedJson = JSON.parse(rawBody);
                    parsedData = JSON.parse(unquotedJson);
                  } else {
                    throw initialParseError;
                  }
                } catch (unwrapError) {
                  throw initialParseError; // Throw the original error if unwrapping fails
                }
              }
              
              if (!Array.isArray(parsedData)) {
                console.log('[IMPORT DEBUG] JSON not an array, trying to wrap:', typeof parsedData);
                // If it's a single object, convert to array
                if (typeof parsedData === 'object' && parsedData !== null) {
                  importedResources = [parsedData];
                } else {
                  throw new Error('Imported JSON must contain an array or object of resources');
                }
              } else {
                importedResources = parsedData;
              }
            }
            console.log(`[IMPORT DEBUG] Parsed JSON data with ${importedResources.length} resources`);
          } catch (e) {
            console.error('[IMPORT DEBUG] JSON parse error:', e);
            if (!res.headersSent) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON format', details: e.message }));
              responseAlreadySent = true;
            }
            return;
          }
        } else if (format === 'csv') {
          try {
            if (rawBody.trim() === '') {
              importedResources = [];
            } else {
              importedResources = parse(rawBody, {
                columns: true,
                skip_empty_lines: true,
                relax_quotes: true,
                cast: (value, context) => {
                  if (context.column === 'category_id' || context.column === 'quantity' || context.column === 'low_stock_threshold') {
                    const num = parseInt(value, 10);
                    return isNaN(num) ? null : num;
                  }
                  if (context.column === 'id') {
                    const num = parseInt(value, 10);
                    return isNaN(num) ? undefined : num;
                  }
                  return value;
                }
              });
            }
            console.log(`[IMPORT DEBUG] Parsed CSV data with ${importedResources.length} resources`);
          } catch (e) {
            console.error('[IMPORT DEBUG] CSV parse error:', e);
            if (!res.headersSent && !responseAlreadySent) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid CSV format', details: e.message }));
              responseAlreadySent = true;
            }
            return;
          }
        } else if (format === 'xml') {
          try {
            if (rawBody.trim() === '') {
              importedResources = [];
            } else {
              // Validate the XML structure
              const validationResult = XMLValidator.validate(rawBody);
              if (validationResult !== true) {
                console.error('[IMPORT DEBUG] XML validation error:', validationResult);
                throw new Error('Invalid XML structure');
              }
              
              // Parse XML to JSON
              const parser = new XMLParser({
                ignoreAttributes: false,
                parseAttributeValue: true,
                parseTagValue: true,
                trimValues: true,
                isArray: (name, jpath, isLeafNode, isAttribute) => {
                  // Ensure resource is always treated as an array
                  if (name === 'resource') return true;
                  return false;
                },
                // Process numeric values properly
                valueProcessor: (tagName, tagValue) => {
                  if (tagName === 'category_id' || tagName === 'quantity' || tagName === 'low_stock_threshold' || tagName === 'id') {
                    const num = parseInt(tagValue, 10);
                    return isNaN(num) ? (tagName === 'id' ? undefined : null) : num;
                  }
                  return tagValue;
                }
              });
              
              const jsonObj = parser.parse(rawBody);
              console.log('[IMPORT DEBUG] XML parsed structure:', JSON.stringify(jsonObj).substring(0, 200));
              
              if (jsonObj.resources && jsonObj.resources.resource) {
                importedResources = jsonObj.resources.resource;
                if (!Array.isArray(importedResources)) {
                  importedResources = [importedResources]; // Convert to array if single object
                }
              } else {
                console.log('[IMPORT DEBUG] XML missing expected structure');
                importedResources = [];
              }
            }
            console.log(`[IMPORT DEBUG] Parsed XML data with ${importedResources.length} resources`);
          } catch (e) {
            console.error('[IMPORT DEBUG] XML parse error:', e);
            if (!res.headersSent && !responseAlreadySent) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid XML format', details: e.message }));
              responseAlreadySent = true;
            }
            return;
          }
        }

        // If we already sent an error response, stop processing
        if (responseAlreadySent) {
          return;
        }
        
        // Process the parsed resources
        console.log(`[IMPORT DEBUG] Processing ${importedResources.length} resources`);

        // If there's nothing to process, return empty result
        if (importedResources.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            message: 'No resources to import', 
            results: { Succeeded: 0, Failed: 0, Errors: [] }
          }));
          return;
        }

        // Process each imported resource
        const results = { Succeeded: 0, Failed: 0, Errors: [] };
        
        for (const resource of importedResources) {
          // Validate resource data
          if (!resource || typeof resource !== 'object') {
            results.Failed++;
            results.Errors.push({ resource: 'Unknown', error: 'Invalid resource data (not an object)' });
            continue;
          }

          const { id, name, category_id, quantity, description, low_stock_threshold } = resource;

          // Basic validation checks
          if (!name || typeof name !== 'string' || name.trim() === '') {
            results.Failed++;
            results.Errors.push({ 
              resource: name || `Item ${results.Failed + results.Succeeded}`, 
              error: 'Resource name is required and must be a non-empty string' 
            });
            continue;
          }

          const parsedCategoryId = parseInt(category_id, 10);
          if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
            results.Failed++;
            results.Errors.push({ resource: name, error: 'Valid category ID is required (must be a positive number)' });
            continue;
          }

          const parsedQuantity = quantity !== undefined ? parseInt(quantity, 10) : 0;
          if (isNaN(parsedQuantity) || parsedQuantity < 0) {
            results.Failed++;
            results.Errors.push({ resource: name, error: 'Quantity must be a non-negative number' });
            continue;
          }

          const parsedLowStockThreshold = low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : 0;
          if (isNaN(parsedLowStockThreshold) || parsedLowStockThreshold < 0) {
            results.Failed++;
            results.Errors.push({ resource: name, error: 'Low stock threshold must be a non-negative number' });
            continue;
          }

          try {
            // Check if the category exists and is accessible to the user
            const categoryCheck = await pool.query(
              'SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
              [parsedCategoryId, userId]
            );
            
            if (categoryCheck.rows.length === 0) {
              results.Failed++;
              results.Errors.push({ 
                resource: name, 
                error: `Category ID ${parsedCategoryId} not found or not accessible` 
              });
              continue;
            }

            // Update or insert the resource
            if (id) {
              // First check if resource exists and belongs to user
              const resourceCheck = await pool.query(
                'SELECT id FROM resources WHERE id = $1 AND user_id = $2',
                [id, userId]
              );
              
              if (resourceCheck.rows.length === 0) {
                // Resource doesn't exist or doesn't belong to user, create new
                const insertResult = await pool.query(
                  'INSERT INTO resources (name, category_id, quantity, description, low_stock_threshold, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                  [name.trim(), parsedCategoryId, parsedQuantity, description ? description.trim() : null, parsedLowStockThreshold, userId]
                );
                console.log(`[IMPORT DEBUG] Created new resource '${name}' with ID ${insertResult.rows[0].id}`);
              } else {
                // Update existing resource
                await pool.query(
                  'UPDATE resources SET name = $1, category_id = $2, quantity = $3, description = $4, low_stock_threshold = $5 WHERE id = $6 AND user_id = $7',
                  [name.trim(), parsedCategoryId, parsedQuantity, description ? description.trim() : null, parsedLowStockThreshold, id, userId]
                );
                console.log(`[IMPORT DEBUG] Updated resource '${name}' (ID: ${id})`);
              }
            } else {
              // Insert new resource
              const insertResult = await pool.query(
                'INSERT INTO resources (name, category_id, quantity, description, low_stock_threshold, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [name.trim(), parsedCategoryId, parsedQuantity, description ? description.trim() : null, parsedLowStockThreshold, userId]
              );
              console.log(`[IMPORT DEBUG] Created new resource '${name}' with ID ${insertResult.rows[0].id}`);
            }
            
            results.Succeeded++;
          } catch (dbErr) {
            console.error(`[IMPORT DEBUG] Database error for resource '${name}':`, dbErr);
            results.Failed++;
            results.Errors.push({ resource: name, error: `Database error: ${dbErr.message}` });
          }
        }

        // Return final results
        console.log(`[IMPORT DEBUG] Import complete: ${results.Succeeded} succeeded, ${results.Failed} failed`);
        
        if (!res.headersSent && !responseAlreadySent) {
          if (results.Failed > 0) {
            res.writeHead(207, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              message: 'Import completed with some errors', 
              results 
            }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              message: 'Resources imported successfully', 
              results 
            }));
          }
        }
      } catch (err) {
        console.error('[IMPORT DEBUG] Unexpected error during import:', err);
        if (!res.headersSent && !responseAlreadySent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Unexpected server error during import', 
            details: err.message 
          }));
        }
      }
    });
    return true;
  }

  // Handle Resource CRUD operations
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
        
        const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length > 0 && userResult.rows[0].email) {
          sendNotificationEmail(
            userResult.rows[0].email,
            `Low Stock Alert: ${newResource.name}`,
            message
          ).catch(console.error); 
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

      
      if (quantity !== undefined && newQty < threshold) {
        const message = `Warning: Resource "${updatedResource.name}" is low in stock (${newQty} remaining).`;
         await pool.query(
          'INSERT INTO notifications (message, resource_id, type, user_id) VALUES ($1, $2, $3, $4)',
          [message, updatedResource.id, 'low_stock', userId]
        );
        
        const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length > 0 && userResult.rows[0].email) {
          sendNotificationEmail(
            userResult.rows[0].email,
            `Low Stock Alert: ${updatedResource.name}`,
            message
          ).catch(console.error); 
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
