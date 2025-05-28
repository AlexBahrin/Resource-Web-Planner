const pool = require('../config/dbConfig'); 

async function handleGroups(req, res, poolArgument) {
    const currentPool = poolArgument; 

    if (req.method === 'POST' && req.path === '/api/groups') {
        return new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('error', err => {
                console.error('Request stream error in /api/groups POST:', err.message);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Error reading request body.' }));
                }
                resolve(); 
            });
            req.on('end', async () => {
                let name;
                try {
                    try {
                        if (!body) { 
                            if (!res.headersSent) {
                                res.writeHead(400, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'Request body is empty.' }));
                            }
                            resolve();
                            return;
                        }
                        const parsedBody = JSON.parse(body);
                        name = parsedBody.name;
                    } catch (jsonParseError) {
                        console.error('JSON parsing error in /api/groups POST:', jsonParseError.message);
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Invalid JSON in request body.' }));
                        }
                        resolve();
                        return;
                    }

                    if (!name) {
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Group name is required in JSON body (e.g., {"name": "groupName"}).' }));
                        }
                        resolve();
                        return;
                    }

                    try {
                        const result = await currentPool.query(
                            'INSERT INTO groups (name) VALUES ($1) RETURNING id, name, created_at',
                            [name]
                        );
                        const newGroup = result.rows[0];
                        if (!res.headersSent) {
                            res.writeHead(201, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(newGroup));
                        }
                    } catch (dbError) {
                        console.error('DB Error creating group (/api/groups POST):', dbError.message, 'Input name:', name);
                        if (!res.headersSent) {
                            if (dbError.code === '23505' && dbError.constraint === 'groups_name_key') {
                                res.writeHead(409, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: `Group with name '${name}' already exists.` }));
                            } else {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ message: 'Failed to create group on the server (database operation failed).' }));
                            }
                        }
                    }
                } catch (unexpectedError) {
                    console.error('Unexpected error in /api/groups POST req.on(\'end\'):', unexpectedError.message);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'An unexpected server error occurred processing the request.' }));
                    }
                } finally {
                    resolve(); 
                }
            });
        });
    } else if (req.method === 'GET' && req.path === '/api/groups') {
        try {
            const result = await currentPool.query('SELECT id, name FROM groups ORDER BY name');
            if (!res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.rows));
            }
        } catch (error) {
            console.error('Error fetching groups (/api/groups GET):', error.message);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Failed to fetch groups from the server.' }));
            }
        }
    } else if (req.path.startsWith('/api/groups')) {
        if (!res.headersSent) {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: `Method ${req.method} not allowed for ${req.path}` }));
        }
    } else {
        if (!res.headersSent) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Group API endpoint not found by handler (routing logic error).' }));
        }
    }
}

module.exports = { handleGroups };
