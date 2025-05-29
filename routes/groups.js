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
                        await currentPool.query('BEGIN');

                        const groupResult = await currentPool.query(
                            'INSERT INTO groups (name) VALUES ($1) RETURNING id, name, created_at',
                            [name]
                        );
                        const newGroup = groupResult.rows[0];

                        if (req.userId) {
                            await currentPool.query(
                                'UPDATE users SET group_id = $1 WHERE id = $2',
                                [newGroup.id, req.userId]
                            );
                            console.log(`User ${req.userId} automatically added to new group ${newGroup.id}`);
                        } else {
                            console.warn('No userId found in request, cannot add creator to group automatically.');
                        }

                        await currentPool.query('COMMIT');

                        if (!res.headersSent) {
                            res.writeHead(201, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ ...newGroup, message: `Group created and user ${req.userId} added.` }));
                        }
                    } catch (dbError) {
                        await currentPool.query('ROLLBACK');
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
    } else if (req.method === 'GET' && req.path.startsWith('/api/groups/') && req.path.split('/').length === 4 && !isNaN(parseInt(req.path.split('/')[3]))) {
        const groupId = parseInt(req.path.split('/')[3]);
        try {
            const groupInfoResult = await currentPool.query('SELECT id, name FROM groups WHERE id = $1', [groupId]);
            if (groupInfoResult.rows.length === 0) {
                if (!res.headersSent) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Group not found.' }));
                }
                return;
            }
            const group = groupInfoResult.rows[0];

            const membersResult = await currentPool.query('SELECT username FROM users WHERE group_id = $1 ORDER BY username ASC', [groupId]);
            group.members = membersResult.rows.map(row => row.username);

            if (!res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(group));
            }
        } catch (error) {
            console.error(`Error fetching group details for ID ${groupId} (/api/groups/:id GET):`, error.message);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Failed to fetch group details from the server.' }));
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
