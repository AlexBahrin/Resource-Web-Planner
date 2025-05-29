const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const pool = require('./config/dbConfig');

// Configure pg to parse DATE columns as YYYY-MM-DD strings
const { types } = require('pg');
types.setTypeParser(types.builtins.DATE, val => val);

const { initializeDatabase } = require('./db/init');
const { handleLogin, handleRegister, handleDashboard, handleLogout, sessions } = require('./routes/auth');
const { handleCategories } = require('./routes/categories');
const { handleResources } = require('./routes/resources');
const { handleUsers } = require('./routes/users');
const { handleNotifications } = require('./routes/notifications');
const { handleGroups } = require('./routes/groups');
const { handleStatistics } = require('./routes/statistics');
const { serveResourcesPage, serveUsersPage, serveNotificationsPage, serveStatisticsPage } = require('./routes/pages');
const { startExpirationChecker } = require('./tasks/expirationChecker'); // Added import
const { startLowStockChecker } = require('./tasks/lowStockChecker'); // Added import

const port = 8087;

initializeDatabase()
    .then(() => {
        console.log('Database initialized successfully.');
        // Start the expiration checker after database is initialized
        startExpirationChecker(60 * 24); // Run once a day
        // Or for testing, run more frequently, e.g., every 1 minute:
        // startExpirationChecker(1);

        // Start the low stock checker after database is initialized
        startLowStockChecker(60 * 24); // Run once a day (every 24 hours)
        // Or for testing, run more frequently, e.g., every 1 minute:
        // startLowStockChecker(1);
    })
    .catch(err => {
        console.error('Failed to initialize database or start tasks:', err);
        process.exit(1); // Exit if DB init fails
    });

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

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  
  req.path = pathname;
  req.method = method;
  req.query = parsedUrl.query;

  req.userId = null;
  req.username = null;
  const cookies = req.headers.cookie;
  if (cookies) {
    const sessionIdCookie = cookies.split(';').find(c => c.trim().startsWith('sessionId='));
    if (sessionIdCookie) {
      const sessionId = sessionIdCookie.split('=')[1];
      const session = sessions[sessionId];
      if (session && session.expires > Date.now()) {
        req.userId = session.userId;
        req.username = session.username;
      } else if (session) {
        delete sessions[sessionId];
      }
    }
  }

  try {
    if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
      const filePath = path.join(__dirname, 'public', pathname);
      serveStaticFile(req, res, filePath);
      return;
    }
    
    if (pathname === '/' && method === 'GET') {
      if (req.userId) {
        res.writeHead(302, { 'Location': '/main' });
        res.end();
      } else {
        handleLogin(req, res);
      }
      return;
    } else if (pathname === '/' && method === 'POST') {
      handleLogin(req, res);
      return;
    }

    if (pathname === '/logout' && method === 'POST') {
        handleLogout(req, res);
        return;
    }
    
    if (pathname === '/register' && (method === 'GET' || method === 'POST')) {
      handleRegister(req, res);
      return;
    }
    
    if (pathname === '/main' || pathname.startsWith('/api/') || pathname === '/categories' || pathname === '/resources' || pathname === '/users' || pathname === '/notifications' || pathname === '/statistics') {
      const sessionId = req.headers.cookie?.split(';').find(c => c.trim().startsWith('sessionId='))?.split('=')[1];
      const session = sessions[sessionId];

      if (!session || session.expires < Date.now()) {
        if (pathname.startsWith('/api/')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized. Please log in.' }));
        } else {
            res.writeHead(302, { 'Location': '/' });
            res.end();
        }
        return;
      }
      req.userId = session.userId;
      req.username = session.username;
      req.userRole = session.role; 
      console.log(`User ${req.username} (ID: ${req.userId}, Role: ${req.userRole}) authenticated for ${method} ${pathname}`);
    }

    if (pathname === '/main' && method === 'GET') {
      handleDashboard(req, res);
      return;
    }
    
    // Handle import endpoint first as a special case
    if (pathname === '/api/resources/import') {
      console.log('Handling import request to', pathname);
      const result = await handleResources(req, res);
      console.log('Import handler result:', result);
      // Always return after handling import request
      return;
    }
    
    // Handle export endpoint as a special case
    if (pathname === '/api/resources/export') {
      console.log('Handling export request to', pathname);
      const result = await handleResources(req, res);
      console.log('Export handler result:', result);
      // Always return after handling export request
      return;
    }

    if (pathname.startsWith('/api/')) {
      let handled = false;
      
      // Handle other API routes
      if (pathname.startsWith('/api/categories')) {
        handled = await handleCategories(req, res);
      } else if (pathname.startsWith('/api/resources')) {
        handled = await handleResources(req, res);
      } else if (pathname.startsWith('/api/users')) {
        handled = await handleUsers(req, res);
      } else if (pathname.startsWith('/api/notifications')) {
        handled = await handleNotifications(req, res);
      } else if (pathname.startsWith('/api/groups')) {
        handled = await handleGroups(req, res, pool); // Pass the pool object here
      } else if (pathname.startsWith('/api/statistics')) {
        handled = await handleStatistics(req, res);
      }
      
      if (!handled && !res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
      }
      
      // Return after API handling to prevent further processing
      return;
    }
    else if (pathname === '/categories' && method === 'GET') {
      res.setHeader('Content-Type', 'text/html');
      res.end(require('./views/templates').categoriesPage());
      return;
    } 
    
    else if (pathname === '/resources' && method === 'GET') { 
      serveResourcesPage(req, res);
      return;
    } else if (pathname.startsWith('/resources')) {
      const handled = await handleResources(req, res);
      if (handled) return;
    }
    else if (pathname === '/users' && method === 'GET') {
      serveUsersPage(req, res);
      return;
    } else if (pathname.startsWith('/users')) {
      if (await handleUsers(req, res)) return;
    }
    else if (pathname === '/notifications' && method === 'GET') {
      serveNotificationsPage(req, res);
      return;
    } else if (pathname.startsWith('/notifications')) {
    }
    else if (pathname === '/statistics' && method === 'GET') {
      serveStatisticsPage(req, res);
      return;
    }
    
    if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
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
