const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');

async function handleUsers(req, res) {
  const path = req.path;
  const method = req.method;
  const userId = req.userId; 

  if (path === '/api/users/me' && method === 'GET') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }
    try {
      const result = await pool.query('SELECT id, username, email, role, group_id FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found.' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows[0]));
      }
    } catch (dbErr) {
      console.error('DB Error on GET /api/users/me:', dbErr);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error fetching user details.' }));
    }
    return true;
  }

  if (path === '/api/users/me/join-group' && method === 'PUT') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }
    const data = await parseJsonBody(req, res);
    if (!data || typeof data.groupId !== 'number') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Group ID is required and must be a number.' }));
      return true;
    }
    try {
      const groupExists = await pool.query('SELECT id FROM groups WHERE id = $1', [data.groupId]);
      if (groupExists.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Group not found.' }));
        return true;
      }
      const result = await pool.query(
        'UPDATE users SET group_id = $1 WHERE id = $2 RETURNING id, username, group_id',
        [data.groupId, userId]
      );
      if (result.rowCount === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found or no update made.' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Successfully joined group.', user: result.rows[0] }));
      }
    } catch (dbErr) {
      console.error('DB Error on PUT /api/users/me/join-group:', dbErr);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error joining group.' }));
    }
    return true;
  }

  if (path === '/api/users/me/exit-group' && method === 'PUT') {
    if (!userId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not authenticated.' }));
      return true;
    }
    try {
      await pool.query('BEGIN');

      const userQuery = await pool.query('SELECT group_id FROM users WHERE id = $1', [userId]);
      if (userQuery.rows.length === 0) {
        await pool.query('ROLLBACK');
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found.' }));
        return true;
      }
      const originalGroupId = userQuery.rows[0].group_id;

      if (!originalGroupId) {
        await pool.query('ROLLBACK');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const currentUserState = await pool.query('SELECT id, username, group_id FROM users WHERE id = $1', [userId]);
        res.end(JSON.stringify({ message: 'User is not currently in any group.', user: currentUserState.rows[0] || { id: userId, group_id: null } }));
        return true;
      }

      const otherMembersQuery = await pool.query(
        'SELECT id FROM users WHERE group_id = $1 AND id != $2 ORDER BY id ASC LIMIT 1',
        [originalGroupId, userId]
      );

      let resourceTransferMessage = "";
      if (otherMembersQuery.rows.length > 0) {
        const newOwnerId = otherMembersQuery.rows[0].id;
        const resourceUpdateResult = await pool.query(
          'UPDATE resources SET user_id = $1 WHERE user_id = $2',
          [newOwnerId, userId]
        );
        if (resourceUpdateResult.rowCount > 0) {
            resourceTransferMessage = `All ${resourceUpdateResult.rowCount} resource(s) transferred to user ${newOwnerId}.`;
            console.log(`Resources of user ${userId} (${resourceUpdateResult.rowCount} resources) transferred to user ${newOwnerId} as part of leaving group ${originalGroupId}.`);
        } else {
            resourceTransferMessage = `User ${userId} had no resources to transfer to user ${newOwnerId}.`;
            console.log(`User ${userId} had no resources to transfer to user ${newOwnerId} upon leaving group ${originalGroupId}.`);
        }
      } else {
        resourceTransferMessage = "User is the last member, resources retained.";
        console.log(`User ${userId} is the last member of group ${originalGroupId}, retains their resources.`);
      }

      const updateUserResult = await pool.query(
        'UPDATE users SET group_id = NULL WHERE id = $1 RETURNING id, username, group_id',
        [userId]
      );

      const groupMembersQuery = await pool.query('SELECT COUNT(*) AS member_count FROM users WHERE group_id = $1', [originalGroupId]);
      const memberCount = parseInt(groupMembersQuery.rows[0].member_count, 10);
      let groupStatusMessage = "";

      if (memberCount === 0) {
        await pool.query('DELETE FROM groups WHERE id = $1', [originalGroupId]);
        groupStatusMessage = `Group ${originalGroupId} was deleted as it became empty.`;
        console.log(`Group ${originalGroupId} deleted as it has no more members after user ${userId} left.`);
      } else {
        groupStatusMessage = `Group ${originalGroupId} now has ${memberCount} member(s).`;
      }

      await pool.query('COMMIT');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: `Successfully exited group. ${resourceTransferMessage} ${groupStatusMessage}`,
        user: updateUserResult.rows[0]
      }));

    } catch (dbErr) {
      await pool.query('ROLLBACK');
      console.error('DB Error on PUT /api/users/me/exit-group:', dbErr);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database error exiting group.' }));
    }
    return true;
  }
  
  if (path === '/api/users/register' && method === 'POST') { 
    parseJsonBody(req, res, async data => {
      const { username, email, password } = data; 
      if (!username || !email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username, email, and password are required.' }));
        return;
      }
      const password_hash = password; 
      try {
        const result = await pool.query(
          'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
          [username, email, password_hash]
        );
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows[0]));
      } catch(dbErr) {
        if (dbErr.code === '23505') { 
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username or email already exists.', detail: dbErr.detail }));
        } else {
          console.error('DB Error on POST /users:', dbErr);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database error creating user.' }));
        }
      }
    });
    return true;
  }
  
  if (path === '/api/users' && method === 'GET') {
    try {
        const result = await pool.query('SELECT id, username, email, role, group_id FROM users ORDER BY id ASC');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
    } catch (dbErr) {
        console.error('DB Error on GET /api/users:', dbErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database error fetching all users.' }));
    }
    return true;
  }
  
  if (path.startsWith('/api/users/') && method === 'GET' && path !== '/api/users/me' && !path.endsWith('/register')) {
    const id = parseInt(path.split('/')[3]);
    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid user ID format.' }));
      return true;
    }
    try {
        const result = await pool.query('SELECT id, username, email, role, group_id FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User not found.' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result.rows[0]));
        }
    } catch (dbErr) {
        console.error(`DB Error on GET /api/users/${id}:`, dbErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database error fetching user.' }));
    }
    return true;
  }
  
  return false;
}

module.exports = { handleUsers };
