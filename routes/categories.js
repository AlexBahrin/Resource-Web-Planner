const pool = require('../config/dbConfig');
const { parseJsonBody } = require('../util/requestUtils');

async function handleCategories(req, res) {
    const { method, path } = req;

    // GET /api/categories - Fetch all categories
    if (method === 'GET' && path === '/api/categories') {
        try {
            const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.rows));
        } catch (error) {
            console.error('Error fetching categories:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Error fetching categories from database.', error: error.message }));
        }
        return true;
    }

    // POST /api/categories - Add a new category
    if (method === 'POST' && path === '/api/categories') {
        try {
            const body = await parseJsonBody(req, res); // parseJsonBody now directly returns the parsed body or handles errors
            if (!body || !body.name || typeof body.name !== 'string' || body.name.trim() === '') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Category name is required and must be a non-empty string.' }));
                return true;
            }
            const categoryName = body.name.trim();
            // Check for duplicates
            const existingCategory = await pool.query('SELECT * FROM categories WHERE name = $1', [categoryName]);
            if (existingCategory.rows.length > 0) {
                res.writeHead(409, { 'Content-Type': 'application/json' }); // 409 Conflict
                res.end(JSON.stringify({ message: 'Category with this name already exists.' }));
                return true;
            }

            const result = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [categoryName]);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.rows[0]));
        } catch (error) {
            // Differentiate between parsing errors (handled by parseJsonBody) and DB errors
            if (!res.headersSent) { // If parseJsonBody handled the response, headers would be sent
                console.error('Error adding category:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Error adding category to database.', error: error.message }));
            }
        }
        return true;
    }
    
    // Note: HTML serving for /categories (GET) is handled in index.js directly for now.
    // If more complex server-side rendering for categories page is needed later,
    // that logic could be expanded here or in routes/pages.js

    return false; // Route not handled by this handler
}

module.exports = { handleCategories };
