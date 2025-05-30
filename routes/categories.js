const pool = require('../config/dbConfig.js');
const { authenticateToken } = require('./auth');
const { URL } = require('url');
const { parseJsonBody } = require('../util/requestUtils');


async function handleCategories(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/api/categories' && req.method === 'GET') {
        return new Promise((resolve, reject) => {
            authenticateToken(req, res, async () => {
                console.log(`[DEBUG /api/categories GET handler] Entered. req.url: ${req.url}, res.headersSent: ${res.headersSent}, res.writableEnded: ${res.writableEnded}`);
                if (res.headersSent) {
                    console.error(`[DEBUG /api/categories GET] Headers already sent when callback began. req.url: ${req.url}. Bailing out.`);
                    return reject(new Error("Headers already sent when GET /api/categories callback began."));
                }
                try {
                    const result = await pool.query('SELECT id, name, enable_quantity, enable_low_stock_threshold, enable_expiration_date FROM categories ORDER BY name');
                    
                    if (res.headersSent) {
                        console.error(`[DEBUG /api/categories GET] Headers were sent after pool.query but before res.writeHead(200). req.url: ${req.url}. Bailing out.`);
                        return reject(new Error("Headers sent after pool.query in GET /api/categories."));
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result.rows));
                    resolve();
                } catch (err) {
                    console.error(`[DEBUG /api/categories GET] Caught an unexpected error: ${err.message}. req.url: ${req.url}. Stack: ${err.stack}`);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Error fetching categories', error: err.message }));
                    }
                    reject(err);
                }
            });
        });
    } else if (pathname === '/api/categories' && req.method === 'POST') {
        return new Promise((resolve, reject) => {
            authenticateToken(req, res, async () => { 
                if (res.headersSent) {
                    console.error('[DEBUG /api/categories POST] Headers already sent before processing authenticated request.');
                    return reject(new Error("Headers sent before POST /api/categories processing"));
                }
                try {
                    const params = await parseJsonBody(req, res); 
                    if (params === null) { 
                        return resolve(); 
                    }
                    const { name, enable_quantity, enable_low_stock_threshold, enable_expiration_date } = params;
                    if (!name || name.trim() === '') {
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Category name is required.' }));
                        }
                        return reject(new Error("Category name is required."));
                    }
                    try {
                        const result = await pool.query(
                            'INSERT INTO categories (name, enable_quantity, enable_low_stock_threshold, enable_expiration_date) VALUES ($1, $2, $3, $4) RETURNING id, name, enable_quantity, enable_low_stock_threshold, enable_expiration_date',
                            [name.trim(), !!enable_quantity, !!enable_low_stock_threshold, !!enable_expiration_date]
                        );
                        if (!res.headersSent) {
                            res.writeHead(201, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(result.rows[0]));
                        }
                        resolve();
                    } catch (dbErr) {
                        console.error('Error creating category:', dbErr.message);
                        if (!res.headersSent) {
                            if (dbErr.code === '23505') {
                                res.writeHead(409, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'A category with this name already exists.' }));
                            } else {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'Error creating category', error: dbErr.message }));
                            }
                        }
                        reject(dbErr);
                    }
                } catch (err) { 
                    console.error('Error processing POST /api/categories (outer try-catch):', err);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Error processing request.' }));
                    }
                    reject(err);
                }
            });
        });
    } else if (pathname.startsWith('/api/categories/') && req.method === 'PUT') {
        return new Promise((resolve, reject) => {
            authenticateToken(req, res, async () => { 
                if (res.headersSent) {
                    console.error('[DEBUG /api/categories/:id PUT] Headers already sent');
                    return reject(new Error("Headers sent before PUT /api/categories/:id processing"));
                }
                const categoryId = pathname.split('/')[3];
                if (!categoryId || isNaN(parseInt(categoryId))) {
                    if (!res.headersSent) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Invalid or missing category ID in URL.' }));
                    }
                    return reject(new Error("Invalid category ID for PUT."));
                }

                try {
                    const params = await parseJsonBody(req, res); 
                    if (params === null) { 
                        return resolve(); 
                    }
                    const { name, enable_quantity, enable_low_stock_threshold, enable_expiration_date } = params;
                    if (!name || name.trim() === '') {
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Category name is required.' }));
                        }
                        return reject(new Error("Category name is required for PUT."));
                    }
                    try {
                        const result = await pool.query(
                            'UPDATE categories SET name = $1, enable_quantity = $2, enable_low_stock_threshold = $3, enable_expiration_date = $4 WHERE id = $5 RETURNING id, name, enable_quantity, enable_low_stock_threshold, enable_expiration_date',
                            [name.trim(), !!enable_quantity, !!enable_low_stock_threshold, !!enable_expiration_date, parseInt(categoryId)]
                        );
                        if (result.rowCount === 0) {
                            if (!res.headersSent) {
                                res.writeHead(404, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'Category not found for update.' }));
                            }
                            return reject(new Error("Category not found for PUT update."));
                        }
                        if (!res.headersSent) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(result.rows[0]));
                        }
                        resolve();
                    } catch (dbErr) {
                        console.error('Error updating category:', dbErr.message);
                        if (!res.headersSent) {
                            if (dbErr.code === '23505') {
                                res.writeHead(409, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'A category with this name already exists.' }));
                            } else {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'Error updating category', error: dbErr.message }));
                            }
                        }
                        reject(dbErr);
                    }
                } catch (err) { 
                    console.error('Error processing PUT /api/categories/:id (outer try-catch):', err);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Error processing request.' }));
                    }
                    reject(err);
                }
            });
        });
    } else if (pathname.startsWith('/api/categories/') && req.method === 'DELETE') {
        return new Promise((resolve, reject) => {
            authenticateToken(req, res, async () => {
                if (res.headersSent) {
                    console.error('[DEBUG /api/categories/:id DELETE] Headers already sent');
                    return reject(new Error("Headers sent before DELETE /api/categories/:id processing"));
                }
                const categoryId = pathname.split('/')[3];
                if (!categoryId || isNaN(parseInt(categoryId))) {
                    if (!res.headersSent) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Invalid or missing category ID in URL.' }));
                    }
                    return reject(new Error("Invalid category ID for DELETE."));
                }

                try {
                    const resourceCheckQuery = 'SELECT id FROM resources WHERE category_id = $1 LIMIT 1';
                    const resourceCheckResult = await pool.query(resourceCheckQuery, [categoryId]);

                    if (resourceCheckResult.rows.length > 0) {
                        if (!res.headersSent) {
                            res.writeHead(409, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Cannot delete category: it is currently in use by one or more resources.' }));
                        }
                        return resolve(true);
                    }

                    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [parseInt(categoryId)]);
                    if (result.rowCount === 0) {
                        if (!res.headersSent) {
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Category not found for deletion.' }));
                        }
                        return reject(new Error("Category not found for DELETE."));
                    }
                    if (!res.headersSent) {
                        res.writeHead(204); 
                        res.end();
                    }
                    resolve();
                } catch (err) {
                    console.error('Error processing DELETE /api/categories/:id:', err);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Error processing request.' }));
                    }
                    reject(err);
                }
            });
        });
    } else {
        return new Promise((resolve, reject) => {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Not Found' }));
            resolve();
        });
    }
}

module.exports = { handleCategories };
