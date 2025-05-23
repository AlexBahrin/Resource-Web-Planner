const http = require('http');
const url = require('url');
const { Pool } = require('pg'); 

const port = 8087;

const dbConfig = {
  user: 'postgres',       
  host: 'localhost',
  database: 'rew_db', 
  password: 'admin', 
  port: 5432,
};

const pool = new Pool(dbConfig);

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE
      );
    `);
    console.log('Categories table checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        quantity INTEGER,
        description TEXT,
        added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        low_stock_threshold INTEGER DEFAULT 5
      );
    `);
    console.log('Resources table checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL, -- Store hashed passwords only!
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Optional: if notification is user-specific
        type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('Notifications table checked/created.');

  } catch (err) {
    console.error('Error initializing database tables:', err.stack);
  } finally {
    client.release();
  }
}

initializeDatabase().catch(console.error);

const server = http.createServer(async (req, res) => { 
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  const parseRequestBody = (callback) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        callback(JSON.parse(body));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
      }
    });
  };

  res.setHeader('Content-Type', 'application/json');

  try { 
    // Serve HTML for login page at "/"
    if (path === '/' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Login</title>
          <style>
            body { font-family: Arial; margin: 40px; }
            form { max-width: 300px; margin: auto; }
            input { display: block; margin: 10px 0; width: 100%; padding: 8px; }
            button { padding: 8px 16px; }
            .link { text-align: center; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h2>Login</h2>
          <form method="POST" action="/main">
            <input type="text" name="username" placeholder="Username" required />
            <input type="password" name="password" placeholder="Password" required />
            <button type="submit">Login</button>
          </form>
          <div class="link">
            <a href="/register">Register</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Serve HTML for register page at "/register"
    if (path === '/register' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Register</title>
          <style>
            body { font-family: Arial; margin: 40px; }
            form { max-width: 300px; margin: auto; }
            input { display: block; margin: 10px 0; width: 100%; padding: 8px; }
            button { padding: 8px 16px; }
            .link { text-align: center; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h2>Register</h2>
          <form method="POST" action="/register">
            <input type="text" name="username" placeholder="Username" required />
            <input type="email" name="email" placeholder="Email" required />
            <input type="password" name="password" placeholder="Password" required />
            <button type="submit">Register</button>
          </form>
          <div class="link">
            <a href="/">Back to Login</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Handle register POST
    if (path === '/register' && method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        // Parse x-www-form-urlencoded
        const params = {};
        body.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
        const { username, email, password } = params;
        if (!username || !email || !password) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h3>All fields are required.</h3>');
          return;
        }
        try {
          const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING username',
            [username, email, password]
          );
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<h3>Registration successful. <a href="/">Login here</a>.</h3>`);
        } catch (dbErr) {
          if (dbErr.code === '23505') {
            res.writeHead(409, { 'Content-Type': 'text/html' });
            res.end('<h3>Username or email already exists. <a href="/register">Try again</a>.</h3>');
          } else {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h3>Server error.</h3>');
          }
        }
      });
      return;
    }

    // Handle login POST
    if (path === '/main' && method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        // Parse x-www-form-urlencoded
        const params = {};
        body.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
        const { username, password } = params;
        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h3>Username and password required.</h3>');
          return;
        }
        try {
          const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
          if (result.rows.length === 0) {
            res.writeHead(401, { 'Content-Type': 'text/html' });
            res.end('<h3>Invalid username or password.</h3>');
            return;
          }
          const user = result.rows[0];
          // NOTE: In production, use hashed passwords!
          if (user.password_hash !== password) {
            res.writeHead(401, { 'Content-Type': 'text/html' });
            res.end('<h3>Invalid username or password.</h3>');
            return;
          }
          // Show dashboard with 4 buttons
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Dashboard</title>
              <style>
                body { font-family: Arial; margin: 40px; }
                .container { max-width: 400px; margin: auto; text-align: center; }
                h2 { margin-bottom: 30px; }
                .btn-group { display: flex; flex-direction: column; gap: 15px; }
                .btn-group a {
                  display: block;
                  padding: 14px 0;
                  background: #1976d2;
                  color: #fff;
                  text-decoration: none;
                  border-radius: 6px;
                  font-size: 18px;
                  font-weight: bold;
                  transition: background 0.2s;
                }
                .btn-group a:hover { background: #1565c0; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Welcome, ${user.username}!</h2>
                <div class="btn-group">
                  <a href="/categories">Categories</a>
                  <a href="/resources">Resources</a>
                  <a href="/users">Users</a>
                  <a href="/notifications">Notifications</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h3>Server error.</h3>');
        }
      });
      return;
    }

    // Serve dashboard page at /main (GET)
    if (path === '/main' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Dashboard</title>
          <style>
            body { font-family: Arial; margin: 40px; }
            .container { max-width: 400px; margin: auto; text-align: center; }
            h2 { margin-bottom: 30px; }
            .btn-group { display: flex; flex-direction: column; gap: 15px; }
            .btn-group a {
              display: block;
              padding: 14px 0;
              background: #1976d2;
              color: #fff;
              text-decoration: none;
              border-radius: 6px;
              font-size: 18px;
              font-weight: bold;
              transition: background 0.2s;
            }
            .btn-group a:hover { background: #1565c0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Dashboard</h2>
            <div class="btn-group">
              <a href="/categories">Categories</a>
              <a href="/resources">Resources</a>
              <a href="/users">Users</a>
              <a href="/notifications">Notifications</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    else if (path === '/resources' && method === 'POST') {
      parseRequestBody(async data => {
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
    } else if (path === '/resources' && method === 'GET') {
      const result = await pool.query('SELECT * FROM resources ORDER BY id ASC');
      res.writeHead(200);
      res.end(JSON.stringify(result.rows));
    } else if (path.startsWith('/resources/') && method === 'GET') {
      const id = parseInt(path.split('/')[2]);
      if (isNaN(id)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid resource ID format.' }));
        return;
      }
      const result = await pool.query('SELECT * FROM resources WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Resource not found.' }));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(result.rows[0]));
      }
    } else if (path.startsWith('/resources/') && method === 'PUT') {
      const id = parseInt(path.split('/')[2]);
      if (isNaN(id)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid resource ID format.' }));
        return;
      }
      parseRequestBody(async data => {
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
    } else if (path.startsWith('/resources/') && method === 'DELETE') {
      const id = parseInt(path.split('/')[2]);
      if (isNaN(id)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid resource ID format.' }));
        return;
      }
      const result = await pool.query('DELETE FROM resources WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Resource not found.' }));
      } else {
        res.writeHead(204);
        res.end();
      }
    }
    else if (path === '/categories' && method === 'POST') {
      parseRequestBody(async data => {
        const { name } = data;
        if (!name) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Category name is required.' }));
          return;
        }
        const result = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
        res.writeHead(201);
        res.end(JSON.stringify(result.rows[0]));
      });
    } else if (path === '/categories' && method === 'GET') {
      try {
        const result = await pool.query('SELECT * FROM categories ORDER BY id ASC');
        const categories = result.rows;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Categories</title>
            <style>
              body { font-family: Arial; margin: 40px; }
              .container { max-width: 400px; margin: auto; }
              h2 { margin-bottom: 20px; }
              ul { padding: 0; list-style: none; }
              li { padding: 8px 0; border-bottom: 1px solid #eee; }
              .add-btn {
                display: inline-block;
                margin-bottom: 20px;
                padding: 8px 16px;
                background: #43a047;
                color: #fff;
                border: none;
                border-radius: 4px;
                font-size: 16px;
                cursor: pointer;
                text-decoration: none;
              }
              .add-form { margin-top: 20px; }
              .add-form input[type="text"] {
                padding: 8px;
                width: 70%;
                margin-right: 10px;
              }
              .add-form button {
                padding: 8px 16px;
                background: #1976d2;
                color: #fff;
                border: none;
                border-radius: 4px;
                font-size: 16px;
                cursor: pointer;
              }
              .back-link { display: block; margin-top: 20px; }
            </style>
            <script>
              function showForm() {
                document.getElementById('addForm').style.display = 'block';
                document.getElementById('showAddBtn').style.display = 'none';
              }
            </script>
          </head>
          <body>
            <div class="container">
              <h2>Categories</h2>
              <ul>
                ${categories.map(cat => `<li>${cat.name}</li>`).join('')}
              </ul>
              <button class="add-btn" id="showAddBtn" onclick="showForm()">+ Add Category</button>
              <form id="addForm" class="add-form" method="POST" action="/categories/add" style="display:none;">
                <input type="text" name="name" placeholder="Category name" required />
                <button type="submit">Add</button>
              </form>
              <a class="back-link" href="/main">Back to Dashboard</a>
            </div>
          </body>
          </html>
        `);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h3>Server error loading categories.</h3>');
      }
      return;
    } else if (path.startsWith('/categories/') && method === 'GET') {
      const id = parseInt(path.split('/')[2]);
      if (isNaN(id)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid category ID format.' }));
        return;
      }
      const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Category not found.' }));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(result.rows[0]));
      }
    } else if (path.startsWith('/categories/') && method === 'PUT') {
      const id = parseInt(path.split('/')[2]);
      if (isNaN(id)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid category ID format.' }));
        return;
      }
      parseRequestBody(async data => {
        const { name } = data;
        if (!name) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Category name is required for update.' }));
          return;
        }
        const result = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
        if (result.rows.length === 0) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Category not found.' }));
        } else {
          res.writeHead(200);
          res.end(JSON.stringify(result.rows[0]));
        }
      });
    } else if (path.startsWith('/categories/') && method === 'DELETE') {
      const id = parseInt(path.split('/')[2]);
       if (isNaN(id)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid category ID format.' }));
        return;
      }
      const resourcesUsingCategory = await pool.query('SELECT id FROM resources WHERE category_id = $1 LIMIT 1', [id]);
      if (resourcesUsingCategory.rows.length > 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Cannot delete category: It is currently in use by one or more resources.' }));
        return;
      }
      const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Category not found.' }));
      } else {
        res.writeHead(204);
        res.end();
      }
    } else if (path === '/categories/add' && method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        const params = {};
        body.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
        const { name } = params;
        if (!name) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h3>Category name is required. <a href="/categories">Back</a></h3>');
          return;
        }
        try {
          await pool.query('INSERT INTO categories (name) VALUES ($1)', [name]);
          res.writeHead(302, { Location: '/categories' });
          res.end();
        } catch (dbErr) {
          let msg = 'Server error.';
          if (dbErr.code === '23505') {
            msg = 'Category already exists.';
          }
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h3>${msg} <a href="/categories">Back</a></h3>`);
        }
      });
      return;
    }
    else if (path === '/users' && method === 'POST') {
      parseRequestBody(async data => {
        const { username, email, password } = data; 
        if (!username || !email || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Username, email, and password are required.' }));
          return;
        }
        const password_hash = password; 
        try {
            const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
            [username, email, password_hash]
            );
            res.writeHead(201);
            res.end(JSON.stringify(result.rows[0]));
        } catch(dbErr) {
             if (dbErr.code === '23505') { 
                res.writeHead(409); 
                res.end(JSON.stringify({ error: 'Username or email already exists.', detail: dbErr.detail }));
            } else {
                console.error('DB Error on POST /users:', dbErr);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Database error creating user.' }));
            }
        }
      });
    } else if (path === '/users' && method === 'GET') {
      const result = await pool.query('SELECT id, username, email, created_at FROM users ORDER BY id ASC');
      res.writeHead(200);
      res.end(JSON.stringify(result.rows));
    } else if (path.startsWith('/users/') && method === 'GET') {
      const id = parseInt(path.split('/')[2]);
      if (isNaN(id)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid user ID format.' }));
        return;
      }
      const result = await pool.query('SELECT id, username, email, created_at FROM users WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'User not found.' }));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(result.rows[0]));
      }
    }
    else if (path === '/notifications' && method === 'GET') {
      const result = await pool.query('SELECT * FROM notifications WHERE is_read = FALSE ORDER BY created_at DESC');
      res.writeHead(200);
      res.end(JSON.stringify(result.rows));
    } else if (path.startsWith('/notifications/') && method === 'GET') { 
      const id = parseInt(path.split('/')[2]);
      if (isNaN(id)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid notification ID format.' }));
        return;
      }
      const result = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Notification not found.' }));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(result.rows[0]));
      }
    } else if (path.startsWith('/notifications/') && method === 'PUT') { 
      const id = parseInt(path.split('/')[2]);
      if (isNaN(id)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid notification ID format.' }));
        return;
      }
      const result = await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Notification not found to mark as read.' }));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(result.rows[0]));
      }
    } else if (path.startsWith('/notifications/') && method === 'DELETE') { 
      const id = parseInt(path.split('/')[2]);
      if (isNaN(id)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid notification ID format.' }));
        return;
      }
      const result = await pool.query('DELETE FROM notifications WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Notification not found.' }));
      } else {
        res.writeHead(204);
        res.end();
      }
    }
    else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Route not found' }));
    }
  } catch (err) {
    console.error('Unhandled error in request handler:', err.stack);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error', details: err.message }));
    }
  }
});

server.listen(port, () => {
  console.log(`Inventory Management System listening at http://localhost:${port}`);
});

process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await pool.end();
  console.log('PostgreSQL pool has ended');
  server.close(() => {
    console.log('Server shut down gracefully.');
    process.exit(0);
  });
});

module.exports = server;

