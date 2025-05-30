const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');
const { sendNotificationEmail } = require('../util/emailService');
const { stringify } = require('csv-stringify/sync');
const { parse } = require('csv-parse/sync');
const { create } = require('xmlbuilder2');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { checkResourceExpirations } = require('../tasks/expirationChecker');

async function handleResources(req, res) {
  const path = req.path;
  const method = req.method;
  const userId = req.userId;
  const queryParams = req.query || {};

  if (path === '/api/resources/export' && method === 'GET') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }
    const format = queryParams.format || 'json';

    try {
      const userGroupResForExport = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
      const groupIdForExport = userGroupResForExport.rows.length > 0 ? userGroupResForExport.rows[0].group_id : null;

      let exportQueryText;
      let exportQueryParams;

      if (groupIdForExport) {
        exportQueryText = `
          SELECT r.id, r.name, r.category_id, c.name AS category_name, r.quantity, r.description, r.low_stock_threshold, r.expiration_date, r.user_id, u.username AS owner_username
          FROM resources r
          LEFT JOIN categories c ON r.category_id = c.id
          JOIN users u ON r.user_id = u.id
          WHERE u.group_id = $1
          ORDER BY r.id ASC
        `;
        exportQueryParams = [groupIdForExport];
      } else {
        exportQueryText = `
          SELECT r.id, r.name, r.category_id, c.name AS category_name, r.quantity, r.description, r.low_stock_threshold, r.expiration_date, r.user_id, u.username AS owner_username
          FROM resources r
          LEFT JOIN categories c ON r.category_id = c.id
          JOIN users u ON r.user_id = u.id
          WHERE r.user_id = $1
          ORDER BY r.id ASC
        `;
        exportQueryParams = [userId];
      }
      const result = await pool.query(exportQueryText, exportQueryParams);
      const resources = result.rows.map(r => ({
        ...r,
        expiration_date: r.expiration_date ? new Date(r.expiration_date).toISOString().split('T')[0] : null
      }));

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
          { key: 'low_stock_threshold', header: 'low_stock_threshold' },
          { key: 'expiration_date', header: 'expiration_date' }
        ];

        if (resources.length === 0) {
          const emptyCSV = stringify([], { header: true, columns: csvColumns });
          res.writeHead(200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="resources.csv"'
          });
          res.end(emptyCSV);
          return true;
        }

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

  if (path === '/api/resources/import' && method === 'POST') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }

    const filename = queryParams.filename;
    if (!filename) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Filename missing from query parameters.' }));
      return true;
    }

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
        
        if (format === 'json') {
          try {
            if (rawBody.trim() === '') {
              importedResources = [];
            } else {
              let parsedData;
              try {
                parsedData = JSON.parse(rawBody);
              } catch (initialParseError) {
                console.log('[IMPORT DEBUG] Initial JSON parse failed, trying to unwrap quoted JSON');
                try {
                  if (rawBody.startsWith('"[') || rawBody.startsWith('"{')) {
                    const unquotedJson = JSON.parse(rawBody);
                    parsedData = JSON.parse(unquotedJson);
                  } else {
                    throw initialParseError;
                  }
                } catch (unwrapError) {
                  throw initialParseError;
                }
              }
              
              if (!Array.isArray(parsedData)) {
                console.log('[IMPORT DEBUG] JSON not an array, trying to wrap:', typeof parsedData);
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
                  if (context.column === 'expiration_date') {
                    const date = new Date(value);
                    return isNaN(date.getTime()) ? null : value;
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
              const validationResult = XMLValidator.validate(rawBody);
              if (validationResult !== true) {
                console.error('[IMPORT DEBUG] XML validation error:', validationResult);
                throw new Error('Invalid XML structure');
              }
              
              const parser = new XMLParser({
                ignoreAttributes: false,
                parseAttributeValue: true,
                parseTagValue: true,
                trimValues: true,
                isArray: (name, jpath, isLeafNode, isAttribute) => {
                  if (name === 'resource') return true;
                  return false;
                },
                valueProcessor: (tagName, tagValue) => {
                  if (tagName === 'category_id' || tagName === 'quantity' || tagName === 'low_stock_threshold' || tagName === 'id') {
                    const num = parseInt(tagValue, 10);
                    return isNaN(num) ? (tagName === 'id' ? undefined : null) : num;
                  }
                  if (tagName === 'expiration_date') {
                    const date = new Date(tagValue);
                    return isNaN(date.getTime()) ? null : tagValue;
                  }
                  return tagValue;
                }
              });
              
              const jsonObj = parser.parse(rawBody);
              console.log('[IMPORT DEBUG] XML parsed structure:', JSON.stringify(jsonObj).substring(0, 200));
              
              if (jsonObj.resources && jsonObj.resources.resource) {
                importedResources = jsonObj.resources.resource;
                if (!Array.isArray(importedResources)) {
                  importedResources = [importedResources];
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

        if (responseAlreadySent) {
          return;
        }
        
        console.log(`[IMPORT DEBUG] Processing ${importedResources.length} resources`);

        if (importedResources.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            message: 'No resources to import', 
            results: { Succeeded: 0, Failed: 0, Errors: [] }
          }));
          return;
        }

        const results = { Succeeded: 0, Failed: 0, Errors: [] };
        
        for (const resource of importedResources) {
          if (!resource || typeof resource !== 'object') {
            results.Failed++;
            results.Errors.push({ resource: 'Unknown', error: 'Invalid resource data (not an object)' });
            continue;
          }

          const { id, name, category_id, quantity, description, low_stock_threshold, expiration_date } = resource;

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

          let parsedExpirationDate = null;
          if (expiration_date) {
            const date = new Date(expiration_date);
            if (!isNaN(date.getTime())) {
              parsedExpirationDate = date.toISOString().split('T')[0];
            } else {
              console.warn(`[IMPORT DEBUG] Invalid expiration date for resource '${name}': ${expiration_date}. Setting to null.`);
            }
          }


          try {
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

            const existingResourceByName = await pool.query(
              'SELECT id, quantity FROM resources WHERE name = $1 AND user_id = $2',
              [name.trim(), userId]
            );

            if (id) { 
              const resourceCheckById = await pool.query(
                'SELECT id FROM resources WHERE id = $1 AND user_id = $2',
                [id, userId]
              );
              
              if (resourceCheckById.rows.length === 0) {
                if (existingResourceByName.rows.length > 0) {
                  const existing = existingResourceByName.rows[0];
                  const newQuantity = existing.quantity + parsedQuantity;
                  await pool.query(
                    'UPDATE resources SET quantity = $1 WHERE id = $2 AND user_id = $3',
                    [newQuantity, existing.id, userId]
                  );
                  console.log(`[IMPORT DEBUG] Added quantity to existing resource '${name}' (ID: ${existing.id}), new quantity: ${newQuantity}`);
                } else {
                  const insertResult = await pool.query(
                    'INSERT INTO resources (name, category_id, quantity, description, low_stock_threshold, user_id, expiration_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
                    [name.trim(), parsedCategoryId, parsedQuantity, description ? description.trim() : null, parsedLowStockThreshold, userId, parsedExpirationDate]
                  );
                  console.log(`[IMPORT DEBUG] Created new resource '${name}' with ID ${insertResult.rows[0].id} (original ID ${id} not found for user)`);
                }
              } else { 
                await pool.query(
                  'UPDATE resources SET name = $1, category_id = $2, quantity = $3, description = $4, low_stock_threshold = $5, expiration_date = $6 WHERE id = $7 AND user_id = $8',
                  [name.trim(), parsedCategoryId, parsedQuantity, description ? description.trim() : null, parsedLowStockThreshold, parsedExpirationDate, id, userId]
                );
                console.log(`[IMPORT DEBUG] Updated resource '${name}' (ID: ${id})`);
              }
            } else {
              if (existingResourceByName.rows.length > 0) {
                const existing = existingResourceByName.rows[0];
                const newQuantity = existing.quantity + parsedQuantity;
                await pool.query(
                  'UPDATE resources SET quantity = $1 WHERE id = $2 AND user_id = $3',
                  [newQuantity, existing.id, userId]
                );
                console.log(`[IMPORT DEBUG] Added quantity to existing resource '${name}' (ID: ${existing.id}), new quantity: ${newQuantity}`);
              } else {
                const insertResult = await pool.query(
                  'INSERT INTO resources (name, category_id, quantity, description, low_stock_threshold, user_id, expiration_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
                  [name.trim(), parsedCategoryId, parsedQuantity, description ? description.trim() : null, parsedLowStockThreshold, userId, parsedExpirationDate]
                );
                console.log(`[IMPORT DEBUG] Created new resource '${name}' with ID ${insertResult.rows[0].id}`);
              }
            }
            
            results.Succeeded++;
          } catch (dbErr) {
            console.error(`[IMPORT DEBUG] Database error for resource '${name}':`, dbErr);
            results.Failed++;
            results.Errors.push({ resource: name, error: `Database error: ${dbErr.message}` });
          }
        }

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

  if (path === '/api/resources' && method === 'POST') {
    const data = await parseJsonBody(req, res);

    if (data === null) {
      return true;
    }

    console.log('POST /api/resources - Received data:', data);
    const { name, category_id, quantity, description, low_stock_threshold, expiration_date } = data; 

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

    try {
      const existingResource = await pool.query(
        'SELECT id FROM resources WHERE name = $1 AND user_id = $2',
        [name.trim(), userId]
      );
      if (existingResource.rows.length > 0) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'A resource with this name already exists.' }));
        return true;
      }
    } catch (dbErr) {
      console.error('DB Error on POST /api/resources (checking existing name):', dbErr.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error while checking resource name.', details: dbErr.message }));
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

    let parsedExpirationDate = null;
    if (expiration_date) {
        const date = new Date(expiration_date);
        if (!isNaN(date.getTime())) {
            parsedExpirationDate = date.toISOString().split('T')[0];
        } else {
            console.warn(`Invalid expiration_date format: ${expiration_date}. It will be stored as NULL.`);
        }
    }

    try {
      const result = await pool.query(
        'INSERT INTO resources (name, category_id, quantity, description, low_stock_threshold, user_id, expiration_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [name.trim(), parsedCategoryId, parsedQuantity, description ? description.trim() : null, parsedLowStockThreshold, userId, parsedExpirationDate]
      );
      const newResource = result.rows[0];
      console.log('POST /api/resources - Resource created:', newResource);

      if (newResource.quantity < newResource.low_stock_threshold) {
        const message = `Warning: Resource "${newResource.name}" is low in stock (${newResource.quantity} remaining).`;
        
        const ownerDetails = await pool.query('SELECT email, group_id FROM users WHERE id = $1', [userId]);

        if (ownerDetails.rows.length > 0) {
          const owner = ownerDetails.rows[0];
          if (owner.group_id) {
            const groupMembers = await pool.query('SELECT id, email FROM users WHERE group_id = $1', [owner.group_id]);
            for (const member of groupMembers.rows) {
              await pool.query(
                'INSERT INTO notifications (message, resource_id, type, user_id) VALUES ($1, $2, $3, $4)',
                [message, newResource.id, 'low_stock', member.id]
              );
              if (member.email) {
                sendNotificationEmail(
                  member.email,
                  `Low Stock Alert: ${newResource.name}`,
                  message
                ).catch(err => console.error(`Failed to send low stock email to ${member.email}:`, err));
              }
            }
          } else {
            await pool.query(
              'INSERT INTO notifications (message, resource_id, type, user_id) VALUES ($1, $2, $3, $4)',
              [message, newResource.id, 'low_stock', userId]
            );
            if (owner.email) {
              sendNotificationEmail(
                owner.email,
                `Low Stock Alert: ${newResource.name}`,
                message
              ).catch(err => console.error(`Failed to send low stock email to ${owner.email}:`, err));
            }
          }
        }
      }

      if (newResource.expiration_date) {
        checkResourceExpirations().catch(err => console.error("Error running expiration checker after new resource creation:", err));
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
      const userGroupRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
      const groupId = userGroupRes.rows.length > 0 ? userGroupRes.rows[0].group_id : null;

      let query;
      let queryParamsArr;

      if (groupId) {
        query = `
          SELECT r.id, r.name, r.category_id, c.name AS category_name, r.quantity, r.description, r.low_stock_threshold, r.expiration_date, r.user_id, u.username AS owner_username
          FROM resources r
          LEFT JOIN categories c ON r.category_id = c.id
          JOIN users u ON r.user_id = u.id
          WHERE u.group_id = $1
          ORDER BY r.id ASC
        `;
        queryParamsArr = [groupId];
      } else {
        query = `
          SELECT r.id, r.name, r.category_id, c.name AS category_name, r.quantity, r.description, r.low_stock_threshold, r.expiration_date, r.user_id, u.username AS owner_username
          FROM resources r
          LEFT JOIN categories c ON r.category_id = c.id
          JOIN users u ON r.user_id = u.id
          WHERE r.user_id = $1
          ORDER BY r.id ASC
        `;
        queryParamsArr = [userId];
      }
      
      const result = await pool.query(query, queryParamsArr);
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

    const userGroupRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
    const userGroupId = userGroupRes.rows.length > 0 ? userGroupRes.rows[0].group_id : null;

    const resourceQuery = 'SELECT r.*, u.group_id AS owner_group_id, u.username AS owner_username FROM resources r JOIN users u ON r.user_id = u.id WHERE r.id = $1';
    const result = await pool.query(resourceQuery, [id]);
    
    if (result.rows.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Resource not found.' }));
    } else {
      const resource = result.rows[0];
      if (resource.user_id === userId || (userGroupId !== null && resource.owner_group_id === userGroupId)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resource));
      } else {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: You do not have access to this resource.' }));
      }
    }
    return true;
  }
  
  if (path.startsWith('/api/resources/') && method === 'PUT' && path.split('/').length === 4) {
    const resourceId = parseInt(path.split('/')[3], 10);
    if (isNaN(resourceId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid resource ID.' }));
      return true;
    }

    const data = await parseJsonBody(req, res);
    if (data === null) {
      return true;
    }

    const { name, category_id, quantity, description, low_stock_threshold, expiration_date } = data;

    if (!userId) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not authenticated.' }));
        return true;
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Resource name, if provided, must be a non-empty string.' }));
      return true;
    }

    if (name !== undefined) {
        try {
            const existingResource = await pool.query(
                'SELECT id FROM resources WHERE name = $1 AND user_id = $2 AND id != $3',
                [name.trim(), userId, resourceId]
            );
            if (existingResource.rows.length > 0) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Another resource with this name already exists.' }));
                return true;
            }
        } catch (dbErr) {
            console.error('DB Error on PUT /api/resources (checking existing name):', dbErr.stack);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Database error while checking resource name.', details: dbErr.message }));
            return true;
        }
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (category_id !== undefined) updateFields.category_id = category_id;
    if (quantity !== undefined) updateFields.quantity = quantity;
    if (description !== undefined) updateFields.description = description;
    if (low_stock_threshold !== undefined) updateFields.low_stock_threshold = low_stock_threshold;
    if (expiration_date !== undefined) updateFields.expiration_date = expiration_date;

    try {
      const resourceCheck = await pool.query(
        'SELECT id FROM resources WHERE id = $1 AND user_id = $2',
        [resourceId, userId]
      );
      
      if (resourceCheck.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Resource not found or not authorized to update.' }));
        return true;
      }

      const result = await pool.query(
        'UPDATE resources SET name = $1, category_id = $2, quantity = $3, description = $4, low_stock_threshold = $5, expiration_date = $6 WHERE id = $7 AND user_id = $8 RETURNING *',
        [
          updateFields.name || null,
          updateFields.category_id || null,
          updateFields.quantity || null,
          updateFields.description || null,
          updateFields.low_stock_threshold || null,
          updateFields.expiration_date || null,
          resourceId,
          userId
        ]
      );

      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' }); 
        res.end(JSON.stringify({ error: 'Resource not found or not authorized to update.' }));
      } else {
        const updatedResource = result.rows[0];
        const oldQty = resourceCheck.rows[0].quantity;
        const newQty = updatedResource.quantity;
        const threshold = updatedResource.low_stock_threshold;

        if (quantity !== undefined && newQty < threshold && newQty !== oldQty) {
          const message = `Warning: Resource "${updatedResource.name}" is low in stock (${newQty} remaining).`;
          
          const resourceOwnerId = updatedResource.user_id;
          const ownerDetailsResult = await pool.query('SELECT email, group_id FROM users WHERE id = $1', [resourceOwnerId]);

          if (ownerDetailsResult.rows.length > 0) {
            const owner = ownerDetailsResult.rows[0];
            if (owner.group_id) {
              const groupMembers = await pool.query('SELECT id, email FROM users WHERE group_id = $1', [owner.group_id]);
              for (const member of groupMembers.rows) {
                await pool.query(
                  'INSERT INTO notifications (message, resource_id, type, user_id) VALUES ($1, $2, $3, $4)',
                  [message, updatedResource.id, 'low_stock', member.id]
                );
                if (member.email) {
                  sendNotificationEmail(
                    member.email,
                    `Low Stock Alert: ${updatedResource.name}`,
                    message
                  ).catch(err => console.error(`Failed to send low stock email to ${member.email}:`, err));
                }
              }
            } else {
              await pool.query(
                'INSERT INTO notifications (message, resource_id, type, user_id) VALUES ($1, $2, $3, $4)',
                [message, updatedResource.id, 'low_stock', resourceOwnerId]
              );
              if (owner.email) {
                sendNotificationEmail(
                  owner.email,
                  `Low Stock Alert: ${updatedResource.name}`,
                  message
                ).catch(err => console.error(`Failed to send low stock email to ${owner.email}:`, err));
              }
            }
          }
        }

        const oldExpDate = resourceCheck.rows[0].expiration_date;
        const newExpDate = updatedResource.expiration_date;
        if (data.hasOwnProperty('expiration_date') && oldExpDate !== newExpDate) {
          checkResourceExpirations().catch(err => console.error("Error running expiration checker after resource update:", err));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(updatedResource));
      }
    } catch (dbErr) {
      console.error('DB Error on PUT /api/resources:', dbErr.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error while updating resource.', details: dbErr.message }));
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

    const requestingUserGroupRes = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
    const requestingUserGroupId = requestingUserGroupRes.rows.length > 0 ? requestingUserGroupRes.rows[0].group_id : null;

    const resourceCheck = await pool.query('SELECT r.user_id, u.group_id AS owner_group_id FROM resources r JOIN users u ON r.user_id = u.id WHERE r.id = $1', [id]);

    if (resourceCheck.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Resource not found.' }));
        return true;
    }
    
    const resourceOwnerId = resourceCheck.rows[0].user_id;
    const resourceOwnerGroupId = resourceCheck.rows[0].owner_group_id;

    if (resourceOwnerId !== userId && !(requestingUserGroupId && resourceOwnerGroupId && requestingUserGroupId === resourceOwnerGroupId)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: You do not have permission to delete this resource.' }));
        return true;
    }

    const result = await pool.query('DELETE FROM resources WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Resource not found to delete.' }));
    } else {
      res.writeHead(204).end();
    }
    return true;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

module.exports = { handleResources };
