// Categories routes
const pool = require('../config/dbConfig');
const { parseJsonBody, parseFormData } = require('../util/requestUtils');
const templates = require('../views/templates');

async function handleCategories(req, res) {
  const path = req.path;
  const method = req.method;
  
  // List all categories with HTML UI
  if (path === '/categories' && method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM categories ORDER BY id ASC');
      const categories = result.rows;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(templates.categoriesPage(categories));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h3>Server error loading categories.</h3>');
    }
    return true;
  }
  
  // Add category (JSON API)
  if (path === '/categories' && method === 'POST') {
    parseJsonBody(req, res, async data => {
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
    return true;
  }
  
  // Add category (HTML form)
  if (path === '/categories/add' && method === 'POST') {
    parseFormData(req, async (params) => {
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
    return true;
  }
  
  // Get single category
  if (path.startsWith('/categories/') && method === 'GET' && path !== '/categories/add') {
    const id = parseInt(path.split('/')[2]);
    if (isNaN(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid category ID format.' }));
      return true;
    }
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Category not found.' }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify(result.rows[0]));
    }
    return true;
  }
  
  // Update category
  if (path.startsWith('/categories/') && method === 'PUT') {
    const id = parseInt(path.split('/')[2]);
    if (isNaN(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid category ID format.' }));
      return true;
    }
    parseJsonBody(req, res, async data => {
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
    return true;
  }
  
  // Delete category
  if (path.startsWith('/categories/') && method === 'DELETE') {
    const id = parseInt(path.split('/')[2]);
    if (isNaN(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid category ID format.' }));
      return true;
    }
    const resourcesUsingCategory = await pool.query('SELECT id FROM resources WHERE category_id = $1 LIMIT 1', [id]);
    if (resourcesUsingCategory.rows.length > 0) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Cannot delete category: It is currently in use by one or more resources.' }));
      return true;
    }
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Category not found.' }));
    } else {
      res.writeHead(204);
      res.end();
    }
    return true;
  }
  
  return false; // Not handled
}

module.exports = { handleCategories };
