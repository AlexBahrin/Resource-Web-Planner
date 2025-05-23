const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const pool = require('./config/dbConfig');
const { initializeDatabase } = require('./db/init');
const { handleLogin, handleRegister, handleDashboard } = require('./routes/auth');
const { handleCategories } = require('./routes/categories'); // Re-add handleCategories
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

  // Set Content-Type only for API endpoints that return JSON
  // HTML page routes will set their own Content-Type

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

    // API Routes - Handle these first
    if (pathname.startsWith('/api/')) {
      // Specific API handlers will set their own Content-Type: application/json
      if (pathname.startsWith('/api/categories')) { // Re-add /api/categories route
        if (await handleCategories(req, res)) return;
      } else if (pathname.startsWith('/api/users')) { // Adjusted else-if
        if (await handleUsers(req, res)) return;
      } else if (pathname.startsWith('/api/resources')) {
        if (await handleResources(req, res)) return;
      } else if (pathname.startsWith('/api/notifications')) {
        if (await handleNotifications(req, res)) return;
      }
      // If an API route is not handled by a specific handler, it will fall through to the final 404
      // and we should ensure it returns JSON for consistency if it was an /api/ path
      if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
      }
      return; // Ensure no further processing for /api/ routes
    }
    // HTML Page Routes & other non-API resource-specific routes
    else if (pathname === '/categories' && method === 'GET') { // Re-add /categories HTML page route
      res.setHeader('Content-Type', 'text/html');
      res.end(require('./views/templates').categoriesPage()); // Use the new basic categoriesPage function
      return;
    } 
    // Remove the old else if (pathname.startsWith('/categories')) block that called handleCategories for non-API routes,
    // as handleCategories is now focused on /api/ routes.
    // Any other /categories/* routes (e.g. for specific category pages, edit forms served via HTML) would need new, specific handlers.
    // For now, only /categories (GET for HTML) and /api/categories (GET, POST for data) are handled.
    
    else if (pathname === '/resources' && method === 'GET') { 
      serveResourcesPage(req, res); // Serves HTML page, sets Content-Type: text/html
      return;
    } else if (pathname.startsWith('/resources')) {
      // Ensure handleResources sets appropriate Content-Type for non-JSON responses if any
      if (await handleResources(req, res)) return;
    }
    else if (pathname === '/users' && method === 'GET') {
      serveUsersPage(req, res); // Serves HTML page, sets Content-Type: text/html
      return;
    } else if (pathname.startsWith('/users')) {
      // Ensure handleUsers sets appropriate Content-Type for non-JSON responses if any
      if (await handleUsers(req, res)) return;
    }
    else if (pathname === '/notifications' && method === 'GET') {
      serveNotificationsPage(req, res); // Serves HTML page, sets Content-Type: text/html
      return;
    } else if (pathname.startsWith('/notifications')) {
      // This was previously problematic. 
      // PUT /notifications/:id should be /api/notifications/:id and handled above.
      // If we reach here for /notifications/* and it's not GET for the HTML page,
      // it's likely an error or a non-API endpoint that needs specific handling.
      // For now, let it fall through or be explicitly handled if such routes exist.
      // The handleNotifications function is now expected to only handle /api/notifications/*
      // So, this block might not be strictly necessary if all non-page /notifications routes are API routes.
      // However, if there are form submissions to /notifications (e.g. POST) that aren't API calls, they'd be caught here.
      // Let's assume for now that handleNotifications is ONLY for /api/ routes.
      // Any other /notifications/* would be an error or a different handler.
    }
    
    // If we get here, no specific route matched
    // For non-API routes, a generic 404 is fine. For API routes, it's handled above.
    if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'application/json' }); // Default to JSON for unhandled routes for safety
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
