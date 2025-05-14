const http = require('http');
const url = require('url');

const port = 8087;

let items = [];
let categories = [];
let notifications = [];
let nextItemId = 1;
let nextCategoryId = 1;
let nextNotificationId = 1;

const server = http.createServer((req, res) => {
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

  if (path === '/' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ message: 'Welcome to the Inventory Management System!' }));
  }
  else if (path === '/items' && method === 'POST') {
    parseRequestBody(data => {
      const item = data;
      if (!item.name || !item.category) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Item name and category are required.' }));
        return;
      }
      item.id = nextItemId++;
      items.push(item);

      if (item.quantity !== undefined && item.quantity < 5) {
        const notification = {
          id: nextNotificationId++,
          message: `Warning: Item "${item.name}" is low in stock (${item.quantity} remaining).`,
          itemId: item.id,
          type: 'low_stock',
          createdAt: new Date().toISOString()
        };
        notifications.push(notification);
      }
      res.writeHead(201);
      res.end(JSON.stringify(item));
    });
  } else if (path === '/items' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(items));
  } else if (path.startsWith('/items/') && method === 'GET') {
    const id = parseInt(path.split('/')[2]);
    const item = items.find(i => i.id === id);
    if (!item) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Item not found.' }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify(item));
    }
  } else if (path.startsWith('/items/') && method === 'PUT') {
    const id = parseInt(path.split('/')[2]);
    parseRequestBody(data => {
      const itemIndex = items.findIndex(i => i.id === id);
      if (itemIndex === -1) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Item not found.' }));
        return;
      }
      const originalItem = items[itemIndex];
      const updatedItem = { ...originalItem, ...data, id: originalItem.id };
      items[itemIndex] = updatedItem;

      if (updatedItem.quantity !== undefined && updatedItem.quantity < 5 && (originalItem.quantity === undefined || originalItem.quantity >= 5)) {
        const notification = {
          id: nextNotificationId++,
          message: `Warning: Item "${updatedItem.name}" is low in stock (${updatedItem.quantity} remaining).`,
          itemId: updatedItem.id,
          type: 'low_stock',
          createdAt: new Date().toISOString()
        };
        notifications.push(notification);
      }
      res.writeHead(200);
      res.end(JSON.stringify(updatedItem));
    });
  } else if (path.startsWith('/items/') && method === 'DELETE') {
    const id = parseInt(path.split('/')[2]);
    const itemIndex = items.findIndex(i => i.id === id);
    if (itemIndex === -1) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Item not found.' }));
    } else {
      items.splice(itemIndex, 1);
      res.writeHead(204);
      res.end();
    }
  }
  else if (path === '/categories' && method === 'POST') {
    parseRequestBody(data => {
      const category = data;
      if (!category.name) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Category name is required.' }));
        return;
      }
      category.id = nextCategoryId++;
      categories.push(category);
      res.writeHead(201);
      res.end(JSON.stringify(category));
    });
  } else if (path === '/categories' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(categories));
  } else if (path.startsWith('/categories/') && method === 'GET') {
    const id = parseInt(path.split('/')[2]);
    const category = categories.find(c => c.id === id);
    if (!category) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Category not found.' }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify(category));
    }
  } else if (path.startsWith('/categories/') && method === 'PUT') {
    const id = parseInt(path.split('/')[2]);
    parseRequestBody(data => {
      const categoryIndex = categories.findIndex(c => c.id === id);
      if (categoryIndex === -1) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Category not found.' }));
        return;
      }
      const updatedCategory = { ...categories[categoryIndex], ...data, id: categories[categoryIndex].id }; // Ensure ID is not overwritten
      categories[categoryIndex] = updatedCategory;
      res.writeHead(200);
      res.end(JSON.stringify(updatedCategory));
    });
  } else if (path.startsWith('/categories/') && method === 'DELETE') {
    const id = parseInt(path.split('/')[2]);
    const categoryIndex = categories.findIndex(c => c.id === id);
    if (categoryIndex === -1) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Category not found.' }));
    } else {
      categories.splice(categoryIndex, 1);
      res.writeHead(204);
      res.end();
    }
  }
  else if (path === '/notifications' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(notifications));
  } else if (path.startsWith('/notifications/') && method === 'GET') {
    const id = parseInt(path.split('/')[2]);
    const notification = notifications.find(n => n.id === id);
    if (!notification) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Notification not found.' }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify(notification));
    }
  } else if (path.startsWith('/notifications/') && method === 'DELETE') {
    const id = parseInt(path.split('/')[2]);
    const notificationIndex = notifications.findIndex(n => n.id === id);
    if (notificationIndex === -1) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Notification not found.' }));
    } else {
      notifications.splice(notificationIndex, 1);
      res.writeHead(204);
      res.end();
    }
  }
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Route not found' }));
  }
});

server.listen(port, () => {
  console.log(`Inventory Management System listening at http://localhost:${port}`);
});

module.exports = server;
