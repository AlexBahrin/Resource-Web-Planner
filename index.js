const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const pool = require('./config/dbConfig');
const { initializeDatabase } = require('./db/init');
const { handleLogin, handleRegister, handleDashboard, handleLogout, sessions } = require('./routes/auth');
const { handleCategories } = require('./routes/categories');
const { handleResources } = require('./routes/resources');
const { handleUsers } = require('./routes/users');
const { handleNotifications } = require('./routes/notifications');
const { serveResourcesPage, serveUsersPage, serveNotificationsPage } = require('./routes/pages');

const port = 8087;

initializeDatabase().catch(console.error);

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
    
    if (pathname === '/main' || pathname.startsWith('/api/') || pathname === '/categories' || pathname === '/resources' || pathname === '/users' || pathname === '/notifications') {
      if (!req.userId && pathname !== '/api/users' && !(pathname === '/api/categories' && method === 'GET') && !(pathname === '/api/resources' && method === 'GET')) {
        if (pathname.startsWith('/api/')){
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized. Please log in.' }));
        } else {
            res.writeHead(302, { 'Location': '/' });
            res.end();
        }
        return;
      }
    }

    if (pathname === '/main' && method === 'GET') {
      handleDashboard(req, res);
      return;
    }

    if (pathname.startsWith('/api/')) {
      if (pathname.startsWith('/api/categories')) {
        if (await handleCategories(req, res)) return;
      } else if (pathname.startsWith('/api/users')) {
        if (await handleUsers(req, res)) return;
      } else if (pathname.startsWith('/api/resources')) {
        if (await handleResources(req, res)) return;
      } else if (pathname.startsWith('/api/notifications')) {
        if (await handleNotifications(req, res)) return;
      }
      
      if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
      }
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
      if (await handleResources(req, res)) return;
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
  console.log('\\nShutting down server...');
  await pool.end();
  console.log('PostgreSQL pool has ended');
  server.close(() => {
    console.log('Server shut down gracefully.');
    process.exit(0);
  });
});

module.exports = server;
