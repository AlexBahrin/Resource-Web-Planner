const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const pool = require('./config/dbConfig');
const { initializeDatabase } = require('./db/init');
const { handleLogin, handleRegister, handleDashboard } = require('./routes/auth');
const { handleCategories } = require('./routes/categories');
const { handleResources } = require('./routes/resources');
const { handleUsers } = require('./routes/users');
const { handleNotifications } = require('./routes/notifications');
const { serveResourcesPage, serveUsersPage, serveNotificationsPage } = require('./routes/pages');

const port = 8087;

// Initialize the database
initializeDatabase().catch(console.error);

// Function to serve static files
function serveStaticFile(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }
    
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (ext) {
      case '.css':
        contentType = 'text/css';
        break;
      case '.js':
        contentType = 'text/javascript';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// Create the HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  
  // Add path and method to req object for route handlers
  req.path = pathname;
  req.method = method;

  // Set default Content-Type to JSON
  res.setHeader('Content-Type', 'application/json');

  try {
    // Check if the request is for a static file
    if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
      const filePath = path.join(__dirname, 'public', pathname);
      serveStaticFile(req, res, filePath);
      return;
    }
    
    // Route handling
    // Auth routes
    if (pathname === '/' && method === 'GET') {
      handleLogin(req, res);
      return;
    }
    
    if (pathname === '/register' && (method === 'GET' || method === 'POST')) {
      handleRegister(req, res);
      return;
    }
    
    if (pathname === '/main' && (method === 'GET' || method === 'POST')) {
      if (method === 'GET') {
        handleDashboard(req, res);
      } else {
        handleLogin(req, res); // POST to /main is login
      }
      return;
    }
    
    // Categories routes
    if (pathname.startsWith('/categories')) {
      const handled = await handleCategories(req, res);
      if (handled) return;
    }
    
    // Resources routes
    if (pathname === '/resources' && method === 'GET') {
      serveResourcesPage(req, res);
      return;
    }
    
    if (pathname.startsWith('/resources')) {
      const handled = await handleResources(req, res);
      if (handled) return;
    }
    
    // Users routes
    if (pathname === '/users' && method === 'GET') {
      serveUsersPage(req, res);
      return;
    }
    
    if (pathname.startsWith('/users')) {
      const handled = await handleUsers(req, res);
      if (handled) return;
    }
    
    // Notifications routes
    if (pathname === '/notifications' && method === 'GET') {
      serveNotificationsPage(req, res);
      return;
    }
    
    if (pathname.startsWith('/notifications')) {
      const handled = await handleNotifications(req, res);
      if (handled) return;
    }
    
    // If we get here, no route matched
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Route not found' }));
    
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
