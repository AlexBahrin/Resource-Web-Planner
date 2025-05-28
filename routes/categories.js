const pool = require('../config/dbConfig.js');
const { authenticateToken } = require('./auth');
const { URL } = require('url');


function parseJsonBody(req, callback) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('error', (err) => {
        callback(err, null);
    });
    req.on('end', () => {
        try {
            if (body) {
                const parsed = JSON.parse(body);
                callback(null, parsed);
            } else {
                callback(null, {});            }
        } catch (e) {
            callback(e, null);
        }
    });
}

async function handleCategories(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/api/groups' && req.method === 'GET') {
        try {
            const result = await pool.query('SELECT id, name, created_at FROM groups ORDER BY name');
            if (!res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.rows));
            } else {
                console.error('[DEBUG /api/groups GET] Attempted to send response, but headers already sent.');
            }
        } catch (err) {
            console.error('Error fetching groups:', err.message);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
            }
        }
    } else if (pathname === '/api/groups' && req.method === 'POST') {
        return new Promise((resolve, reject) => {
            authenticateToken(req, res, () => { 
                if (res.headersSent) {
                    console.error('[DEBUG /api/groups POST] Headers already sent before processing authenticated request.');
                    return reject(new Error("Headers sent before POST /api/groups processing"));
                }
                parseJsonBody(req, async (err, params) => {
                    if (err) {
                        console.error('Error parsing JSON body for POST /api/groups:', err);
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Invalid JSON in request body.' }));
                        }
                        return reject(err);
                    }

                    const { name } = params;
                    if (!name || name.trim() === '') {
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Group name is required.' }));
                        }
                        return reject(new Error("Group name is required."));
                    }

                    try {
                        const result = await pool.query(
                            'INSERT INTO groups (name) VALUES ($1) RETURNING id, name, created_at',
                            [name.trim()]
                        );
                        if (!res.headersSent) {
                            res.writeHead(201, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(result.rows[0]));
                        }
                        resolve();
                    } catch (dbErr) {
                        console.error('Error creating group:', dbErr.message);
                        if (!res.headersSent) {
                            if (dbErr.code === '23505') { 
                                res.writeHead(409, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'A group with this name already exists.' }));
                            } else {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'Error creating group', error: dbErr.message }));
                            }
                        }
                        reject(dbErr);
                    }
                });
            });
        });
    } else if (pathname === '/api/categories' && req.method === 'GET') {
        return new Promise((resolve, reject) => {
            authenticateToken(req, res, async () => {
                console.log(`[DEBUG /api/categories GET handler] Entered. req.url: ${req.url}, res.headersSent: ${res.headersSent}, res.writableEnded: ${res.writableEnded}`);
                if (res.headersSent) {
                    console.error(`[DEBUG /api/categories GET] Headers already sent when callback began. req.url: ${req.url}. Bailing out.`);
                    return reject(new Error("Headers already sent when GET /api/categories callback began."));
                }
                try {
                    const result = await pool.query('SELECT id, name FROM categories ORDER BY name');
                    
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
            authenticateToken(req, res, () => {
                if (res.headersSent) {
                    console.error('[DEBUG /api/categories POST] Headers already sent before processing authenticated request.');
                    return reject(new Error("Headers sent before POST /api/categories processing"));
                }
                parseJsonBody(req, async (err, params) => {
                    if (err) {
                        console.error('Error parsing JSON body for POST /api/categories:', err);
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Invalid JSON in request body.' }));
                        }
                        return reject(err);
                    }
                    const { name } = params;
                    if (!name || name.trim() === '') {
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Category name is required.' }));
                        }
                        return reject(new Error("Category name is required."));
                    }
                    try {
                        const result = await pool.query(
                            'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
                            [name.trim()]
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
                });
            });
        });
    } else if (pathname.startsWith('/api/categories/') && req.method === 'PUT') {
        return new Promise((resolve, reject) => {
            authenticateToken(req, res, () => {
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

                parseJsonBody(req, async (err, params) => {
                    if (err) {
                        console.error('Error parsing JSON body for PUT /api/categories/:id:', err);
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Invalid JSON in request body.' }));
                        }
                        return reject(err);
                    }
                    const { name } = params;
                    if (!name || name.trim() === '') {
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Category name is required.' }));
                        }
                        return reject(new Error("Category name is required for PUT."));
                    }
                    try {
                        const result = await pool.query(
                            'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name',
                            [name.trim(), parseInt(categoryId)]
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
                            if (dbErr.code === '23505') { // Unique constraint violation
                                res.writeHead(409, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'A category with this name already exists.' }));
                            } else {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'Error updating category', error: dbErr.message }));
                            }
                        }
                        reject(dbErr);
                    }
                });
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
                    const result = await pool.query('DELETE FROM categories WHERE id = $1', [parseInt(categoryId)]);
                    if (result.rowCount === 0) {
                        if (!res.headersSent) {
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Category not found for deletion.' }));
                        }
                        return reject(new Error("Category not found for DELETE."));
                    }
                    if (!res.headersSent) {
                        res.writeHead(204, { 'Content-Type': 'application/json' }); // No Content
                        res.end();
                    }
                    resolve();
                } catch (dbErr) {
                    console.error('Error deleting category:', dbErr.message);
                    if (!res.headersSent) {
                        if (dbErr.code === '23503') { 
                            res.writeHead(409, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Cannot delete category as it is referenced by other resources.', error: dbErr.detail }));
                        } else {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Error deleting category', error: dbErr.message }));
                        }
                    }
                    reject(dbErr);
                }
            });
        });
    } else {
        console.log(`[DEBUG categories.js] Path ${pathname} with method ${req.method} not handled by specific /api routes.`);
        if (!res.headersSent) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: `Endpoint ${req.method} ${pathname} not found or not handled by this module.` }));
        } else {
            console.error(`[DEBUG categories.js] Cannot send 404 for ${pathname}; headers already sent.`);
        }
    }
}

module.exports = { handleCategories };
